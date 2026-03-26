import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";
import type { Context } from "@/server/trpc/init";

// ── Helpers ──────────────────────────────────────────────────

async function verifyWorkspaceAccess(
  db: Context["db"],
  userId: string,
  workspaceId: string,
) {
  const member = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No access to this workspace" });
  }
  return member;
}

async function verifyPageAccess(
  db: Context["db"],
  userId: string,
  pageId: string,
) {
  const page = await db.page.findUnique({ where: { id: pageId } });
  if (!page) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
  }
  await verifyWorkspaceAccess(db, userId, page.workspaceId);
  return page;
}

async function trashDescendants(
  db: Context["db"],
  pageId: string,
  deletedAt: Date,
) {
  const children = await db.page.findMany({
    where: { parentId: pageId, isDeleted: false },
    select: { id: true },
  });
  for (const child of children) {
    await db.page.update({
      where: { id: child.id },
      data: { isDeleted: true, deletedAt },
    });
    await trashDescendants(db, child.id, deletedAt);
  }
}

async function restoreDescendants(
  db: Context["db"],
  pageId: string,
  trashedAt: Date,
) {
  const children = await db.page.findMany({
    where: { parentId: pageId, isDeleted: true, deletedAt: trashedAt },
    select: { id: true },
  });
  for (const child of children) {
    await db.page.update({
      where: { id: child.id },
      data: { isDeleted: false, deletedAt: null },
    });
    await restoreDescendants(db, child.id, trashedAt);
  }
}

