import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";

async function verifyTaskAccess(db: any, taskId: string, userId: string) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  const member = await db.projectMember.findFirst({
    where: { projectId: task.projectId, userId },
  });
  if (!member) throw new Error("Not authorized");
  return task;
}

export const timeEntryRouter = router({
  /** List time entries for a task */
  list: protectedProcedure
    .input(z.object({
      taskId: z.string().optional(),
      projectId: z.string().optional(),
      userId: z.string().optional(),
      from: z.date().optional(),
      to: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.taskId) where.taskId = input.taskId;
      if (input.userId) where.userId = input.userId;
      if (input.from || input.to) {
        where.startedAt = {};
        if (input.from) (where.startedAt as any).gte = input.from;
        if (input.to) (where.startedAt as any).lte = input.to;
      }
      if (input.projectId) {
        where.task = { projectId: input.projectId };
      }

      return ctx.db.timeEntry.findMany({
        where,
        include: { task: { select: { id: true, title: true, projectId: true } } },
        orderBy: { startedAt: "desc" },
        take: 100,
      });
    }),

  /** Start a new timer for a task */
  start: protectedProcedure
    .input(z.object({ taskId: z.string(), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTaskAccess(ctx.db, input.taskId, ctx.session.user.id);

      // Stop any running timer for this user
      const running = await ctx.db.timeEntry.findFirst({
        where: { userId: ctx.session.user.id, endedAt: null },
      });
      if (running) {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - running.startedAt.getTime()) / 1000);
        await ctx.db.timeEntry.update({
          where: { id: running.id },
          data: { endedAt: now, duration: elapsed - running.pausedTotal },
        });
      }

      return ctx.db.timeEntry.create({
        data: {
          taskId: input.taskId,
          userId: ctx.session.user.id,
          description: input.description,
          startedAt: new Date(),
        },
      });
    }),

  /** Stop the running timer */
  stop: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.timeEntry.findUnique({ where: { id: input.id } });
      if (!entry || entry.userId !== ctx.session.user.id) throw new Error("Not found");
      if (entry.endedAt) throw new Error("Timer already stopped");

      const now = new Date();
      const elapsed = Math.floor((now.getTime() - entry.startedAt.getTime()) / 1000);
      const duration = elapsed - entry.pausedTotal;

      return ctx.db.timeEntry.update({
        where: { id: input.id },
        data: { endedAt: now, duration, isPaused: false },
      });
    }),

  /** Pause the running timer */
  pause: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.timeEntry.findUnique({ where: { id: input.id } });
      if (!entry || entry.userId !== ctx.session.user.id) throw new Error("Not found");
      if (entry.endedAt) throw new Error("Timer already stopped");
      if (entry.isPaused) throw new Error("Timer already paused");

      return ctx.db.timeEntry.update({
        where: { id: input.id },
        data: { isPaused: true, pausedAt: new Date() },
      });
    }),

  /** Resume a paused timer */
  resume: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.timeEntry.findUnique({ where: { id: input.id } });
      if (!entry || entry.userId !== ctx.session.user.id) throw new Error("Not found");
      if (!entry.isPaused || !entry.pausedAt) throw new Error("Timer not paused");

      const pausedSeconds = Math.floor((Date.now() - entry.pausedAt.getTime()) / 1000);

      return ctx.db.timeEntry.update({
        where: { id: input.id },
        data: {
          isPaused: false,
          pausedAt: null,
          pausedTotal: entry.pausedTotal + pausedSeconds,
        },
      });
    }),

  /** Manually create a completed time entry */
  create: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      description: z.string().optional(),
      startedAt: z.date(),
      endedAt: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyTaskAccess(ctx.db, input.taskId, ctx.session.user.id);
      const duration = Math.floor((input.endedAt.getTime() - input.startedAt.getTime()) / 1000);
      if (duration <= 0) throw new Error("End time must be after start time");

      return ctx.db.timeEntry.create({
        data: {
          taskId: input.taskId,
          userId: ctx.session.user.id,
          description: input.description,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          duration,
        },
      });
    }),

  /** Delete a time entry */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.timeEntry.findUnique({ where: { id: input.id } });
      if (!entry || entry.userId !== ctx.session.user.id) throw new Error("Not found");
      return ctx.db.timeEntry.delete({ where: { id: input.id } });
    }),

  /** Get the current user's active (running) timer */
  active: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.timeEntry.findFirst({
      where: { userId: ctx.session.user.id, endedAt: null },
      include: { task: { select: { id: true, title: true, projectId: true } } },
    });
  }),

  /** Time report: total hours grouped by task or day */
  report: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      from: z.date(),
      to: z.date(),
      groupBy: z.enum(["task", "day", "user"]).default("task"),
    }))
    .query(async ({ ctx, input }) => {
      const entries = await ctx.db.timeEntry.findMany({
        where: {
          task: { projectId: input.projectId },
          startedAt: { gte: input.from },
          endedAt: { lte: input.to },
          duration: { not: null },
        },
        include: { task: { select: { id: true, title: true } } },
      });

      if (input.groupBy === "task") {
        const map = new Map<string, { taskId: string; title: string; totalSeconds: number; count: number }>();
        for (const e of entries) {
          const key = e.taskId;
          const existing = map.get(key) ?? { taskId: key, title: e.task.title, totalSeconds: 0, count: 0 };
          existing.totalSeconds += e.duration!;
          existing.count += 1;
          map.set(key, existing);
        }
        return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
      }

      if (input.groupBy === "day") {
        const map = new Map<string, { date: string; totalSeconds: number; count: number }>();
        for (const e of entries) {
          const key = e.startedAt.toISOString().split("T")[0] ?? "";
          const existing = map.get(key) ?? { date: key, totalSeconds: 0, count: 0 };
          existing.totalSeconds += e.duration!;
          existing.count += 1;
          map.set(key, existing);
        }
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      }

      // groupBy === "user"
      const map = new Map<string, { userId: string; totalSeconds: number; count: number }>();
      for (const e of entries) {
        const key = e.userId;
        const existing = map.get(key) ?? { userId: key, totalSeconds: 0, count: 0 };
        existing.totalSeconds += e.duration!;
        existing.count += 1;
        map.set(key, existing);
      }
      return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
    }),
});
