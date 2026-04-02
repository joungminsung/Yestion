import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";
import { getAdapter, getAllAdapters } from "@/lib/integrations/base-adapter";
import type { IntegrationServiceType } from "@/lib/integrations/types";

// Import adapters to trigger registration
import "@/lib/integrations/slack";
import "@/lib/integrations/github";
import "@/lib/integrations/google-calendar";
import "@/lib/integrations/email";

const serviceEnum = z.enum(["SLACK", "GITHUB", "GOOGLE_CALENDAR", "EMAIL"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyWorkspaceAdmin(db: any, workspaceId: string, userId: string) {
  const member = await db.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!member) throw new Error("Not authorized");
  if (member.role !== "OWNER" && member.role !== "ADMIN") {
    throw new Error("Only owners and admins can manage integrations");
  }
  return member;
}

export const integrationRouter = router({
  /** List all integrations for a workspace */
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const member = await ctx.db.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id },
      });
      if (!member) throw new Error("Not authorized");

      const integrations = await ctx.db.integration.findMany({
        where: { workspaceId: input.workspaceId },
      });

      // Merge with available adapters to show all services
      const adapters = getAllAdapters();
      return adapters.map((adapter) => {
        const existing = integrations.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (i: any) => i.service === adapter.service
        );
        return {
          service: adapter.service,
          info: adapter.info,
          integration: existing
            ? {
                id: existing.id,
                status: existing.status,
                externalName: existing.externalName,
                connectedAt: existing.connectedAt,
                config: existing.config,
              }
            : null,
        };
      });
    }),

  /** Get the OAuth URL to initiate a connection */
  connect: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      service: serviceEnum,
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyWorkspaceAdmin(ctx.db, input.workspaceId, ctx.session.user.id);

      const adapter = getAdapter(input.service as IntegrationServiceType);
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const redirectUri = `${baseUrl}/api/integrations/${input.service.toLowerCase()}/callback`;

      // Create or update the integration record as pending
      await ctx.db.integration.upsert({
        where: {
          workspaceId_service: {
            workspaceId: input.workspaceId,
            service: input.service,
          },
        },
        create: {
          workspaceId: input.workspaceId,
          service: input.service,
          status: "PENDING",
          connectedBy: ctx.session.user.id,
        },
        update: {
          status: "PENDING",
          connectedBy: ctx.session.user.id,
        },
      });

      const oauthUrl = adapter.getOAuthUrl(input.workspaceId, redirectUri);
      return { oauthUrl };
    }),

  /** Disconnect an integration */
  disconnect: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      service: serviceEnum,
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyWorkspaceAdmin(ctx.db, input.workspaceId, ctx.session.user.id);

      const integration = await ctx.db.integration.findUnique({
        where: {
          workspaceId_service: {
            workspaceId: input.workspaceId,
            service: input.service,
          },
        },
      });

      if (integration?.accessToken) {
        try {
          const adapter = getAdapter(input.service as IntegrationServiceType);
          await adapter.disconnect(
            integration.accessToken,
            (integration.config as Record<string, unknown>) ?? {}
          );
        } catch {
          // Best-effort cleanup
        }
      }

      await ctx.db.integration.update({
        where: {
          workspaceId_service: {
            workspaceId: input.workspaceId,
            service: input.service,
          },
        },
        data: {
          status: "DISCONNECTED",
          accessToken: null,
          refreshToken: null,
          tokenExpiry: null,
        },
      });

      return { success: true };
    }),

  /** Get current status of a specific integration */
  getStatus: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      service: serviceEnum,
    }))
    .query(async ({ ctx, input }) => {
      const integration = await ctx.db.integration.findUnique({
        where: {
          workspaceId_service: {
            workspaceId: input.workspaceId,
            service: input.service,
          },
        },
      });

      if (!integration || !integration.accessToken) {
        return { connected: false, status: integration?.status ?? "DISCONNECTED" };
      }

      // Optionally verify the connection is still valid
      try {
        const adapter = getAdapter(input.service as IntegrationServiceType);
        const isValid = await adapter.verifyConnection(integration.accessToken);
        if (!isValid) {
          await ctx.db.integration.update({
            where: { id: integration.id },
            data: { status: "ERROR" },
          });
          return { connected: false, status: "ERROR" };
        }
      } catch {
        return { connected: false, status: "ERROR" };
      }

      return {
        connected: true,
        status: integration.status,
        externalName: integration.externalName,
        connectedAt: integration.connectedAt,
      };
    }),

  /** Update integration config (e.g. which Slack channel, which repo) */
  updateConfig: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      service: serviceEnum,
      config: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyWorkspaceAdmin(ctx.db, input.workspaceId, ctx.session.user.id);
      return ctx.db.integration.update({
        where: {
          workspaceId_service: {
            workspaceId: input.workspaceId,
            service: input.service,
          },
        },
        data: { config: input.config as unknown as import("@prisma/client").Prisma.InputJsonValue },
      });
    }),
});
