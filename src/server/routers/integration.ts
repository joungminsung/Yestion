import { z } from "zod";
import { randomBytes, randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";
import { getAdapter, getAllAdapters } from "@/lib/integrations/base-adapter";
import { encryptToken, decryptToken } from "@/lib/integrations/crypto";
import { ensureRepositoryWebhook } from "@/lib/integrations/github";
import { watchCalendar } from "@/lib/integrations/google-calendar";
import { getIntegrationServiceSlug } from "@/lib/integrations/service-slug";
import {
  requireWorkspaceMembership,
  requireWorkspacePermission,
} from "@/lib/permissions";
import type { IntegrationServiceType } from "@/lib/integrations/types";

// Import adapters to trigger registration
import "@/lib/integrations/slack";
import "@/lib/integrations/github";
import "@/lib/integrations/google-calendar";
import "@/lib/integrations/email";

const serviceEnum = z.enum(["SLACK", "GITHUB", "GOOGLE_CALENDAR", "EMAIL"]);

async function verifyWorkspaceAdmin(db: Parameters<typeof requireWorkspacePermission>[0], workspaceId: string, userId: string) {
  return requireWorkspacePermission(
    db,
    userId,
    workspaceId,
    "integration.manage",
    "Integration management permission is required",
  );
}

function getIntegrationCallbackUrl(service: IntegrationServiceType): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl}/api/integrations/${getIntegrationServiceSlug(service)}/callback`;
}

function getGoogleCalendarWebhookUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl}/api/integrations/google-calendar/webhook`;
}

function getGitHubWebhookUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl}/api/integrations/github/webhook`;
}

export const integrationRouter = router({
  /** List all integrations for a workspace */
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireWorkspaceMembership(ctx.db, ctx.session.user.id, input.workspaceId);

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
      const redirectUri = getIntegrationCallbackUrl(input.service as IntegrationServiceType);

      // Create or update the integration record as pending
      const integration = await ctx.db.integration.upsert({
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

      if (!adapter.info.requiresOAuth) {
        const isValid = await adapter.verifyConnection("");
        if (!isValid) {
          await ctx.db.integration.update({
            where: { id: integration.id },
            data: { status: "ERROR" },
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This integration is not configured on the server",
          });
        }

        const tokens = await adapter.exchangeCode("", redirectUri);
        await ctx.db.integration.update({
          where: { id: integration.id },
          data: {
            status: "CONNECTED",
            accessToken: tokens.accessToken ? encryptToken(tokens.accessToken) : null,
            refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
            tokenExpiry: tokens.expiresAt,
            externalId: tokens.externalId,
            externalName: tokens.externalName,
            connectedAt: new Date(),
          },
        });

        return { oauthUrl: null };
      }

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
      // Verify workspace membership
      await requireWorkspaceMembership(ctx.db, ctx.session.user.id, input.workspaceId);

      const integration = await ctx.db.integration.findUnique({
        where: {
          workspaceId_service: {
            workspaceId: input.workspaceId,
            service: input.service,
          },
        },
      });

      const adapter = getAdapter(input.service as IntegrationServiceType);

      if (!integration) {
        return { connected: false, status: "DISCONNECTED" };
      }

      // Optionally verify the connection is still valid
      try {
        if (adapter.info.requiresOAuth && !integration.accessToken) {
          return { connected: false, status: integration.status };
        }

        const isValid = await adapter.verifyConnection(integration.accessToken ?? "");
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
        connected: integration.status === "CONNECTED",
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

      const integration = await ctx.db.integration.findUnique({
        where: {
          workspaceId_service: {
            workspaceId: input.workspaceId,
            service: input.service,
          },
        },
      });

      if (!integration) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Integration not found" });
      }

      const currentConfig = (integration.config as Record<string, unknown>) ?? {};
      const nextConfig: Record<string, unknown> = {
        ...currentConfig,
        ...input.config,
      };
      const updateData: Record<string, unknown> = {
        config: nextConfig as import("@prisma/client").Prisma.InputJsonValue,
      };

      if (input.service === "GITHUB" && integration.accessToken) {
        const repository = typeof nextConfig.repository === "string"
          ? nextConfig.repository.trim()
          : "";

        if (repository) {
          const webhookSecret = integration.webhookSecret ?? randomBytes(32).toString("hex");
          const webhookId = await ensureRepositoryWebhook(
            decryptToken(integration.accessToken),
            repository,
            getGitHubWebhookUrl(),
            webhookSecret
          );

          nextConfig.webhookId = webhookId;
          updateData.webhookSecret = webhookSecret;
          updateData.config = nextConfig as import("@prisma/client").Prisma.InputJsonValue;
        }
      }

      if (input.service === "GOOGLE_CALENDAR" && integration.accessToken) {
        const calendarId = typeof nextConfig.calendarId === "string" && nextConfig.calendarId.trim().length > 0
          ? nextConfig.calendarId.trim()
          : "primary";
        const webhookSecret = integration.webhookSecret ?? randomBytes(32).toString("hex");
        const channelId = typeof currentConfig.channelId === "string"
          ? currentConfig.channelId
          : randomUUID();

        const watch = await watchCalendar(
          decryptToken(integration.accessToken),
          calendarId,
          getGoogleCalendarWebhookUrl(),
          channelId,
          webhookSecret
        );

        nextConfig.calendarId = calendarId;
        nextConfig.channelId = channelId;
        nextConfig.resourceId = watch.resourceId;
        nextConfig.watchExpiration = watch.expiration;
        updateData.webhookSecret = webhookSecret;
        updateData.config = nextConfig as import("@prisma/client").Prisma.InputJsonValue;
      }

      return ctx.db.integration.update({
        where: { id: integration.id },
        data: updateData,
      });
    }),
});
