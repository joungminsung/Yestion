import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";

export const searchRouter = router({
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        workspaceId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify workspace access
      const member = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
        },
      });
      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No access to this workspace" });
      }

      // Search page titles
      const pages = await ctx.db.page.findMany({
        where: {
          workspaceId: input.workspaceId,
          isDeleted: false,
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          title: true,
          icon: true,
          parentId: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      });

      // Also search block content via raw query
      const blockPageIds = await ctx.db.$queryRaw<{ pageId: string }[]>`
        SELECT DISTINCT b."pageId" FROM "Block" b
        JOIN "Page" p ON p."id" = b."pageId"
        WHERE p."workspaceId" = ${input.workspaceId}
          AND p."isDeleted" = false
          AND b."content"::text ILIKE ${`%${input.query}%`}
        LIMIT 20
      `;

      // Merge and deduplicate
      const pageIdSet = new Set(pages.map((p) => p.id));
      const extraIds = blockPageIds
        .map((r) => r.pageId)
        .filter((id) => !pageIdSet.has(id));

      if (extraIds.length > 0) {
        const extraPages = await ctx.db.page.findMany({
          where: { id: { in: extraIds }, isDeleted: false },
          select: {
            id: true,
            title: true,
            icon: true,
            parentId: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
        });
        pages.push(...extraPages);
      }

      return pages;
    }),

  recent: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const member = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
        },
      });
      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No access to this workspace" });
      }

      return ctx.db.page.findMany({
        where: {
          workspaceId: input.workspaceId,
          isDeleted: false,
        },
        select: {
          id: true,
          title: true,
          icon: true,
          parentId: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });
    }),

  fullSearch: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        workspaceId: z.string(),
        filters: z
          .object({
            type: z.enum(["page", "database", "all"]).default("all"),
            authorId: z.string().nullish(),
            dateFrom: z.string().nullish(), // ISO date string
            dateTo: z.string().nullish(),
          })
          .default({ type: "all" }),
        cursor: z.number().default(0),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const member = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
        },
      });
      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No access to this workspace" });
      }

      const tsQuery = input.query
        .trim()
        .split(/\s+/)
        .map((w) => `${w}:*`)
        .join(" & ");

      // Build WHERE clauses
      const conditions: string[] = [
        `p."workspaceId" = '${input.workspaceId}'`,
        `p."isDeleted" = false`,
      ];

      if (input.filters.type === "database") {
        conditions.push(`EXISTS (SELECT 1 FROM "Database" d WHERE d."pageId" = p."id")`);
      } else if (input.filters.type === "page") {
        conditions.push(`NOT EXISTS (SELECT 1 FROM "Database" d WHERE d."pageId" = p."id")`);
      }

      if (input.filters.authorId) {
        conditions.push(`p."createdBy" = '${input.filters.authorId}'`);
      }

      if (input.filters.dateFrom) {
        conditions.push(`p."updatedAt" >= '${input.filters.dateFrom}'::timestamp`);
      }
      if (input.filters.dateTo) {
        conditions.push(`p."updatedAt" <= '${input.filters.dateTo}'::timestamp`);
      }

      const whereClause = conditions.join(" AND ");

      // Search titles via tsvector + block content
      const results = await ctx.db.$queryRawUnsafe<
        {
          id: string;
          title: string;
          icon: string | null;
          parentId: string | null;
          updatedAt: Date;
          createdBy: string;
          rank: number;
          matchSource: string;
        }[]
      >(
        `
        SELECT DISTINCT ON (p."id")
          p."id", p."title", p."icon", p."parentId", p."updatedAt", p."createdBy",
          COALESCE(ts_rank(p."search_vector", to_tsquery('simple', $1)), 0) as rank,
          CASE
            WHEN p."search_vector" @@ to_tsquery('simple', $1) THEN 'title'
            ELSE 'content'
          END as "matchSource"
        FROM "Page" p
        LEFT JOIN "Block" b ON b."pageId" = p."id"
        WHERE (${whereClause})
          AND (
            p."search_vector" @@ to_tsquery('simple', $1)
            OR to_tsvector('simple', b."content"::text) @@ to_tsquery('simple', $1)
          )
        ORDER BY p."id", rank DESC
        LIMIT $2 OFFSET $3
        `,
        tsQuery,
        input.limit + 1, // fetch one extra to detect "has more"
        input.cursor,
      );

      const hasMore = results.length > input.limit;
      const items = results.slice(0, input.limit);

      return {
        items: items.map((r) => ({
          id: r.id,
          title: r.title,
          icon: r.icon,
          parentId: r.parentId,
          updatedAt: r.updatedAt,
          createdBy: r.createdBy,
          matchSource: r.matchSource as "title" | "content",
        })),
        nextCursor: hasMore ? input.cursor + input.limit : null,
      };
    }),
});
