import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";
import { getTriggerDefinitions, hasTrigger } from "@/lib/automation/triggers";
import { getActionDefinitions } from "@/lib/automation/actions";

/** Verify the calling user is a member of the workspace that owns the automation */
async function verifyAutomationAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  automationId: string,
  userId: string
) {
  const automation = await db.automation.findUnique({ where: { id: automationId } });
  if (!automation) throw new Error("Automation not found");
  const member = await db.workspaceMember.findFirst({
    where: { workspaceId: automation.workspaceId, userId },
  });
  if (!member) throw new Error("Not authorized");
  return automation;
}

export const automationRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.automation.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { logs: true } } },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyAutomationAccess(ctx.db, input.id, ctx.session.user.id);
      return ctx.db.automation.findUnique({
        where: { id: input.id },
        include: {
          logs: { orderBy: { executedAt: "desc" }, take: 20 },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        trigger: z.object({
          type: z.string(),
          config: z.record(z.unknown()).default({}),
        }),
        conditions: z
          .array(
            z.object({
              field: z.string(),
              operator: z.string(),
              value: z.unknown().optional(),
            })
          )
          .default([]),
        actions: z
          .array(
            z.object({
              type: z.string(),
              config: z.record(z.string(), z.unknown()).default({}),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id },
      });
      if (!member) throw new Error("Not authorized: not a workspace member");

      if (!hasTrigger(input.trigger.type)) {
        throw new Error(`Unknown trigger type: ${input.trigger.type}`);
      }

      return ctx.db.automation.create({
        data: {
          ...input,
          createdBy: ctx.session.user.id,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        isEnabled: z.boolean().optional(),
        trigger: z
          .object({
            type: z.string(),
            config: z.record(z.unknown()).default({}),
          })
          .optional(),
        conditions: z
          .array(
            z.object({
              field: z.string(),
              operator: z.string(),
              value: z.unknown().optional(),
            })
          )
          .optional(),
        actions: z
          .array(
            z.object({
              type: z.string(),
              config: z.record(z.string(), z.unknown()).default({}),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyAutomationAccess(ctx.db, input.id, ctx.session.user.id);
      const { id, ...data } = input;
      return ctx.db.automation.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyAutomationAccess(ctx.db, input.id, ctx.session.user.id);
      return ctx.db.automation.delete({ where: { id: input.id } });
    }),

  /** Get available trigger and action definitions for the builder UI */
  definitions: protectedProcedure.query(async () => {
    return {
      triggers: getTriggerDefinitions(),
      actions: getActionDefinitions(),
    };
  }),

  /** Get execution logs for an automation */
  logs: protectedProcedure
    .input(
      z.object({ automationId: z.string(), limit: z.number().default(20) })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.automationLog.findMany({
        where: { automationId: input.automationId },
        orderBy: { executedAt: "desc" },
        take: input.limit,
      });
    }),
});
