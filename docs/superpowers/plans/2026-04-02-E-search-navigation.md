# Search & Navigation Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full-text search with filters, a page graph visualization, tabs/split-view layout, and navigation history UI to transform workspace navigation into a power-user experience.
**Architecture:** Full search page uses PostgreSQL tsvector index for performant full-text search with faceted filters (type, date, author). Graph view renders page link relationships using d3-force in a canvas. Tabs/split-view is managed by a Zustand store and injected into the main layout via a TabBar and SplitView wrapper.
**Tech Stack:** Prisma, PostgreSQL tsvector, tRPC, d3-force, Zustand, Next.js App Router, React 18, Tailwind CSS, lucide-react

---

### Task 1: Full Search Page
**Files:**
- Create: `prisma/migrations/20260402_add_tsvector_index/migration.sql`
- Modify: `src/server/routers/search.ts`
- Create: `src/app/(main)/[workspaceId]/search/page.tsx`

- [ ] **Step 1: Create tsvector index migration**

Create `prisma/migrations/20260402_add_tsvector_index/migration.sql`:

```sql
-- Add tsvector column to Page for full-text search
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- Populate existing rows
UPDATE "Page" SET "search_vector" = to_tsvector('simple', coalesce("title", ''));

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "Page_search_vector_idx" ON "Page" USING GIN ("search_vector");

-- Create trigger to auto-update search_vector on title change
CREATE OR REPLACE FUNCTION page_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" := to_tsvector('simple', coalesce(NEW."title", ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS page_search_vector_trigger ON "Page";
CREATE TRIGGER page_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "title" ON "Page"
  FOR EACH ROW EXECUTE FUNCTION page_search_vector_update();

-- Also index Block content for content search
CREATE INDEX IF NOT EXISTS "Block_content_gin_idx"
  ON "Block" USING GIN (to_tsvector('simple', "content"::text));
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate resolve --applied 20260402_add_tsvector_index
npx prisma db execute --file prisma/migrations/20260402_add_tsvector_index/migration.sql
```

- [ ] **Step 3: Add fullSearch procedure to search.ts router**

In `src/server/routers/search.ts`, add a new `fullSearch` procedure after the existing `recent` procedure (after line 111, before the closing `});`):

```typescript
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
          .default({}),
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
```

- [ ] **Step 4: Create the search page component**

Create `src/app/(main)/[workspaceId]/search/page.tsx`:

