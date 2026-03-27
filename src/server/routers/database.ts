import { z } from "zod";
import { Prisma } from "@prisma/client";
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

async function verifyDatabaseAccess(
  db: Context["db"],
  userId: string,
  databaseId: string,
) {
  const database = await db.database.findUnique({
    where: { id: databaseId },
    include: { page: { select: { workspaceId: true } } },
  });
  if (!database) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Database not found" });
  }
  await verifyWorkspaceAccess(db, userId, database.page.workspaceId);
  return database;
}

function defaultViewConfig(type: string) {
  const base = {};
  switch (type) {
    case "board":
      return { ...base, boardGroupBy: undefined };
    case "calendar":
      return { ...base, calendarDateProperty: undefined };
    case "gallery":
      return { ...base, galleryCardSize: "medium" };
    case "timeline":
      return { ...base, timelineStartProperty: undefined, timelineEndProperty: undefined };
    default:
      return base;
  }
}

// ── Router ───────────────────────────────────────────────────

export const databaseRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().default("Untitled Database"),
        isInline: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, input.workspaceId);

      // Create a page for the database
      const page = await ctx.db.page.create({
        data: {
          workspaceId: input.workspaceId,
          title: input.name,
          createdBy: ctx.session.user.id,
          lastEditedBy: ctx.session.user.id,
        },
      });

      // Create the database
      const database = await ctx.db.database.create({
        data: {
          pageId: page.id,
          isInline: input.isInline,
          properties: {
            create: {
              name: "Title",
              type: "title",
              position: 0,
            },
          },
          views: {
            create: {
              name: "Table View",
              type: "table",
              position: 0,
            },
          },
        },
        include: {
          properties: true,
          views: true,
          page: true,
        },
      });

      return database;
    }),

  get: protectedProcedure
    .input(z.object({ databaseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const database = await ctx.db.database.findUnique({
        where: { id: input.databaseId },
        include: {
          page: true,
          properties: { orderBy: { position: "asc" } },
          views: { orderBy: { position: "asc" } },
          rows: {
            include: {
              page: { select: { id: true, title: true, icon: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!database) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Database not found" });
      }
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, database.page.workspaceId);
      return database;
    }),

  // ── Properties ─────────────────────────────────────────────

  addProperty: protectedProcedure
    .input(
      z.object({
        databaseId: z.string(),
        name: z.string(),
        type: z.string(),
        config: z.record(z.string(), z.any()).default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyDatabaseAccess(ctx.db, ctx.session.user.id, input.databaseId);

      // Auto-position: next after max
      const last = await ctx.db.property.findFirst({
        where: { databaseId: input.databaseId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const position = (last?.position ?? -1) + 1;

      return ctx.db.property.create({
        data: {
          databaseId: input.databaseId,
          name: input.name,
          type: input.type,
          config: input.config,
          position,
        },
      });
    }),

  updateProperty: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        type: z.string().optional(),
        config: z.record(z.string(), z.any()).optional(),
        isVisible: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.db.property.findUnique({
        where: { id: input.id },
        include: { database: { include: { page: { select: { workspaceId: true } } } } },
      });
      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, property.database.page.workspaceId);

      const { id, ...data } = input;
      return ctx.db.property.update({
        where: { id },
        data,
      });
    }),

  deleteProperty: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.db.property.findUnique({
        where: { id: input.id },
        include: { database: { include: { page: { select: { workspaceId: true } } } } },
      });
      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, property.database.page.workspaceId);

      return ctx.db.property.delete({ where: { id: input.id } });
    }),

  reorderProperties: protectedProcedure
    .input(
      z.object({
        properties: z.array(z.object({ id: z.string(), position: z.number() })),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.properties.length === 0) return { success: true };

      // Verify ALL properties belong to the same database
      const allProperties = await ctx.db.property.findMany({
        where: { id: { in: input.properties.map((p) => p.id) } },
        select: { id: true, databaseId: true },
      });

      if (allProperties.length !== input.properties.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "One or more properties not found" });
      }

      const uniqueDbIds = new Set(allProperties.map((p) => p.databaseId));
      if (uniqueDbIds.size !== 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "All properties must belong to the same database" });
      }

      const databaseId = Array.from(uniqueDbIds)[0]!;
      await verifyDatabaseAccess(ctx.db, ctx.session.user.id, databaseId);

      await Promise.all(
        input.properties.map((p) =>
          ctx.db.property.update({
            where: { id: p.id },
            data: { position: p.position },
          }),
        ),
      );
      return { success: true };
    }),

  // ── Views ──────────────────────────────────────────────────

  addView: protectedProcedure
    .input(
      z.object({
        databaseId: z.string(),
        name: z.string(),
        type: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyDatabaseAccess(ctx.db, ctx.session.user.id, input.databaseId);

      const last = await ctx.db.databaseView.findFirst({
        where: { databaseId: input.databaseId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const position = (last?.position ?? -1) + 1;
      const config = defaultViewConfig(input.type);

      return ctx.db.databaseView.create({
        data: {
          databaseId: input.databaseId,
          name: input.name,
          type: input.type,
          config,
          position,
        },
      });
    }),

  updateView: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        config: z.record(z.string(), z.any()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.databaseView.findUnique({
        where: { id: input.id },
        include: { database: { include: { page: { select: { workspaceId: true } } } } },
      });
      if (!view) {
        throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });
      }
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, view.database.page.workspaceId);

      // Merge config
      const existingConfig = (view.config as Record<string, unknown>) ?? {};
      const mergedConfig = { ...existingConfig, ...input.config };

      return ctx.db.databaseView.update({
        where: { id: input.id },
        data: { config: mergedConfig },
      });
    }),

  deleteView: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.databaseView.findUnique({
        where: { id: input.id },
        include: { database: { include: { page: { select: { workspaceId: true } } } } },
      });
      if (!view) {
        throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });
      }
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, view.database.page.workspaceId);

      return ctx.db.databaseView.delete({ where: { id: input.id } });
    }),

  // ── Rows ───────────────────────────────────────────────────

  addRow: protectedProcedure
    .input(
      z.object({
        databaseId: z.string(),
        values: z.record(z.string(), z.any()).default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const database = await verifyDatabaseAccess(ctx.db, ctx.session.user.id, input.databaseId);

      // Find the title property to derive the page title
      const titleProp = await ctx.db.property.findFirst({
        where: { databaseId: input.databaseId, type: "title" },
      });
      const pageTitle = titleProp && input.values[titleProp.id]
        ? String(input.values[titleProp.id])
        : "";

      // Create a page for this row
      const page = await ctx.db.page.create({
        data: {
          workspaceId: database.page.workspaceId,
          title: pageTitle,
          parentId: database.pageId,
          createdBy: ctx.session.user.id,
          lastEditedBy: ctx.session.user.id,
        },
      });

      return ctx.db.row.create({
        data: {
          databaseId: input.databaseId,
          pageId: page.id,
          values: input.values,
        },
        include: {
          page: { select: { id: true, title: true, icon: true } },
        },
      });
    }),

  updateRow: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        values: z.record(z.string(), z.any()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.row.findUnique({
        where: { id: input.id },
        include: { database: { include: { page: { select: { workspaceId: true } } } } },
      });
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Row not found" });
      }
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, row.database.page.workspaceId);

      // Merge values
      const existingValues = (row.values as Record<string, unknown>) ?? {};
      const mergedValues = { ...existingValues, ...input.values };

      return ctx.db.row.update({
        where: { id: input.id },
        data: { values: mergedValues },
        include: {
          page: { select: { id: true, title: true, icon: true } },
        },
      });
    }),

  deleteRow: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.row.findUnique({
        where: { id: input.id },
        include: { database: { include: { page: { select: { workspaceId: true } } } } },
      });
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Row not found" });
      }
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, row.database.page.workspaceId);

      // Delete row and its page in a transaction
      await ctx.db.$transaction(async (tx) => {
        await tx.row.delete({ where: { id: input.id } });
        await tx.page.delete({ where: { id: row.pageId } });
      });

      return { success: true };
    }),

  // ── Linked Database ────────────────────────────────────────

  createLinkedView: protectedProcedure
    .input(
      z.object({
        sourceDatabaseId: z.string(),
        pageId: z.string(),
        name: z.string().default("링크된 데이터베이스"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sourceDb = await ctx.db.database.findUnique({
        where: { id: input.sourceDatabaseId },
        include: { page: { select: { workspaceId: true } } },
      });
      if (!sourceDb) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Source database not found" });
      }
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, sourceDb.page.workspaceId);

      // Linked DB = new view on the same database
      const last = await ctx.db.databaseView.findFirst({
        where: { databaseId: input.sourceDatabaseId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const position = (last?.position ?? -1) + 1;

      const view = await ctx.db.databaseView.create({
        data: {
          databaseId: input.sourceDatabaseId,
          name: input.name,
          type: "table",
          config: {},
          position,
        },
      });

      return { databaseId: input.sourceDatabaseId, viewId: view.id };
    }),

  // ── CSV Import ────────────────────────────────────────────

  importCSV: protectedProcedure
    .input(
      z.object({
        databaseId: z.string(),
        headers: z.array(z.string()),
        rows: z.array(z.array(z.string())),
        propertyTypes: z.record(z.string(), z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const database = await verifyDatabaseAccess(ctx.db, ctx.session.user.id, input.databaseId);

      // Create properties for each header (skip first column = title)
      const properties = [];
      for (let i = 1; i < input.headers.length; i++) {
        const name = input.headers[i]!;
        const type = input.propertyTypes[name] || "text";

        const lastProp = await ctx.db.property.findFirst({
          where: { databaseId: input.databaseId },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        const position = (lastProp?.position ?? -1) + 1;

        const prop = await ctx.db.property.create({
          data: {
            databaseId: input.databaseId,
            name,
            type,
            position,
          },
        });
        properties.push(prop);
      }

      // Create rows
      let rowCount = 0;
      for (const row of input.rows) {
        const pageTitle = row[0] || "";
        const page = await ctx.db.page.create({
          data: {
            workspaceId: database.page.workspaceId,
            title: pageTitle,
            parentId: database.pageId,
            createdBy: ctx.session.user.id,
            lastEditedBy: ctx.session.user.id,
          },
        });

        const values: Record<string, unknown> = {};

        // Set title property value
        const titleProp = await ctx.db.property.findFirst({
          where: { databaseId: input.databaseId, type: "title" },
        });
        if (titleProp) {
          values[titleProp.id] = pageTitle;
        }

        // Set other property values
        properties.forEach((prop, i) => {
          const val = row[i + 1] ?? "";
          if (prop.type === "number") {
            values[prop.id] = Number(val) || 0;
          } else if (prop.type === "checkbox") {
            values[prop.id] = val === "true";
          } else {
            values[prop.id] = val;
          }
        });

        await ctx.db.row.create({
          data: {
            databaseId: input.databaseId,
            pageId: page.id,
            values: values as Prisma.InputJsonValue,
          },
        });
        rowCount++;
      }

      return { success: true, rowCount, propertyCount: properties.length };
    }),

  queryRows: protectedProcedure
    .input(z.object({ databaseId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyDatabaseAccess(ctx.db, ctx.session.user.id, input.databaseId);

      return ctx.db.row.findMany({
        where: { databaseId: input.databaseId },
        include: {
          page: { select: { id: true, title: true, icon: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),
});
