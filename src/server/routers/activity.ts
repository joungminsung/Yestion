import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";

export const activityRouter = router({
  list: protectedProcedure
    .input(z.object({ pageId: z.string(), limit: z.number().max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      // Verify page access
      const page = await ctx.db.page.findUnique({ where: { id: input.pageId }, select: { workspaceId: true } });
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      const member = await ctx.db.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: ctx.session.user.id, workspaceId: page.workspaceId } },
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.db.activityLog.findMany({
        where: { pageId: input.pageId },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  log: protectedProcedure
    .input(
      z.object({
        pageId: z.string(),
        action: z.string().max(100),
        metadata: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify page access
      const page = await ctx.db.page.findUnique({ where: { id: input.pageId }, select: { workspaceId: true } });
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      const member = await ctx.db.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: ctx.session.user.id, workspaceId: page.workspaceId } },
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.db.activityLog.create({
        data: {
          pageId: input.pageId,
          userId: ctx.session.user.id,
          action: input.action,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      });
    }),

  workspaceList: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        action: z.string().optional(),
        userId: z.string().optional(),
        search: z.string().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify workspace access
      const member = await ctx.db.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: ctx.session.user.id, workspaceId: input.workspaceId } },
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });

      const where: Record<string, unknown> = {
        page: { workspaceId: input.workspaceId },
      };
      if (input.action && input.search) {
        // When both exact action and search text are provided,
        // filter by action type AND search in metadata
        where.action = input.action;
        where.metadata = { path: [], string_contains: input.search };
      } else if (input.action) {
        where.action = input.action;
      } else if (input.search) {
        where.action = { contains: input.search, mode: "insensitive" };
      }
      if (input.userId) where.userId = input.userId;
      if (input.from || input.to) {
        const createdAt: Record<string, Date> = {};
        if (input.from) createdAt.gte = new Date(input.from);
        if (input.to) createdAt.lte = new Date(input.to);
        where.createdAt = createdAt;
      }

      const items = await ctx.db.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          page: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }
      return { items, nextCursor };
    }),

  dailyCounts: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        days: z.number().min(7).max(90).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify workspace access
      const member = await ctx.db.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: ctx.session.user.id, workspaceId: input.workspaceId } },
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });

      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const logs = await ctx.db.activityLog.findMany({
        where: {
          page: { workspaceId: input.workspaceId },
          createdAt: { gte: since },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      const counts: Record<string, number> = {};
      logs.forEach((l) => {
        const day = l.createdAt.toISOString().slice(0, 10);
        counts[day] = (counts[day] || 0) + 1;
      });
      return Object.entries(counts).map(([date, count]) => ({ date, count }));
    }),
});
