import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";

export const notificationRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).optional().default(20),
        cursor: z.string().nullish(),
      }).optional().default({ limit: 20 }),
    )
    .query(async ({ ctx, input }) => {
      const notifications = await ctx.db.notification.findMany({
        where: { userId: ctx.session.user.id },
        orderBy: [{ read: "asc" }, { createdAt: "desc" }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (notifications.length > input.limit) {
        const next = notifications.pop();
        nextCursor = next?.id;
      }

      return { items: notifications, nextCursor };
    }),

  count: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.db.notification.count({
      where: { userId: ctx.session.user.id, read: false },
    });
    return { unread: count };
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.notification.update({
        where: { id: input.id, userId: ctx.session.user.id },
        data: { read: true },
      });
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.notification.updateMany({
      where: { userId: ctx.session.user.id, read: false },
      data: { read: true },
    });
    return { success: true };
  }),
});