```tsx
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Search, Filter, FileText, Database, Calendar, User, X, Loader2 } from "lucide-react";
import { trpc } from "@/server/trpc/client";
import { useTranslations } from "next-intl";

type FilterState = {
  type: "all" | "page" | "database";
  authorId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
};

export default function SearchPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    type: "all",
    authorId: null,
    dateFrom: null,
    dateTo: null,
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data: members } = trpc.workspace.members.useQuery(
    { workspaceId },
    { enabled: !!workspaceId },
  );

  const { data: searchResults, isLoading } = trpc.search.fullSearch.useQuery(
    {
      query: debouncedQuery,
      workspaceId,
      filters: {
        type: filters.type,
        authorId: filters.authorId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      },
    },
    { enabled: debouncedQuery.length > 0 },
  );

  const { data: recentPages } = trpc.search.recent.useQuery(
    { workspaceId },
    { enabled: debouncedQuery.length === 0 },
  );

  const navigateToPage = useCallback(
    (pageId: string) => {
      router.push(`/${workspaceId}/${pageId}`);
    },
    [router, workspaceId],
  );

  const displayResults = debouncedQuery.length > 0 ? searchResults?.items : recentPages;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Search header */}
      <div className="mb-6">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border-default)",
          }}
        >
          <Search size={20} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, databases, and content..."
            className="flex-1 bg-transparent outline-none text-base"
            style={{ color: "var(--text-primary)" }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setDebouncedQuery(""); }}
              className="p-1 rounded hover:bg-notion-bg-hover"
              style={{ color: "var(--text-tertiary)" }}
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-1.5 rounded hover:bg-notion-bg-hover"
            style={{ color: showFilters ? "#2383e2" : "var(--text-tertiary)" }}
          >
            <Filter size={16} />
          </button>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div
            className="flex flex-wrap items-center gap-3 mt-3 px-4 py-3 rounded-lg border"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border-default)",
            }}
          >
            {/* Type filter */}
            <div className="flex items-center gap-1.5">
              <FileText size={14} style={{ color: "var(--text-tertiary)" }} />
              <select
                value={filters.type}
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value as FilterState["type"] }))}
                className="text-sm bg-transparent outline-none cursor-pointer"
                style={{ color: "var(--text-primary)" }}
              >
                <option value="all">All types</option>
                <option value="page">Pages only</option>
                <option value="database">Databases only</option>
              </select>
            </div>

            {/* Author filter */}
            <div className="flex items-center gap-1.5">
              <User size={14} style={{ color: "var(--text-tertiary)" }} />
              <select
                value={filters.authorId ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    authorId: e.target.value || null,
                  }))
                }
                className="text-sm bg-transparent outline-none cursor-pointer"
                style={{ color: "var(--text-primary)" }}
              >
                <option value="">Any author</option>
                {members?.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <Calendar size={14} style={{ color: "var(--text-tertiary)" }} />
              <input
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, dateFrom: e.target.value || null }))
                }
                className="text-sm bg-transparent outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              <span style={{ color: "var(--text-tertiary)" }}>~</span>
              <input
                type="date"
                value={filters.dateTo ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, dateTo: e.target.value || null }))
                }
                className="text-sm bg-transparent outline-none"
                style={{ color: "var(--text-primary)" }}
              />
            </div>

            {/* Clear filters */}
            <button
              onClick={() =>
                setFilters({ type: "all", authorId: null, dateFrom: null, dateTo: null })
              }
              className="text-xs px-2 py-1 rounded hover:bg-notion-bg-hover"
              style={{ color: "var(--text-tertiary)" }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div>
        {debouncedQuery.length === 0 && (
          <h3
            className="text-xs font-semibold uppercase mb-3 px-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            Recent Pages
          </h3>
        )}

        {isLoading && debouncedQuery.length > 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
          </div>
        )}

        {!isLoading && debouncedQuery.length > 0 && (!displayResults || displayResults.length === 0) && (
          <div className="text-center py-12" style={{ color: "var(--text-tertiary)" }}>
            <Search size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No results found for &quot;{debouncedQuery}&quot;</p>
          </div>
        )}

        {displayResults?.map((result) => (
          <button
            key={result.id}
            onClick={() => navigateToPage(result.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-notion-bg-hover text-left group transition-colors"
          >
            <span
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded text-lg"
              style={{ backgroundColor: "var(--bg-secondary)" }}
            >
              {result.icon || <FileText size={16} style={{ color: "var(--text-tertiary)" }} />}
            </span>
            <div className="flex-1 min-w-0">
              <div
                className="text-sm font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {result.title || "Untitled"}
              </div>
              <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {new Date(result.updatedAt).toLocaleDateString()}
                {"matchSource" in result && result.matchSource === "content" && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    content match
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}

        {/* Load more */}
        {searchResults?.nextCursor !== null && searchResults?.nextCursor !== undefined && (
          <div className="text-center py-4">
            <button
              className="text-sm px-4 py-1.5 rounded hover:bg-notion-bg-hover"
              style={{ color: "#2383e2" }}
            >
              Load more results
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations/20260402_add_tsvector_index/migration.sql src/server/routers/search.ts src/app/\(main\)/\[workspaceId\]/search/page.tsx
git commit -m "feat: add full search page with tsvector index and faceted filters"
```

---

### Task 2: Graph View
**Files:**
- Modify: `src/server/routers/search.ts`
- Create: `src/app/(main)/[workspaceId]/graph/page.tsx`

