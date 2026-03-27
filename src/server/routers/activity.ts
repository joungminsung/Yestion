import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { router, protectedProcedure } from "@/server/trpc/init";

export const activityRouter = router({
  list: protectedProcedure
    .input(z.object({ pageId: z.string(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
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
        action: z.string(),
        metadata: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.activityLog.create({
        data: {
          pageId: input.pageId,
          userId: ctx.session.user.id,
          action: input.action,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      });
    }),
});
