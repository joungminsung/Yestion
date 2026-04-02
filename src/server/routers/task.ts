import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts both PrismaClient and transaction client
async function verifyProjectMembership(db: any, projectId: string, userId: string) {
  const member = await db.projectMember.findFirst({
    where: { projectId, userId },
  });
  if (!member) throw new Error("Not authorized: not a project member");
  return member;
}

export const taskRouter = router({
  list: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      status: z.string().optional(),
      assigneeId: z.string().optional(),
      priority: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await verifyProjectMembership(ctx.db, input.projectId, ctx.session.user.id);
      const { projectId, ...filters } = input;
      const where: Record<string, unknown> = { projectId, parentTaskId: null };
      if (filters.status) where.status = filters.status;
      if (filters.assigneeId) where.assigneeId = filters.assigneeId;
      if (filters.priority) where.priority = filters.priority;

      return ctx.db.task.findMany({
        where,
        include: { subtasks: true, _count: { select: { subtasks: true } } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.db.task.findUnique({
        where: { id: input.id },
        include: {
          subtasks: { orderBy: { position: "asc" } },
          activities: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      });
      if (!task) throw new Error("Not found");
      await verifyProjectMembership(ctx.db, task.projectId, ctx.session.user.id);
      return task;
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      status: z.string().default("todo"),
      priority: z.string().default("medium"),
      assigneeId: z.string().optional(),
      dueDate: z.date().optional(),
      labels: z.array(z.string()).default([]),
      parentTaskId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const maxPos = await ctx.db.task.aggregate({
        where: { projectId: input.projectId, status: input.status },
        _max: { position: true },
      });

      const task = await ctx.db.task.create({
        data: {
          ...input,
          reporterId: ctx.session.user.id,
          position: (maxPos._max.position ?? -1) + 1,
        },
      });

      await ctx.db.taskActivity.create({
        data: {
          taskId: task.id,
          userId: ctx.session.user.id,
          action: "created",
        },
      });

      return task;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      priority: z.string().optional(),
      assigneeId: z.string().nullable().optional(),
      dueDate: z.date().nullable().optional(),
      estimatedHours: z.number().nullable().optional(),
      actualHours: z.number().nullable().optional(),
      labels: z.array(z.string()).optional(),
      position: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const old = await ctx.db.task.findUnique({ where: { id } });
      if (!old) throw new Error("Task not found");
      await verifyProjectMembership(ctx.db, old.projectId, ctx.session.user.id);

      const task = await ctx.db.task.update({ where: { id }, data });

      // Log status changes
      if (data.status && data.status !== old.status) {
        await ctx.db.taskActivity.create({
          data: {
            taskId: id,
            userId: ctx.session.user.id,
            action: "status_changed",
            oldValue: old.status,
            newValue: data.status,
          },
        });
      }

      // Log assignment changes
      if (data.assigneeId !== undefined && data.assigneeId !== old.assigneeId) {
        await ctx.db.taskActivity.create({
          data: {
            taskId: id,
            userId: ctx.session.user.id,
            action: "assigned",
            oldValue: old.assigneeId,
            newValue: data.assigneeId,
          },
        });
      }

      return task;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findUnique({ where: { id: input.id } });
      if (!task) throw new Error("Task not found");
      await verifyProjectMembership(ctx.db, task.projectId, ctx.session.user.id);
      return ctx.db.task.delete({ where: { id: input.id } });
    }),

  reorder: protectedProcedure
    .input(z.object({ id: z.string(), status: z.string(), position: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const task = await tx.task.findUniqueOrThrow({ where: { id: input.id } });
        await verifyProjectMembership(tx, task.projectId, ctx.session.user.id);

        // Shift tasks in target column
        await tx.task.updateMany({
          where: {
            projectId: task.projectId,
            status: input.status,
            position: { gte: input.position },
            id: { not: input.id },
          },
          data: { position: { increment: 1 } },
        });

        // Move the task
        await tx.task.update({
          where: { id: input.id },
          data: { status: input.status, position: input.position },
        });

        // Log status change inside same transaction
        if (task.status !== input.status) {
          await tx.taskActivity.create({
            data: {
              taskId: input.id,
              userId: ctx.session.user.id,
              action: "status_changed",
              oldValue: task.status,
              newValue: input.status,
            },
          });
        }

        return tx.task.findUnique({ where: { id: input.id } });
      });
    }),
});
