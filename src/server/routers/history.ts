/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";

export const historyRouter = router({
  list: protectedProcedure
    .input(z.object({ pageId: z.string(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.pageSnapshot.findMany({
        where: { pageId: input.pageId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: { id: true, title: true, createdBy: true, createdAt: true },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.pageSnapshot.findUnique({ where: { id: input.id } });
    }),

  createSnapshot: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const page = await ctx.db.page.findUnique({
        where: { id: input.pageId },
        include: { blocks: true },
      });
      if (!page) return null;
      return ctx.db.pageSnapshot.create({
        data: {
          pageId: input.pageId,
          blocks: JSON.parse(JSON.stringify(page.blocks)),
          title: page.title,
          createdBy: ctx.session.user.id,
        },
      });
    }),

  restore: protectedProcedure
    .input(z.object({ snapshotId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const snapshot = await ctx.db.pageSnapshot.findUnique({
        where: { id: input.snapshotId },
      });
      if (!snapshot) return null;

      // Save current state as snapshot first
      const page = await ctx.db.page.findUnique({
        where: { id: snapshot.pageId },
        include: { blocks: true },
      });
      if (page) {
        await ctx.db.pageSnapshot.create({
          data: {
            pageId: page.id,
            blocks: JSON.parse(JSON.stringify(page.blocks)),
            title: page.title,
            createdBy: ctx.session.user.id,
          },
        });
      }

      // Delete current blocks and restore from snapshot
      await ctx.db.block.deleteMany({ where: { pageId: snapshot.pageId } });
      const snapshotBlocks = snapshot.blocks as any[];
      if (snapshotBlocks.length > 0) {
        await ctx.db.block.createMany({
          data: snapshotBlocks.map((b: any) => ({
            id: b.id,
            pageId: snapshot.pageId,
            parentId: b.parentId,
            type: b.type,
            content: b.content,
            position: b.position,
          })),
        });
      }

      // Restore title
      await ctx.db.page.update({
        where: { id: snapshot.pageId },
        data: { title: snapshot.title },
      });

      return { success: true };
    }),
});
