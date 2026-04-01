import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";
import { randomBytes, createHmac } from "crypto";

function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

const SUBSCRIBABLE_EVENTS = [
  "page.created", "page.updated", "page.deleted",
  "task.created", "task.updated", "task.status_changed", "task.completed",
  "comment.created", "comment.resolved",
  "member.joined", "member.removed",
] as const;

export const webhookRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.webhook.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { deliveries: true } } },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      name: z.string().min(1),
      type: z.enum(["incoming", "outgoing"]),
      url: z.string().url().optional(),
      events: z.array(z.string()).default([]),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const secret = generateSecret();
      return ctx.db.webhook.create({
        data: {
          ...input,
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
      const { id, ...data } = input;
      return ctx.db.webhook.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.webhook.delete({ where: { id: input.id } });
    }),

  deliveries: protectedProcedure
    .input(z.object({ webhookId: z.string(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
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
      const secret = generateSecret();
      return ctx.db.webhook.update({
        where: { id: input.id },
        data: { secret },
      });
    }),
});