async function getNextPosition(
  db: Context["db"],
  workspaceId: string,
  parentId: string | null,
) {
  const last = await db.page.findFirst({
    where: { workspaceId, parentId: parentId ?? null, isDeleted: false },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? -1) + 1;
}

// ── Children include for page detail view ─────────────────────

const childrenInclude = {
  children: {
    where: { isDeleted: false },
    orderBy: { position: "asc" as const },
    select: { id: true, title: true, icon: true, parentId: true, position: true },
  },
};

// ── Router ───────────────────────────────────────────────────

export const pageRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        title: z.string().default(""),
        parentId: z.string().nullish(),
        icon: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, input.workspaceId);
      const position = await getNextPosition(ctx.db, input.workspaceId, input.parentId ?? null);

      return ctx.db.page.create({
        data: {
          workspaceId: input.workspaceId,
          title: input.title,
          parentId: input.parentId ?? null,
          icon: input.icon ?? null,
          position,
          createdBy: ctx.session.user.id,
          lastEditedBy: ctx.session.user.id,
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, input.workspaceId);

      // Flat query: fetch all non-deleted pages, client builds tree
      return ctx.db.page.findMany({
        where: {
          workspaceId: input.workspaceId,
          isDeleted: false,
        },
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          icon: true,
          parentId: true,
          position: true,
          cover: true,
          isFullWidth: true,
          isLocked: true,
        },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const page = await ctx.db.page.findUnique({
        where: { id: input.id },
        include: {
          parent: true,
          ...childrenInclude,
        },
      });
      if (!page) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
      }
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, page.workspaceId);
      return page;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        icon: z.string().nullish(),
        cover: z.string().nullish(),
        isFullWidth: z.boolean().optional(),
        isLocked: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      const { id, ...data } = input;
      return ctx.db.page.update({
        where: { id },
        data: {
          ...data,
          lastEditedBy: ctx.session.user.id,
        },
      });
    }),

  updateTitle: protectedProcedure
    .input(z.object({ id: z.string(), title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      return ctx.db.page.update({
        where: { id: input.id },
        data: { title: input.title, lastEditedBy: ctx.session.user.id },
      });
    }),

  moveToTrash: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      const deletedAt = new Date();
      const result = await ctx.db.page.update({
        where: { id: input.id },
        data: {
          isDeleted: true,
          deletedAt,
          lastEditedBy: ctx.session.user.id,
        },
      });
      // Cascade: trash all descendant pages
      await trashDescendants(ctx.db, input.id, deletedAt);
      return result;
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const page = await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      const trashedAt = page.deletedAt;
      const result = await ctx.db.page.update({
        where: { id: input.id },
        data: {
          isDeleted: false,
          deletedAt: null,
          lastEditedBy: ctx.session.user.id,
        },
      });
      // Cascade: restore descendants that were trashed at the same time
      if (trashedAt) {
        await restoreDescendants(ctx.db, input.id, trashedAt);
      }
      return result;
    }),

  deletePermanently: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      return ctx.db.page.delete({ where: { id: input.id } });
    }),

  listTrash: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, input.workspaceId);
      return ctx.db.page.findMany({
        where: { workspaceId: input.workspaceId, isDeleted: true },
        orderBy: { deletedAt: "desc" },
      });
    }),

  move: protectedProcedure
    .input(z.object({ id: z.string(), parentId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const page = await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      const position = await getNextPosition(ctx.db, page.workspaceId, input.parentId);
      return ctx.db.page.update({
        where: { id: input.id },
        data: {
          parentId: input.parentId,
          position,
          lastEditedBy: ctx.session.user.id,
        },
      });
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const page = await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      const position = await getNextPosition(ctx.db, page.workspaceId, page.parentId);

      // Create the duplicate page
      const newPage = await ctx.db.page.create({
        data: {
          workspaceId: page.workspaceId,
          parentId: page.parentId,
          title: `${page.title} (복사본)`,
          icon: page.icon,
          cover: page.cover,
          isFullWidth: page.isFullWidth,
          position,
          createdBy: ctx.session.user.id,
          lastEditedBy: ctx.session.user.id,
        },
      });

      // Copy blocks
      const blocks = await ctx.db.block.findMany({
        where: { pageId: page.id },
        orderBy: { position: "asc" },
      });

      if (blocks.length > 0) {
        await ctx.db.block.createMany({
          data: blocks.map((b) => ({
            pageId: newPage.id,
            type: b.type,
            content: b.content ?? {},
            position: b.position,
            parentId: null, // simplified: top-level blocks only for now
          })),
        });
      }

      return newPage;
    }),

  reorder: protectedProcedure
    .input(
      z.object({
        pages: z.array(z.object({ id: z.string(), position: z.number() })),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify access: check all pages belong to a workspace the user can access
      if (input.pages.length > 0) {
        const pageRecords = await ctx.db.page.findMany({
          where: { id: { in: input.pages.map((p) => p.id) } },
          select: { id: true, workspaceId: true },
        });
        const workspaceIds = new Set(pageRecords.map((p) => p.workspaceId));
        if (workspaceIds.size !== 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "All pages must belong to the same workspace" });
        }
        const workspaceId = pageRecords[0]!.workspaceId;
        await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, workspaceId);
      }

      await Promise.all(
        input.pages.map((p) =>
          ctx.db.page.update({
            where: { id: p.id },
            data: { position: p.position },
          }),
        ),
      );
      return { success: true };
    }),

  addFavorite: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);

      // Get next position
      const last = await ctx.db.favorite.findFirst({
        where: { userId: ctx.session.user.id },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      return ctx.db.favorite.create({
        data: {
          userId: ctx.session.user.id,
          pageId: input.pageId,
          position: (last?.position ?? -1) + 1,
        },
      });
    }),

  removeFavorite: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.favorite.delete({
        where: {
          userId_pageId: {
            userId: ctx.session.user.id,
            pageId: input.pageId,
          },
        },
      });
    }),

  listFavorites: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, input.workspaceId);
      return ctx.db.favorite.findMany({
        where: {
          userId: ctx.session.user.id,
          page: { workspaceId: input.workspaceId, isDeleted: false },
        },
        include: { page: true },
        orderBy: { position: "asc" },
      });
    }),

  getAncestors: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const ancestors: { id: string; title: string; icon: string | null }[] = [];
      let currentId: string | null = input.id;
      const maxDepth = 20; // safety limit
      let depth = 0;
      while (currentId && depth < maxDepth) {
        const page: { id: string; title: string; icon: string | null; parentId: string | null; workspaceId: string } | null =
          await ctx.db.page.findUnique({
            where: { id: currentId },
            select: { id: true, title: true, icon: true, parentId: true, workspaceId: true },
          });
        if (!page) break;
        // Verify access on the first iteration
        if (depth === 0) {
          await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, page.workspaceId);
        }
        ancestors.unshift(page);
        currentId = page.parentId;
        depth++;
      }
      return ancestors;
    }),
});