- [ ] **Step 1: Add getPageGraph tRPC procedure**

In `src/server/routers/search.ts`, add after the `fullSearch` procedure (before the closing `});`):

```typescript
  getPageGraph: protectedProcedure
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

      // Get all pages as nodes
      const pages = await ctx.db.page.findMany({
        where: { workspaceId: input.workspaceId, isDeleted: false },
        select: {
          id: true,
          title: true,
          icon: true,
          parentId: true,
          updatedAt: true,
        },
      });

      // Build nodes
      const nodes = pages.map((p) => ({
        id: p.id,
        title: p.title || "Untitled",
        icon: p.icon,
        updatedAt: p.updatedAt,
      }));

      // Build edges from parent-child relationships
      const edges: { source: string; target: string; type: "parent" }[] = [];
      for (const p of pages) {
        if (p.parentId && pages.some((n) => n.id === p.parentId)) {
          edges.push({ source: p.parentId, target: p.id, type: "parent" });
        }
      }

      // Also find mention links (link-to-page blocks)
      const linkBlocks = await ctx.db.block.findMany({
        where: {
          page: { workspaceId: input.workspaceId, isDeleted: false },
          type: { in: ["linkToPage", "mention"] },
        },
        select: { pageId: true, content: true },
      });

      const pageIdSet = new Set(pages.map((p) => p.id));
      for (const block of linkBlocks) {
        const content = block.content as Record<string, unknown>;
        const targetId = (content.pageId as string) || (content.targetId as string);
        if (targetId && pageIdSet.has(targetId) && targetId !== block.pageId) {
          edges.push({ source: block.pageId, target: targetId, type: "parent" });
        }
      }

      return { nodes, edges };
    }),
```

- [ ] **Step 2: Install d3-force**

```bash
npm install d3-force d3-selection d3-zoom
npm install -D @types/d3-force @types/d3-selection @types/d3-zoom
```

- [ ] **Step 3: Create the graph view page**

Create `src/app/(main)/[workspaceId]/graph/page.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type D3ZoomEvent } from "d3-zoom";
import { Loader2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

type GraphNode = SimulationNodeDatum & {
  id: string;
  title: string;
  icon: string | null;
};

type GraphLink = SimulationLinkDatum<GraphNode> & {
  source: string | GraphNode;
  target: string | GraphNode;
};

export default function GraphPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const { data: graphData, isLoading } = trpc.search.getPageGraph.useQuery(
    { workspaceId },
    { enabled: !!workspaceId },
  );

  // Measure container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // D3 simulation
  useEffect(() => {
    if (!graphData || !svgRef.current) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;

    const nodes: GraphNode[] = graphData.nodes.map((n) => ({
      ...n,
      x: Math.random() * width,
      y: Math.random() * height,
    }));

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const links: GraphLink[] = graphData.edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));

    // Zoom behavior
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        container.attr("transform", event.transform.toString());
      });

    svg.call(zoomBehavior);

    const container = svg.append("g");

    // Links
    const linkSelection = container
      .append("g")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "var(--border-default)")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.6);

    // Nodes
    const nodeGroup = container
      .append("g")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .style("cursor", "pointer")
      .on("click", (_event, d) => {
        router.push(`/${workspaceId}/${d.id}`);
      })
      .on("mouseenter", (_event, d) => {
        setHoveredNode(d.id);
      })
      .on("mouseleave", () => {
        setHoveredNode(null);
      });

    // Node circles
    nodeGroup
      .append("circle")
      .attr("r", 8)
      .attr("fill", "#2383e2")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Node labels
    nodeGroup
      .append("text")
      .text((d) => d.title.length > 20 ? d.title.slice(0, 20) + "..." : d.title)
      .attr("x", 14)
      .attr("y", 4)
      .attr("font-size", "11px")
      .attr("fill", "var(--text-primary)")
      .attr("pointer-events", "none");

    // Simulation
    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(100),
      )
      .force("charge", forceManyBody().strength(-200))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide(30))
      .on("tick", () => {
        linkSelection
          .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
          .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
          .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
          .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

        nodeGroup.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    // Drag behavior
    nodeGroup.call(
      // @ts-expect-error d3 drag typing
      select(svgRef.current).call(() => {}).selection as never,
    );

    return () => {
      simulation.stop();
    };
  }, [graphData, dimensions, workspaceId, router]);

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    const zoomBehavior = zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]);
    svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.5);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    const zoomBehavior = zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]);
    svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.67);
  }, []);

  const handleResetZoom = useCallback(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    const zoomBehavior = zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]);
    svg.transition().duration(300).call(zoomBehavior.transform, zoomIdentity);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      {/* Zoom controls */}
      <div
        className="absolute top-4 right-4 flex flex-col gap-1 rounded-lg p-1 z-10"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-popup)",
        }}
      >
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
          title="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
          title="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={handleResetZoom}
          className="p-1.5 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
          title="Reset zoom"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Stats */}
      <div
        className="absolute bottom-4 left-4 text-xs px-3 py-1.5 rounded-lg z-10"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-default)",
          color: "var(--text-tertiary)",
        }}
      >
        {graphData?.nodes.length ?? 0} pages &middot; {graphData?.edges.length ?? 0} links
      </div>

      {/* Tooltip */}
      {hoveredNode && graphData && (
        <div
          className="absolute top-4 left-4 px-3 py-2 rounded-lg text-sm z-10"
          style={{
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-popup)",
            color: "var(--text-primary)",
          }}
        >
          {graphData.nodes.find((n) => n.id === hoveredNode)?.title ?? "Untitled"}
        </div>
      )}

      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ backgroundColor: "var(--bg-primary)" }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/search.ts src/app/\(main\)/\[workspaceId\]/graph/page.tsx package.json package-lock.json
git commit -m "feat: add graph view with d3-force page relationship visualization"
```

