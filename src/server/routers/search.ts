import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";

type SearchPageRecord = {
  id: string;
  title: string;
  parentId: string | null;
};

function extractPlainText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(extractPlainText).filter(Boolean).join(" ");
  }
  if (value && typeof value === "object") {
    return Object.values(value).map(extractPlainText).filter(Boolean).join(" ");
  }
  return "";
}

function createSnippet(text: string, terms: string[]): string | undefined {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;

  const lower = compact.toLowerCase();
  const matchIndexes = terms
    .map((term) => lower.indexOf(term.toLowerCase()))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);

  if (matchIndexes.length === 0) {
    return compact.slice(0, 120);
  }

  const firstMatch = matchIndexes[0] ?? 0;
  const start = Math.max(0, firstMatch - 40);
  const end = Math.min(compact.length, firstMatch + 100);
  return `${start > 0 ? "…" : ""}${compact.slice(start, end)}${end < compact.length ? "…" : ""}`;
}

function buildPagePath(pageId: string, pageMap: Map<string, SearchPageRecord>): string[] {
  const path: string[] = [];
  const visited = new Set<string>();
  let current = pageMap.get(pageId)?.parentId ?? null;

  while (current && !visited.has(current)) {
    visited.add(current);
    const page = pageMap.get(current);
    if (!page) break;
    path.unshift(page.title || "Untitled");
    current = page.parentId;
  }

  return path;
}

export const searchRouter = router({
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
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
      // Escape ILIKE special characters to prevent pattern injection
      const escapedQuery = input.query.replace(/[\\%_]/g, "\\$&");
      const blockPageIds = await ctx.db.$queryRaw<{ pageId: string }[]>`
        SELECT DISTINCT b."pageId" FROM "Block" b
        JOIN "Page" p ON p."id" = b."pageId"
        WHERE p."workspaceId" = ${input.workspaceId}
          AND p."isDeleted" = false
          AND b."content"::text ILIKE ${'%' + escapedQuery + '%'}
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
        query: z.string().min(1).max(200),
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

      const sanitizedWords = input.query
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.replace(/[&|!()':*\\<>]/g, "")) // strip tsquery special chars
        .filter((w) => w.length > 0);

      if (sanitizedWords.length === 0) {
        return { items: [], nextCursor: null };
      }

      const tsQuery = sanitizedWords.map((w) => `${w}:*`).join(" & ");

      // Build parameterized WHERE clauses to prevent SQL injection
      const params: unknown[] = [tsQuery, input.workspaceId];
      const conditions: string[] = [
        `p."workspaceId" = $2`,
        `p."isDeleted" = false`,
      ];

      if (input.filters.type === "database") {
        conditions.push(`EXISTS (SELECT 1 FROM "Database" d WHERE d."pageId" = p."id")`);
      } else if (input.filters.type === "page") {
        conditions.push(`NOT EXISTS (SELECT 1 FROM "Database" d WHERE d."pageId" = p."id")`);
      }

      if (input.filters.authorId) {
        params.push(input.filters.authorId);
        conditions.push(`p."createdBy" = $${params.length}`);
      }

      if (input.filters.dateFrom) {
        params.push(input.filters.dateFrom);
        conditions.push(`p."updatedAt" >= $${params.length}::date`);
      }
      if (input.filters.dateTo) {
        params.push(input.filters.dateTo);
        conditions.push(`p."updatedAt" < ($${params.length}::date + interval '1 day')`);
      }

      const limitParam = params.length + 1;
      const offsetParam = params.length + 2;
      params.push(input.limit + 1); // fetch one extra to detect "has more"
      params.push(input.cursor);

      const whereClause = conditions.join(" AND ");

      // Search titles via tsvector + block content (fully parameterized)
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
          kind: "page" | "database";
        }[]
      >(
        `
        SELECT *
        FROM (
          SELECT DISTINCT ON (p."id")
            p."id", p."title", p."icon", p."parentId", p."updatedAt", p."createdBy",
            COALESCE(ts_rank(p."search_vector", to_tsquery('simple', $1)), 0) as rank,
            CASE
              WHEN EXISTS (SELECT 1 FROM "Database" d WHERE d."pageId" = p."id") THEN 'database'
              ELSE 'page'
            END as "kind",
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
          ORDER BY p."id", rank DESC, p."updatedAt" DESC
        ) AS ranked_results
        ORDER BY rank DESC, "updatedAt" DESC, "title" ASC
        LIMIT $${limitParam} OFFSET $${offsetParam}
        `,
        ...params,
      );

      const hasMore = results.length > input.limit;
      const items = results.slice(0, input.limit);
      const pageIds = items.map((item) => item.id);

      const pageMap = new Map<string, SearchPageRecord>();
      let pendingIds = new Set(pageIds);
      while (pendingIds.size > 0) {
        const currentBatch = Array.from(pendingIds);
        pendingIds = new Set();

        const pages = await ctx.db.page.findMany({
          where: { id: { in: currentBatch } },
          select: { id: true, title: true, parentId: true },
        });

        for (const page of pages) {
          pageMap.set(page.id, page);
          if (page.parentId && !pageMap.has(page.parentId)) {
            pendingIds.add(page.parentId);
          }
        }
      }

      const blocks = pageIds.length > 0
        ? await ctx.db.block.findMany({
            where: { pageId: { in: pageIds } },
            select: { pageId: true, content: true },
            orderBy: [{ pageId: "asc" }, { position: "asc" }],
          })
        : [];

      const snippetByPage = new Map<string, string>();
      for (const block of blocks) {
        if (snippetByPage.has(block.pageId)) continue;
        const text = extractPlainText(block.content);
        const snippet = createSnippet(text, sanitizedWords);
        if (snippet) {
          snippetByPage.set(block.pageId, snippet);
        }
      }

      return {
        items: items.map((r) => ({
          id: r.id,
          title: r.title,
          icon: r.icon,
          parentId: r.parentId,
          updatedAt: r.updatedAt,
          createdBy: r.createdBy,
          kind: r.kind,
          matchSource: r.matchSource as "title" | "content",
          path: buildPagePath(r.id, pageMap),
          snippet: snippetByPage.get(r.id),
        })),
        nextCursor: hasMore ? input.cursor + input.limit : null,
      };
    }),

});
