import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";
import type { PrismaClient } from "@prisma/client";

type DbClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

async function verifyProjectMembership(db: DbClient, projectId: string, userId: string) {
  const member = await db.projectMember.findFirst({
    where: { projectId, userId },
  });
  if (!member) throw new Error("Not authorized: not a project member");
  return member;
}

export const sprintRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyProjectMembership(ctx.db, input.projectId, ctx.session.user.id);
      return ctx.db.sprint.findMany({
        where: { projectId: input.projectId },
        include: { _count: { select: { tasks: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const sprint = await ctx.db.sprint.findUnique({
        where: { id: input.id },
        include: {
          tasks: {
            include: { _count: { select: { subtasks: true } } },
            orderBy: { position: "asc" },
          },
        },
      });
      if (!sprint) throw new Error("Sprint not found");
      await verifyProjectMembership(ctx.db, sprint.projectId, ctx.session.user.id);
      return sprint;
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      name: z.string().min(1),
      goal: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyProjectMembership(ctx.db, input.projectId, ctx.session.user.id);
      return ctx.db.sprint.create({ data: input });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      goal: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sprint = await ctx.db.sprint.findUnique({ where: { id: input.id } });
      if (!sprint) throw new Error("Sprint not found");
      await verifyProjectMembership(ctx.db, sprint.projectId, ctx.session.user.id);
      const { id, ...data } = input;
      return ctx.db.sprint.update({ where: { id }, data });
    }),

  start: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sprint = await ctx.db.sprint.findUnique({ where: { id: input.id } });
      if (!sprint) throw new Error("Sprint not found");
      await verifyProjectMembership(ctx.db, sprint.projectId, ctx.session.user.id);

      // Only one active sprint per project
      const activeSprint = await ctx.db.sprint.findFirst({
        where: { projectId: sprint.projectId, status: "active" },
      });
      if (activeSprint) throw new Error("Another sprint is already active");

      return ctx.db.sprint.update({
        where: { id: input.id },
        data: { status: "active", startDate: sprint.startDate ?? new Date() },
      });
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const sprint = await tx.sprint.findUnique({
          where: { id: input.id },
          include: { tasks: { where: { status: { not: "done" } } } },
        });
        if (!sprint) throw new Error("Sprint not found");
        await verifyProjectMembership(tx, sprint.projectId, ctx.session.user.id);

        // Move incomplete tasks back to backlog (remove sprint assignment)
        if (sprint.tasks.length > 0) {
          await tx.task.updateMany({
            where: { sprintId: input.id, status: { not: "done" } },
            data: { sprintId: null },
          });
        }

        return tx.sprint.update({
          where: { id: input.id },
          data: { status: "completed", completedAt: new Date() },
        });
      });
    }),

  addTasks: protectedProcedure
    .input(z.object({ sprintId: z.string(), taskIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const sprint = await ctx.db.sprint.findUnique({ where: { id: input.sprintId } });
      if (!sprint) throw new Error("Sprint not found");
      await verifyProjectMembership(ctx.db, sprint.projectId, ctx.session.user.id);

      await ctx.db.task.updateMany({
        where: { id: { in: input.taskIds }, projectId: sprint.projectId },
        data: { sprintId: input.sprintId },
      });
      return { count: input.taskIds.length };
    }),

  removeTasks: protectedProcedure
    .input(z.object({ sprintId: z.string(), taskIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const sprint = await ctx.db.sprint.findUnique({ where: { id: input.sprintId } });
      if (!sprint) throw new Error("Sprint not found");
      await verifyProjectMembership(ctx.db, sprint.projectId, ctx.session.user.id);

      await ctx.db.task.updateMany({
        where: { id: { in: input.taskIds }, sprintId: input.sprintId },
        data: { sprintId: null },
      });
      return { count: input.taskIds.length };
    }),

  /** Burndown data: daily remaining story points / task count */
  burndown: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const sprint = await ctx.db.sprint.findUnique({
        where: { id: input.id },
        include: { tasks: { select: { status: true, updatedAt: true, estimatedHours: true } } },
      });
      if (!sprint || !sprint.startDate) return [];
      await verifyProjectMembership(ctx.db, sprint.projectId, ctx.session.user.id);

      const start = sprint.startDate;
      const end = sprint.completedAt ?? sprint.endDate ?? new Date();
      const totalTasks = sprint.tasks.length;
      const days: { date: string; remaining: number; ideal: number }[] = [];
      const msPerDay = 86400000;
      const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerDay));

      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + msPerDay)) {
        const dateStr = d.toISOString().split("T")[0] ?? "";
        const completedByDate = sprint.tasks.filter(
          (t: { status: string; updatedAt: Date }) => t.status === "done" && t.updatedAt <= d
        ).length;
        const dayIndex = Math.ceil((d.getTime() - start.getTime()) / msPerDay);
        days.push({
          date: dateStr,
          remaining: totalTasks - completedByDate,
          ideal: Math.max(0, totalTasks - (totalTasks * dayIndex) / totalDays),
        });
      }
      return days;
    }),
});