---

### Task 3: Tabs / Split View
**Files:**
- Create: `src/stores/tabs.ts`
- Create: `src/components/layout/tab-bar.tsx`
- Create: `src/components/layout/split-view.tsx`
- Modify: `src/app/(main)/layout.tsx`

- [ ] **Step 1: Create the tabs Zustand store**

Create `src/stores/tabs.ts`:

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Tab = {
  id: string;
  url: string;
  title: string;
  icon: string | null;
  isPinned: boolean;
};

export type SplitDirection = "horizontal" | "vertical";

type TabsStore = {
  tabs: Tab[];
  activeTabId: string | null;
  splitTabId: string | null; // the tab shown in the split pane
  splitDirection: SplitDirection;
  splitRatio: number; // 0-1, left/top pane ratio

  // Actions
  addTab: (url: string, title?: string, icon?: string | null) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Pick<Tab, "title" | "icon" | "url">>) => void;
  pinTab: (id: string) => void;
  unpinTab: (id: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  // Split view
  openSplit: (tabId: string, direction?: SplitDirection) => void;
  closeSplit: () => void;
  setSplitRatio: (ratio: number) => void;
  setSplitDirection: (direction: SplitDirection) => void;
};

let nextId = 1;

export const useTabsStore = create<TabsStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      splitTabId: null,
      splitDirection: "horizontal",
      splitRatio: 0.5,

      addTab: (url, title = "Untitled", icon = null) => {
        const id = `tab-${Date.now()}-${nextId++}`;
        // Check if a tab with this URL already exists
        const existing = get().tabs.find((t) => t.url === url);
        if (existing) {
          set({ activeTabId: existing.id });
          return existing.id;
        }
        const tab: Tab = { id, url, title, icon, isPinned: false };
        set((state) => ({
          tabs: [...state.tabs, tab],
          activeTabId: id,
        }));
        return id;
      },

      closeTab: (id) => {
        set((state) => {
          const tab = state.tabs.find((t) => t.id === id);
          if (tab?.isPinned) return state; // can't close pinned tabs

          const newTabs = state.tabs.filter((t) => t.id !== id);
          let newActiveId = state.activeTabId;
          let newSplitId = state.splitTabId;

          if (state.activeTabId === id) {
            const closedIndex = state.tabs.findIndex((t) => t.id === id);
            const nextTab = newTabs[closedIndex] || newTabs[closedIndex - 1] || null;
            newActiveId = nextTab?.id ?? null;
          }

          if (state.splitTabId === id) {
            newSplitId = null;
          }

          return {
            tabs: newTabs,
            activeTabId: newActiveId,
            splitTabId: newSplitId,
          };
        });
      },

      setActiveTab: (id) => set({ activeTabId: id }),

      updateTab: (id, updates) => {
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
      },

      pinTab: (id) => {
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, isPinned: true } : t)),
        }));
      },

      unpinTab: (id) => {
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, isPinned: false } : t)),
        }));
      },

      reorderTabs: (fromIndex, toIndex) => {
        set((state) => {
          const newTabs = [...state.tabs];
          const [moved] = newTabs.splice(fromIndex, 1);
          if (moved) newTabs.splice(toIndex, 0, moved);
          return { tabs: newTabs };
        });
      },

      openSplit: (tabId, direction) => {
        set((state) => ({
          splitTabId: tabId,
          splitDirection: direction ?? state.splitDirection,
        }));
      },

      closeSplit: () => set({ splitTabId: null }),

      setSplitRatio: (ratio) => set({ splitRatio: Math.max(0.2, Math.min(0.8, ratio)) }),

      setSplitDirection: (direction) => set({ splitDirection: direction }),
    }),
    {
      name: "notion-tabs",
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        splitDirection: state.splitDirection,
      }),
    },
  ),
);
```

- [ ] **Step 2: Create the TabBar component**

Create `src/components/layout/tab-bar.tsx`:

```tsx
"use client";

