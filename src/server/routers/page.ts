import { z } from "zod";
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";
import type { Context } from "@/server/trpc/init";
import { emitWorkspaceEvent } from "@/lib/events/emit-workspace-event";
import {
  getEffectivePermission,
  requireWorkspacePermission,
} from "@/lib/permissions";
import crypto from "crypto";

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
  const permission = await getEffectivePermission(db as never, userId, pageId);
  if (permission === "none") {
    throw new TRPCError({ code: "FORBIDDEN", message: "No access to this page" });
  }
  return page;
}

async function verifyPageEditPermission(
  db: Context["db"],
  userId: string,
  pageId: string,
) {
  const permission = await getEffectivePermission(db as never, userId, pageId);
  if (permission !== "edit") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Edit permission is required for this page" });
  }
}

async function trashDescendants(
  db: Context["db"],
  pageId: string,
  deletedAt: Date,
) {
  // Use recursive CTE to batch-update all descendants in a single query
  await db.$executeRaw`
    WITH RECURSIVE descendants AS (
      SELECT id FROM "Page" WHERE "parentId" = ${pageId} AND "isDeleted" = false
      UNION ALL
      SELECT p.id FROM "Page" p
      INNER JOIN descendants d ON p."parentId" = d.id
      WHERE p."isDeleted" = false
    )
    UPDATE "Page" SET "isDeleted" = true, "deletedAt" = ${deletedAt}
    WHERE id IN (SELECT id FROM descendants)
  `;
}

