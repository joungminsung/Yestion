import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";
import type { PrismaClient } from "@prisma/client";
import fastDiff from "fast-diff";

import type { Prisma } from "@prisma/client";

type SnapshotBlock = {
  id: string;
  pageId: string;
  parentId: string | null;
  type: string;
  content: Prisma.InputJsonValue;
  position: number;
};

async function verifyPageAccess(db: PrismaClient, userId: string, pageId: string) {
  const page = await db.page.findUnique({ where: { id: pageId }, select: { workspaceId: true } });
  if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
  const member = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: page.workspaceId } },
  });
  if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "No access to this workspace" });
  return page;
}

export const historyRouter = router({
  list: protectedProcedure
    .input(z.object({ pageId: z.string(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);
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
      const snapshot = await ctx.db.pageSnapshot.findUnique({ where: { id: input.id } });
      if (!snapshot) throw new TRPCError({ code: "NOT_FOUND" });
      await verifyPageAccess(ctx.db, ctx.session.user.id, snapshot.pageId);
      return snapshot;
    }),

  diff: protectedProcedure
    .input(
      z.object({
        snapshotIdA: z.string(), // older
        snapshotIdB: z.string(), // newer
      }),
    )
    .query(async ({ ctx, input }) => {
      const [snapshotA, snapshotB] = await Promise.all([
        ctx.db.pageSnapshot.findUnique({ where: { id: input.snapshotIdA } }),
        ctx.db.pageSnapshot.findUnique({ where: { id: input.snapshotIdB } }),
      ]);

      if (!snapshotA || !snapshotB) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Snapshot not found" });
      }

      if (snapshotA.pageId !== snapshotB.pageId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Snapshots must belong to the same page" });
      }

      await verifyPageAccess(ctx.db, ctx.session.user.id, snapshotA.pageId);

      // Extract text content from blocks
      const extractText = (blocks: unknown[]): string => {
        return blocks
          .map((block: unknown) => {
            const b = block as Record<string, unknown>;
            const content = b.content as Record<string, unknown> | undefined;
            if (!content) return "";
            // Extract text from common block content shapes
            const text = (content.text as string) || (content.content as string) || "";
            return text;
          })
          .filter(Boolean)
          .join("\n");
      };

      const blocksA = (snapshotA.blocks as unknown[]) || [];
      const blocksB = (snapshotB.blocks as unknown[]) || [];
      const textA = extractText(blocksA);
      const textB = extractText(blocksB);

      // Compute diff
      const diffResult = fastDiff(textA, textB);

      // Structure: array of [type, text] where type is -1 (delete), 0 (equal), 1 (insert)
      const changes = diffResult.map(([type, text]) => ({
        type: type === fastDiff.DELETE ? ("delete" as const) : type === fastDiff.INSERT ? ("insert" as const) : ("equal" as const),
        text,
      }));

      // Stats
      const stats = {
        additions: changes.filter((c) => c.type === "insert").reduce((sum, c) => sum + c.text.length, 0),
        deletions: changes.filter((c) => c.type === "delete").reduce((sum, c) => sum + c.text.length, 0),
      };

      return {
        snapshotA: { id: snapshotA.id, title: snapshotA.title, createdAt: snapshotA.createdAt, createdBy: snapshotA.createdBy },
        snapshotB: { id: snapshotB.id, title: snapshotB.title, createdAt: snapshotB.createdAt, createdBy: snapshotB.createdBy },
        changes,
        stats,
      };
    }),

  createSnapshot: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);
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

      await verifyPageAccess(ctx.db, ctx.session.user.id, snapshot.pageId);

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
      const snapshotBlocks = snapshot.blocks as SnapshotBlock[];
      if (snapshotBlocks.length > 0) {
        await ctx.db.block.createMany({
          data: snapshotBlocks.map((b) => ({
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