import { useCallback, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X, Pin, SplitSquareHorizontal, FileText } from "lucide-react";
import { useTabsStore, type Tab } from "@/stores/tabs";

export function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const setActiveTab = useTabsStore((s) => s.setActiveTab);
  const closeTab = useTabsStore((s) => s.closeTab);
  const pinTab = useTabsStore((s) => s.pinTab);
  const unpinTab = useTabsStore((s) => s.unpinTab);
  const openSplit = useTabsStore((s) => s.openSplit);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const handleTabClick = useCallback(
    (tab: Tab) => {
      setActiveTab(tab.id);
      router.push(tab.url);
    },
    [setActiveTab, router],
  );

  const handleTabClose = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      closeTab(tabId);
    },
    [closeTab],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  }, []);

  if (tabs.length === 0) return null;

  return (
    <div
      ref={tabBarRef}
      className="flex items-center h-9 overflow-x-auto border-b"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-divider)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            className="group flex items-center gap-1.5 px-3 h-full text-xs min-w-0 max-w-[180px] border-r relative shrink-0"
            style={{
              backgroundColor: isActive ? "var(--bg-primary)" : "var(--bg-secondary)",
              borderColor: "var(--border-divider)",
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              borderBottom: isActive ? "2px solid #2383e2" : "2px solid transparent",
            }}
          >
            {tab.isPinned && <Pin size={10} style={{ color: "var(--text-tertiary)" }} />}
            <span className="flex-shrink-0">
              {tab.icon || <FileText size={12} />}
            </span>
            <span className="truncate">{tab.title || "Untitled"}</span>
            {!tab.isPinned && (
              <span
                onClick={(e) => handleTabClose(e, tab.id)}
                className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-notion-bg-hover"
                style={{ color: "var(--text-tertiary)" }}
              >
                <X size={12} />
              </span>
            )}
          </button>
        );
      })}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 rounded-lg py-1 min-w-[160px]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              backgroundColor: "var(--bg-primary)",
              boxShadow: "var(--shadow-popup)",
              border: "1px solid var(--border-default)",
            }}
          >
            {(() => {
              const tab = tabs.find((t) => t.id === contextMenu.tabId);
              if (!tab) return null;
              return (
                <>
                  <button
                    onClick={() => {
                      tab.isPinned ? unpinTab(tab.id) : pinTab(tab.id);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-notion-bg-hover"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <Pin size={12} />
                    {tab.isPinned ? "Unpin tab" : "Pin tab"}
                  </button>
                  <button
                    onClick={() => {
                      openSplit(tab.id);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-notion-bg-hover"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <SplitSquareHorizontal size={12} />
                    Open in split view
                  </button>
                  {!tab.isPinned && (
                    <button
                      onClick={() => {
                        closeTab(tab.id);
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-notion-bg-hover"
                      style={{ color: "#eb5757" }}
                    >
                      <X size={12} />
                      Close tab
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the SplitView component**

Create `src/components/layout/split-view.tsx`:

```tsx
"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { useTabsStore } from "@/stores/tabs";
import { X } from "lucide-react";

export function SplitView({ children }: { children: ReactNode }) {
  const splitTabId = useTabsStore((s) => s.splitTabId);
  const splitDirection = useTabsStore((s) => s.splitDirection);
  const splitRatio = useTabsStore((s) => s.splitRatio);
  const setSplitRatio = useTabsStore((s) => s.setSplitRatio);
  const closeSplit = useTabsStore((s) => s.closeSplit);
  const tabs = useTabsStore((s) => s.tabs);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const splitTab = tabs.find((t) => t.id === splitTabId);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        let ratio: number;
        if (splitDirection === "horizontal") {
          ratio = (moveEvent.clientX - rect.left) / rect.width;
        } else {
          ratio = (moveEvent.clientY - rect.top) / rect.height;
        }
        setSplitRatio(ratio);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [splitDirection, setSplitRatio],
  );

  if (!splitTab) {
    return <>{children}</>;
  }

  const isHorizontal = splitDirection === "horizontal";
  const primarySize = `${splitRatio * 100}%`;
  const secondarySize = `${(1 - splitRatio) * 100}%`;

  return (
    <div
      ref={containerRef}
      className="flex h-full"
      style={{
        flexDirection: isHorizontal ? "row" : "column",
        userSelect: isDragging ? "none" : "auto",
      }}
    >
      {/* Primary pane (current page) */}
      <div
        className="overflow-y-auto"
        style={{
          [isHorizontal ? "width" : "height"]: primarySize,
          flexShrink: 0,
        }}
      >
        {children}
      </div>

      {/* Divider */}
      <div
        onMouseDown={handleMouseDown}
        className="flex-shrink-0 relative group"
        style={{
          [isHorizontal ? "width" : "height"]: "4px",
          cursor: isHorizontal ? "col-resize" : "row-resize",
          backgroundColor: isDragging ? "#2383e2" : "var(--border-divider)",
          transition: isDragging ? "none" : "background-color 150ms",
        }}
      >
        <div
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            [isHorizontal ? "width" : "height"]: "12px",
            [isHorizontal ? "height" : "width"]: "100%",
            [isHorizontal ? "left" : "top"]: "-4px",
          }}
        />
      </div>

      {/* Secondary pane (split tab) */}
      <div
        className="overflow-y-auto relative"
        style={{
          [isHorizontal ? "width" : "height"]: secondarySize,
          flexShrink: 0,
        }}
      >
        {/* Close button for split */}
        <button
          onClick={closeSplit}
          className="absolute top-2 right-2 z-10 p-1 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-tertiary)" }}
          title="Close split view"
        >
          <X size={14} />
        </button>

        {/* Render split content via iframe for isolation */}
        <iframe
          src={splitTab.url}
          className="w-full h-full border-0"
          title={`Split view: ${splitTab.title}`}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Integrate TabBar and SplitView into main layout**

In `src/app/(main)/layout.tsx`, replace the entire file content:

```tsx
import { redirect } from "next/navigation";
import { getServerSession } from "@/server/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { QuickNoteButton } from "@/components/layout/quick-note-button";
import { TabBar } from "@/components/layout/tab-bar";
import { SplitView } from "@/components/layout/split-view";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Sidebar />
      <main id="main-content" role="main" aria-label="페이지 콘텐츠" className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <TabBar />
        <div className="flex-1 overflow-y-auto">
          <SplitView>{children}</SplitView>
        </div>
      </main>
      <CommandPalette />
      <QuickNoteButton />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/stores/tabs.ts src/components/layout/tab-bar.tsx src/components/layout/split-view.tsx src/app/\(main\)/layout.tsx
git commit -m "feat: add tabs/split-view system with Zustand store and resizable panes"
```

---

### Task 4: Navigation History UI
**Files:**
- Modify: `src/components/layout/topbar.tsx`

- [ ] **Step 1: Add navigation history dropdown to topbar**

The back/forward buttons already exist in `topbar.tsx` (lines 492-525). Add a history dropdown between the forward button and the breadcrumbs. In `src/components/layout/topbar.tsx`, add a new state variable after line 161 (`const [openDropdown, setOpenDropdown] = useState<string | null>(null);`):

```typescript
  const [showNavHistory, setShowNavHistory] = useState(false);
  const navHistoryRef = useRef<HTMLDivElement>(null);
```

Then add a click-outside handler after the existing `showMoreMenu` click-outside effect (after line 324):

```typescript
  // Close nav history on outside click
  useEffect(() => {
    if (!showNavHistory) return;
    const handler = (e: MouseEvent) => {
      if (navHistoryRef.current && !navHistoryRef.current.contains(e.target as Node)) {
        setShowNavHistory(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNavHistory]);
```

Then, after the forward button closing tag (after line 525, `{!isMobile && (` block for the forward button), add a history dropdown button:

```tsx
        {!isMobile && (
          <div className="relative" ref={navHistoryRef}>
            <button
              onClick={() => setShowNavHistory(!showNavHistory)}
              className="p-1 rounded hover:bg-notion-bg-hover flex-shrink-0"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Navigation history"
              title="Navigation history"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 3a5 5 0 100 10A5 5 0 008 3zM2 8a6 6 0 1112 0A6 6 0 012 8z" />
                <path d="M7.5 5v3.5H11v-1H8.5V5h-1z" />
              </svg>
            </button>
            {showNavHistory && (
              <div
                className="absolute left-0 top-full mt-1 rounded-lg overflow-hidden py-1"
                style={{
                  width: "280px",
                  maxHeight: "300px",
                  overflowY: "auto",
                  zIndex: 90,
                  backgroundColor: "var(--bg-primary)",
                  boxShadow: "var(--shadow-popup)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div
                  className="px-3 py-1.5 text-xs font-semibold uppercase"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  History
                </div>
                {navStore.history.length === 0 ? (
                  <div
                    className="px-3 py-2 text-xs"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    No history yet
                  </div>
                ) : (
                  [...navStore.history].reverse().map((url, idx) => {
                    const realIndex = navStore.history.length - 1 - idx;
                    const isCurrent = realIndex === navStore.currentIndex;
                    // Extract page name from URL
                    const segments = url.split("/").filter(Boolean);
                    const label = segments.length > 1 ? segments[segments.length - 1] : url;
                    return (
                      <button
                        key={`${url}-${idx}`}
                        onClick={() => {
                          router.push(url);
                          setShowNavHistory(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-notion-bg-hover text-left"
                        style={{
                          color: isCurrent ? "#2383e2" : "var(--text-primary)",
                          fontWeight: isCurrent ? 600 : 400,
                        }}
                      >
                        <span className="truncate">
                          {isCurrent && "→ "}
                          {label?.slice(0, 8) === label ? url : `.../${label}`}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/topbar.tsx
git commit -m "feat: add navigation history dropdown to topbar with visual current-page indicator"
```