async function restoreDescendants(
  db: Context["db"],
  pageId: string,
  trashedAt: Date,
) {
  // Use recursive CTE to batch-restore all descendants in a single query
  await db.$executeRaw`
    WITH RECURSIVE descendants AS (
      SELECT id FROM "Page" WHERE "parentId" = ${pageId} AND "isDeleted" = true AND "deletedAt" = ${trashedAt}
      UNION ALL
      SELECT p.id FROM "Page" p
      INNER JOIN descendants d ON p."parentId" = d.id
      WHERE p."isDeleted" = true AND p."deletedAt" = ${trashedAt}
    )
    UPDATE "Page" SET "isDeleted" = false, "deletedAt" = NULL
    WHERE id IN (SELECT id FROM descendants)
  `;
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

async function resolvePagePlacement(
  db: Context["db"],
  userId: string,
  workspaceId: string,
  parentId: string | null,
  teamspaceId: string | null | undefined,
  defaultTeamspaceId: string | null,
) {
  let resolvedTeamspaceId = teamspaceId === undefined ? defaultTeamspaceId : (teamspaceId ?? null);

  if (parentId) {
    const parent = await db.page.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        workspaceId: true,
        teamspaceId: true,
        isDeleted: true,
      },
    });

    if (!parent || parent.isDeleted) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Parent page not found" });
    }

    await verifyWorkspaceAccess(db, userId, parent.workspaceId);

    if (parent.workspaceId !== workspaceId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Parent page must belong to the same workspace",
      });
    }

    const parentTeamspaceId = parent.teamspaceId ?? null;
    if (teamspaceId !== undefined && (teamspaceId ?? null) !== parentTeamspaceId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Child pages must stay in the same teamspace as their parent",
      });
    }

    resolvedTeamspaceId = parentTeamspaceId;
  }

  if (resolvedTeamspaceId) {
    const teamspace = await db.teamspace.findUnique({
      where: { id: resolvedTeamspaceId },
      select: { workspaceId: true },
    });
    if (!teamspace || teamspace.workspaceId !== workspaceId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Teamspace must belong to the same workspace",
      });
    }

    const teamspaceMember = await db.teamspaceMember.findUnique({
      where: {
        teamspaceId_userId: {
          teamspaceId: resolvedTeamspaceId,
          userId,
        },
      },
    });
    if (!teamspaceMember) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Not a member of this teamspace",
      });
    }
  }

  return {
    parentId,
    teamspaceId: resolvedTeamspaceId,
  };
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
        teamspaceId: z.string().nullish(),
        icon: z.string().nullish(),
        blocks: z.array(z.record(z.string(), z.unknown())).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, input.workspaceId);
      await requireWorkspacePermission(
        ctx.db,
        ctx.session.user.id,
        input.workspaceId,
        "page.create",
        "Page creation permission is required",
      );

      const placement = await resolvePagePlacement(
        ctx.db,
        ctx.session.user.id,
        input.workspaceId,
        input.parentId ?? null,
        input.teamspaceId,
        null,
      );
      const position = await getNextPosition(ctx.db, input.workspaceId, placement.parentId);

      const page = await ctx.db.page.create({
        data: {
          workspaceId: input.workspaceId,
          title: input.title,
          parentId: placement.parentId,
          teamspaceId: placement.teamspaceId,
          icon: input.icon ?? null,
          position,
          createdBy: ctx.session.user.id,
          lastEditedBy: ctx.session.user.id,
        },
      });

      // If template blocks provided, create them as page blocks
      // Template blocks are TipTap nodes — wrap in { tiptapNode } for the editor
      if (input.blocks && input.blocks.length > 0) {
        await ctx.db.block.createMany({
          data: input.blocks.map((block, idx) => ({
            pageId: page.id,
            type: (block.type as string) || "paragraph",
            content: { tiptapNode: block } as Prisma.InputJsonValue,
            position: idx,
          })),
        });
      }

      await ctx.db.activityLog.create({
        data: {
          pageId: page.id,
          userId: ctx.session.user.id,
          action: "create",
          metadata: { title: input.title },
        },
      });

      await emitWorkspaceEvent(
        ctx.db,
        input.workspaceId,
        "page.created",
        {
          entityType: "page",
          entityId: page.id,
          pageId: page.id,
          title: page.title,
          parentId: page.parentId,
          teamspaceId: page.teamspaceId,
          createdBy: page.createdBy,
        },
        ctx.session.user.id,
      );

      return page;
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
          teamspaceId: true,
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
      const page = await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      await verifyPageEditPermission(ctx.db, ctx.session.user.id, input.id);
      const { id, ...data } = input;
      const updatedPage = await ctx.db.page.update({
        where: { id },
        data: {
          ...data,
          lastEditedBy: ctx.session.user.id,
        },
      });

      await emitWorkspaceEvent(
        ctx.db,
        page.workspaceId,
        "page.updated",
        {
          entityType: "page",
          entityId: updatedPage.id,
          pageId: updatedPage.id,
          title: updatedPage.title,
          updatedFields: Object.keys(data),
        },
        ctx.session.user.id,
      );

      return updatedPage;
    }),

  updateTitle: protectedProcedure
    .input(z.object({ id: z.string(), title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const page = await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      await verifyPageEditPermission(ctx.db, ctx.session.user.id, input.id);
      const updatedPage = await ctx.db.page.update({
        where: { id: input.id },
        data: { title: input.title, lastEditedBy: ctx.session.user.id },
      });

      await emitWorkspaceEvent(
        ctx.db,
        page.workspaceId,
        "page.updated",
        {
          entityType: "page",
          entityId: updatedPage.id,
          pageId: updatedPage.id,
          title: updatedPage.title,
          updatedFields: ["title"],
        },
        ctx.session.user.id,
      );

      return updatedPage;
    }),

  moveToTrash: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const page = await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      await requireWorkspacePermission(
        ctx.db,
        ctx.session.user.id,
        page.workspaceId,
        "page.delete",
        "Page deletion permission is required",
      );
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

      await ctx.db.activityLog.create({
        data: {
          pageId: input.id,
          userId: ctx.session.user.id,
          action: "delete",
        },
      });

      await emitWorkspaceEvent(
        ctx.db,
        result.workspaceId,
        "page.deleted",
        {
          entityType: "page",
          entityId: result.id,
          pageId: result.id,
          title: result.title,
        },
        ctx.session.user.id,
      );

      return result;
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const page = await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      await requireWorkspacePermission(
        ctx.db,
        ctx.session.user.id,
        page.workspaceId,
        "page.delete",
        "Page restoration permission is required",
      );
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

      await ctx.db.activityLog.create({
        data: {
          pageId: input.id,
          userId: ctx.session.user.id,
          action: "restore",
        },
      });

      return result;
    }),

  deletePermanently: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const page = await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      await requireWorkspacePermission(
        ctx.db,
        ctx.session.user.id,
        page.workspaceId,
        "page.delete",
        "Page deletion permission is required",
      );
      // Cascade-delete child pages first to prevent orphans
      await ctx.db.$executeRaw`
        WITH RECURSIVE descendants AS (
          SELECT id FROM "Page" WHERE "parentId" = ${input.id}
          UNION ALL
          SELECT p.id FROM "Page" p
          INNER JOIN descendants d ON p."parentId" = d.id
        )
        DELETE FROM "Page" WHERE id IN (SELECT id FROM descendants)
      `;
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
    .input(z.object({ id: z.string(), parentId: z.string().nullable(), teamspaceId: z.string().nullish() }))
    .mutation(async ({ ctx, input }) => {
      const page = await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      await verifyPageEditPermission(ctx.db, ctx.session.user.id, input.id);

      // Prevent circular reference: cannot move a page to itself
      if (input.parentId === input.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot move a page under itself" });
      }
      // Prevent moving a page under one of its descendants
      if (input.parentId) {
        let checkId: string | null = input.parentId;
        let depth = 0;
        while (checkId && depth < 20) {
          if (checkId === input.id) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot move a page under one of its descendants" });
          }
          const ancestor: { parentId: string | null } | null = await ctx.db.page.findUnique({ where: { id: checkId }, select: { parentId: true } });
          checkId = ancestor?.parentId ?? null;
          depth++;
        }
      }

      const placement = await resolvePagePlacement(
        ctx.db,
        ctx.session.user.id,
        page.workspaceId,
        input.parentId,
        input.teamspaceId,
        page.teamspaceId ?? null,
      );
      const position = await getNextPosition(ctx.db, page.workspaceId, placement.parentId);
      const updatedPage = await ctx.db.page.update({
        where: { id: input.id },
        data: {
          parentId: placement.parentId,
          teamspaceId: placement.teamspaceId,
          position,
          lastEditedBy: ctx.session.user.id,
        },
      });

      await emitWorkspaceEvent(
        ctx.db,
        page.workspaceId,
        "page.updated",
        {
          entityType: "page",
          entityId: updatedPage.id,
          pageId: updatedPage.id,
          title: updatedPage.title,
          parentId: updatedPage.parentId,
          teamspaceId: updatedPage.teamspaceId,
          updatedFields: ["parentId", "teamspaceId", "position"],
        },
        ctx.session.user.id,
      );

      return updatedPage;
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const page = await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      await requireWorkspacePermission(
        ctx.db,
        ctx.session.user.id,
        page.workspaceId,
        "page.create",
        "Page creation permission is required",
      );
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

      // Copy blocks preserving parent hierarchy
      const blocks = await ctx.db.block.findMany({
        where: { pageId: page.id },
        orderBy: { position: "asc" },
      });

      if (blocks.length > 0) {
        // Build old-id → new-id mapping for parent remapping
        const idMap = new Map<string, string>();
        const newBlocks: { id: string; pageId: string; type: string; content: object; position: number; parentId: string | null }[] = [];
        for (const b of blocks) {
          const newId = crypto.randomUUID();
          idMap.set(b.id, newId);
          newBlocks.push({
            id: newId,
            pageId: newPage.id,
            type: b.type,
            content: (b.content ?? {}) as object,
            position: b.position,
            parentId: null, // will be remapped below
          });
        }
        // Remap parentId references
        for (let i = 0; i < blocks.length; i++) {
          const origParentId = blocks[i]!.parentId;
          if (origParentId && idMap.has(origParentId)) {
            newBlocks[i]!.parentId = idMap.get(origParentId)!;
          }
        }
        await ctx.db.block.createMany({ data: newBlocks });
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
        await requireWorkspacePermission(
          ctx.db,
          ctx.session.user.id,
          workspaceId,
          "page.edit",
          "Page edit permission is required",
        );
      }

      await ctx.db.$transaction(
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

  listTemplates: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, input.workspaceId);
      return ctx.db.page.findMany({
        where: { workspaceId: input.workspaceId, isTemplate: true, isDeleted: false },
        select: { id: true, title: true, icon: true },
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
