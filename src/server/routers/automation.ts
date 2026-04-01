import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";
import { getTriggerDefinitions } from "@/lib/automation/triggers";
import { getActionDefinitions } from "@/lib/automation/actions";

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
      const { id, ...data } = input;
      return ctx.db.automation.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
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
