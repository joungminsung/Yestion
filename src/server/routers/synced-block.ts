import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";

export const syncedBlockRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        sourceBlockId: z.string(),
        sourcePageId: z.string(),
        content: z.record(z.string(), z.unknown()).default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.syncedBlock.create({
        data: {
          sourceBlockId: input.sourceBlockId,
          sourcePageId: input.sourcePageId,
          content: input.content,
        },
      });
    }),

  get: protectedProcedure
    .input(z.object({ sourceBlockId: z.string() }))
    .query(async ({ ctx, input }) => {
      const synced = await ctx.db.syncedBlock.findFirst({
        where: { sourceBlockId: input.sourceBlockId },
      });
      if (!synced) throw new TRPCError({ code: "NOT_FOUND" });
      return synced;
    }),

  detach: protectedProcedure
    .input(z.object({ sourceBlockId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.syncedBlock.deleteMany({
        where: { sourceBlockId: input.sourceBlockId },
      });
      return { success: true, count: deleted.count };
    }),

  listReferences: protectedProcedure
    .input(z.object({ sourcePageId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.syncedBlock.findMany({
        where: { sourcePageId: input.sourcePageId },
        orderBy: { createdAt: "desc" },
      });
    }),

  updateContent: protectedProcedure
    .input(
      z.object({
        sourceBlockId: z.string(),
        content: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.syncedBlock.findFirst({
        where: { sourceBlockId: input.sourceBlockId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.syncedBlock.update({
        where: { id: existing.id },
        data: {
          content: input.content,
          version: { increment: 1 },
        },
      });
    }),
});
