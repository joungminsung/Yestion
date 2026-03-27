import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";

export const syncedBlockRouter = router({
  create: protectedProcedure
    .input(z.object({ sourceBlockId: z.string(), sourcePageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.syncedBlock.create({ data: input });
    }),

  getSource: protectedProcedure
    .input(z.object({ sourceBlockId: z.string() }))
    .query(async ({ ctx, input }) => {
      const block = await ctx.db.block.findUnique({ where: { id: input.sourceBlockId } });
      return block;
    }),

  list: protectedProcedure
    .input(z.object({ sourcePageId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.syncedBlock.findMany({ where: { sourcePageId: input.sourcePageId } });
    }),
});
