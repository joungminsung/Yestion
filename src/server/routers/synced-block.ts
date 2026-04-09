import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";
import type { Context } from "@/server/trpc/init";

async function verifyPageAccess(db: Context["db"], userId: string, pageId: string) {
  const page = await db.page.findUnique({ where: { id: pageId }, select: { workspaceId: true } });
  if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
  const member = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: page.workspaceId } },
  });
  if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "No access" });
  return page;
}

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
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.sourcePageId);
      return ctx.db.syncedBlock.create({
        data: {
          sourceBlockId: input.sourceBlockId,
          sourcePageId: input.sourcePageId,
          content: input.content as unknown as import("@prisma/client").Prisma.InputJsonValue,
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
      await verifyPageAccess(ctx.db, ctx.session.user.id, synced.sourcePageId);
      return synced;
    }),

  detach: protectedProcedure
    .input(z.object({ sourceBlockId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const synced = await ctx.db.syncedBlock.findFirst({
        where: { sourceBlockId: input.sourceBlockId },
      });
      if (!synced) throw new TRPCError({ code: "NOT_FOUND" });
      await verifyPageAccess(ctx.db, ctx.session.user.id, synced.sourcePageId);
      const deleted = await ctx.db.syncedBlock.deleteMany({
        where: { sourceBlockId: input.sourceBlockId },
      });
      return { success: true, count: deleted.count };
    }),

  listReferences: protectedProcedure
    .input(z.object({ sourcePageId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.sourcePageId);
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
      await verifyPageAccess(ctx.db, ctx.session.user.id, existing.sourcePageId);
      return ctx.db.syncedBlock.update({
        where: { id: existing.id },
        data: {
          content: input.content as unknown as import("@prisma/client").Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
    }),
});
