import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { PrismaClient } from "@prisma/client";
import { router, protectedProcedure } from "@/server/trpc/init";
import { getEffectivePermission } from "@/lib/permissions";

async function verifyPageAccess(db: PrismaClient, userId: string, pageId: string) {
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { workspaceId: true },
  });
  if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });

  const membership = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: page.workspaceId } },
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "No access to this workspace" });
}

async function verifyEditPermission(db: PrismaClient, userId: string, pageId: string) {
  const perm = await getEffectivePermission(db, userId, pageId);
  if (perm !== "edit") {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have edit permission on this page" });
  }
}

export const blockRouter = router({
  list: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);
      return ctx.db.block.findMany({
        where: { pageId: input.pageId, parentId: null },
        include: { children: { orderBy: { position: "asc" }, include: { children: { orderBy: { position: "asc" } } } } },
        orderBy: { position: "asc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({ pageId: z.string(), parentId: z.string().optional(), type: z.string(), content: z.record(z.string(), z.any()).default({}), position: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);
      await verifyEditPermission(ctx.db, ctx.session.user.id, input.pageId);
      const block = await ctx.db.block.create({ data: { pageId: input.pageId, parentId: input.parentId, type: input.type, content: input.content, position: input.position } });
      await ctx.db.page.update({ where: { id: input.pageId }, data: { lastEditedBy: ctx.session.user.id } });
      return block;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), type: z.string().optional(), content: z.record(z.string(), z.any()).optional(), parentId: z.string().nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const block = await ctx.db.block.findUnique({ where: { id: input.id } });
      if (!block) throw new TRPCError({ code: "NOT_FOUND" });
      await verifyPageAccess(ctx.db, ctx.session.user.id, block.pageId);
      await verifyEditPermission(ctx.db, ctx.session.user.id, block.pageId);
      const updated = await ctx.db.block.update({
        where: { id: input.id },
        data: { ...(input.type !== undefined && { type: input.type }), ...(input.content !== undefined && { content: input.content }), ...(input.parentId !== undefined && { parentId: input.parentId }) },
      });
      await ctx.db.page.update({ where: { id: block.pageId }, data: { lastEditedBy: ctx.session.user.id } });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const block = await ctx.db.block.findUnique({ where: { id: input.id } });
      if (!block) throw new TRPCError({ code: "NOT_FOUND" });
      await verifyPageAccess(ctx.db, ctx.session.user.id, block.pageId);
      await verifyEditPermission(ctx.db, ctx.session.user.id, block.pageId);
      await ctx.db.block.delete({ where: { id: input.id } });
      await ctx.db.page.update({ where: { id: block.pageId }, data: { lastEditedBy: ctx.session.user.id } });
      return { success: true };
    }),

  reorder: protectedProcedure
    .input(z.object({ pageId: z.string(), blocks: z.array(z.object({ id: z.string(), position: z.number(), parentId: z.string().nullable().optional() })) }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);
      await ctx.db.$transaction(input.blocks.map((b) => ctx.db.block.update({ where: { id: b.id }, data: { position: b.position, ...(b.parentId !== undefined && { parentId: b.parentId }) } })));
      await ctx.db.page.update({ where: { id: input.pageId }, data: { lastEditedBy: ctx.session.user.id } });
      return { success: true };
    }),

  bulkSave: protectedProcedure
    .input(z.object({ pageId: z.string(), blocks: z.array(z.object({ id: z.string(), type: z.string(), content: z.record(z.string(), z.any()), position: z.number(), parentId: z.string().nullable().optional() })) }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);
      await verifyEditPermission(ctx.db, ctx.session.user.id, input.pageId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.db.$transaction(async (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => {
        const existingIds = (await tx.block.findMany({
          where: { pageId: input.pageId },
          select: { id: true },
        })).map((b: { id: string }) => b.id);

        const inputIds = new Set(input.blocks.map((b) => b.id));
        const toDelete = existingIds.filter((id: string) => !inputIds.has(id));

        if (toDelete.length > 0) {
          await tx.block.deleteMany({ where: { id: { in: toDelete } } });
        }

        for (const b of input.blocks) {
          await tx.block.upsert({
            where: { id: b.id },
            create: { id: b.id, pageId: input.pageId, type: b.type, content: b.content, position: b.position, parentId: b.parentId ?? null },
            update: { type: b.type, content: b.content, position: b.position, parentId: b.parentId ?? null },
          });
        }
      });

      await ctx.db.page.update({ where: { id: input.pageId }, data: { lastEditedBy: ctx.session.user.id } });
      return { success: true };
    }),
});
