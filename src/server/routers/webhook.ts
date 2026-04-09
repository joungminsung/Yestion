import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";
import { randomBytes, createHmac } from "crypto";
import {
  requireWorkspaceMembership,
  requireWorkspacePermission,
} from "@/lib/permissions";

function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function isValidOutgoingWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const SUBSCRIBABLE_EVENTS = [
  "page.created", "page.updated", "page.deleted",
  "comment.created", "comment.resolved",
  "member.joined", "member.removed",
] as const;

async function verifyWebhookAccess(db: import("@prisma/client").PrismaClient, webhookId: string, userId: string, requireAdmin = false) {
  const webhook = await db.webhook.findUnique({ where: { id: webhookId } });
  if (!webhook) throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
  await requireWorkspaceMembership(db, userId, webhook.workspaceId);
  if (requireAdmin) {
    await requireWorkspacePermission(
      db,
      userId,
      webhook.workspaceId,
      "webhook.manage",
      "Webhook management permission is required",
    );
  }
  return webhook;
}

async function verifyWorkspaceAdmin(db: import("@prisma/client").PrismaClient, workspaceId: string, userId: string) {
  return requireWorkspacePermission(
    db,
    userId,
    workspaceId,
    "webhook.manage",
    "Webhook management permission is required",
  );
}

export const webhookRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireWorkspaceMembership(ctx.db, ctx.session.user.id, input.workspaceId);

      const webhooks = await ctx.db.webhook.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { deliveries: true } } },
      });
      return webhooks.map((w: { secret: string } & Record<string, unknown>) => ({
        ...w,
        secret: w.secret.slice(0, 8) + "..." + w.secret.slice(-4),
      }));
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      name: z.string().min(1),
      type: z.enum(["incoming", "outgoing"]),
      url: z.string().url().optional(),
      events: z.array(z.enum(SUBSCRIBABLE_EVENTS)).default([]),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Require admin role to create webhooks
      await verifyWorkspaceAdmin(ctx.db, input.workspaceId, ctx.session.user.id);

      const secret = generateSecret();
      const isIncoming = input.type === "incoming";
      const generatedPath = isIncoming ? `/api/webhooks/${randomBytes(12).toString("hex")}` : undefined;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const webhookUrl = isIncoming
        ? `${baseUrl}${generatedPath}`
        : input.url;

      if (!isIncoming && !webhookUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Outgoing webhooks require a target URL",
        });
      }
      if (!isIncoming && webhookUrl && !isValidOutgoingWebhookUrl(webhookUrl)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Outgoing webhooks must use an HTTPS URL",
        });
      }

      // Return full secret on create — intentional one-time view for initial setup
      return ctx.db.webhook.create({
        data: {
          ...input,
          url: webhookUrl,
          secret,
          createdBy: ctx.session.user.id,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      url: z.string().url().optional(),
      events: z.array(z.string()).optional(),
      isEnabled: z.boolean().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const webhook = await verifyWebhookAccess(ctx.db, input.id, ctx.session.user.id, true);
      if (webhook.type === "incoming" && input.url) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Incoming webhook URLs are generated automatically",
        });
      }
      if (webhook.type === "outgoing" && input.url && !isValidOutgoingWebhookUrl(input.url)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Outgoing webhooks must use an HTTPS URL",
        });
      }
      const { id, ...data } = input;
      return ctx.db.webhook.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyWebhookAccess(ctx.db, input.id, ctx.session.user.id, true);
      return ctx.db.webhook.delete({ where: { id: input.id } });
    }),

  deliveries: protectedProcedure
    .input(z.object({ webhookId: z.string(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      await verifyWebhookAccess(ctx.db, input.webhookId, ctx.session.user.id);
      return ctx.db.webhookDelivery.findMany({
        where: { webhookId: input.webhookId },
        orderBy: { deliveredAt: "desc" },
        take: input.limit,
      });
    }),

  /** Get available events for subscription */
  availableEvents: protectedProcedure.query(() => {
    return SUBSCRIBABLE_EVENTS;
  }),

  /** Regenerate webhook secret */
  regenerateSecret: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyWebhookAccess(ctx.db, input.id, ctx.session.user.id, true);
      const secret = generateSecret();
      return ctx.db.webhook.update({
        where: { id: input.id },
        data: { secret },
      });
    }),
});
