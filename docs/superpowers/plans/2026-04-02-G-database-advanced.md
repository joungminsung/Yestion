# Database Advanced Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add relation/rollup properties, linked databases, row templates, database locking, a full totals row, and multiline cell editing to bring the database feature to production parity with Notion.
**Architecture:** Relation and rollup properties extend the existing Property config JSON with cross-database references and aggregation logic computed server-side. Linked databases create a new block type that references an existing database. Row templates use a new Prisma model storing preset values. Database lock adds schema-level fields enforced in the tRPC router. Totals row extends the existing aggregation system in table-view.tsx.
**Tech Stack:** Prisma, PostgreSQL, tRPC, React 18, TipTap 2, @tanstack/react-virtual, Zustand, Tailwind CSS, lucide-react

---

### Task 1: Relation Property
**Files:**
- Create: `src/components/database/relation-cell-editor.tsx`
- Modify: `src/components/database/property-editor.tsx`
- Modify: `src/components/database/cell-editor.tsx`
- Modify: `src/components/database/cell-renderer.tsx`
- Modify: `src/server/routers/database.ts`

- [ ] **Step 1: Add relation procedures to database router**

In `src/server/routers/database.ts`, add the following procedures after the `queryRows` procedure (before the closing `});`):

```typescript
  // ── Relations ────────────────────────────────────────────

  searchRelationRows: protectedProcedure
    .input(
      z.object({
        databaseId: z.string(),
        query: z.string().default(""),
        limit: z.number().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifyDatabaseAccess(ctx.db, ctx.session.user.id, input.databaseId);

      const rows = await ctx.db.row.findMany({
        where: {
          databaseId: input.databaseId,
          page: {
            isDeleted: false,
            ...(input.query
              ? { title: { contains: input.query, mode: "insensitive" } }
              : {}),
          },
        },
        include: {
          page: { select: { id: true, title: true, icon: true } },
        },
        take: input.limit,
        orderBy: { createdAt: "desc" },
      });

      return rows.map((r) => ({
        rowId: r.id,
        pageId: r.page.id,
        title: r.page.title || "Untitled",
        icon: r.page.icon,
      }));
    }),

  getRelatedRows: protectedProcedure
    .input(
      z.object({
        rowIds: z.array(z.string()),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.rowIds.length === 0) return [];

      const rows = await ctx.db.row.findMany({
        where: { id: { in: input.rowIds } },
        include: {
          page: { select: { id: true, title: true, icon: true } },
        },
      });

      return rows.map((r) => ({
        rowId: r.id,
        pageId: r.page.id,
        title: r.page.title || "Untitled",
        icon: r.page.icon,
      }));
    }),
```

- [ ] **Step 2: Create the relation cell editor**

Create `src/components/database/relation-cell-editor.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, FileText, Plus, Loader2 } from "lucide-react";
import { trpc } from "@/server/trpc/client";

type RelationCellEditorProps = {
  databaseId: string; // target database ID
  value: string[]; // array of related row IDs
  onChange: (value: string[]) => void;
  onClose: () => void;
};

export function RelationCellEditor({
  databaseId,
  value,
  onChange,
  onClose,
}: RelationCellEditorProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Search rows in target database
  const { data: searchResults, isLoading } = trpc.database.searchRelationRows.useQuery(
    { databaseId, query: debouncedQuery },
    { enabled: !!databaseId },
  );

  // Fetch currently related rows
  const { data: relatedRows } = trpc.database.getRelatedRows.useQuery(
    { rowIds: value },
    { enabled: value.length > 0 },
  );

  const handleAdd = useCallback(
    (rowId: string) => {
      if (!value.includes(rowId)) {
        onChange([...value, rowId]);
      }
    },
    [value, onChange],
  );

  const handleRemove = useCallback(
    (rowId: string) => {
      onChange(value.filter((id) => id !== rowId));
    },
    [value, onChange],
  );

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 w-[300px] rounded-lg overflow-hidden"
      style={{
        backgroundColor: "var(--bg-primary)",
        boxShadow: "var(--shadow-popup)",
        border: "1px solid var(--border-default)",
      }}
    >
      {/* Selected items */}
      {relatedRows && relatedRows.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pt-3 pb-1">
          {relatedRows.map((row) => (
            <span
              key={row.rowId}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
              }}
            >
              {row.icon || <FileText size={10} />}
              <span className="max-w-[120px] truncate">{row.title}</span>
              <button
                onClick={() => handleRemove(row.rowId)}
                className="p-0.5 rounded hover:bg-notion-bg-hover"
                style={{ color: "var(--text-tertiary)" }}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--border-divider)" }}>
        <Search size={14} style={{ color: "var(--text-tertiary)" }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search rows..."
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: "var(--text-primary)" }}
        />
      </div>

      {/* Results */}
      <div className="max-h-[200px] overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
          </div>
        )}

        {searchResults?.map((row) => {
          const isSelected = value.includes(row.rowId);
          return (
            <button
              key={row.rowId}
              onClick={() => (isSelected ? handleRemove(row.rowId) : handleAdd(row.rowId))}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-notion-bg-hover text-left"
              style={{
                color: "var(--text-primary)",
                backgroundColor: isSelected ? "var(--bg-secondary)" : "transparent",
              }}
            >
              <span className="flex-shrink-0">
                {row.icon || <FileText size={14} style={{ color: "var(--text-tertiary)" }} />}
              </span>
              <span className="truncate flex-1">{row.title}</span>
              {isSelected && (
                <span className="text-xs" style={{ color: "#2383e2" }}>Selected</span>
              )}
            </button>
          );
        })}

        {searchResults?.length === 0 && !isLoading && (
          <div className="text-center py-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
            No rows found
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add relation config to property editor**

In `src/components/database/property-editor.tsx`, find the section where property type-specific config is rendered (after `handleTypeChange`). Add a relation config section. After the formula editor conditional rendering, add:

```tsx
      {/* Relation config */}
      {type === "relation" && (
        <div className="mt-3 space-y-2">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Related Database
          </label>
          <input
            type="text"
            value={(config.relatedDatabaseId as string) || ""}
            onChange={(e) =>
              setConfig({ ...config, relatedDatabaseId: e.target.value })
            }
            placeholder="Enter database ID..."
            className="w-full px-2 py-1.5 rounded border text-sm bg-transparent outline-none"
            style={{
              color: "var(--text-primary)",
              borderColor: "var(--border-default)",
            }}
          />
          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            Paste the target database ID to create a relation
          </p>
        </div>
      )}
```

- [ ] **Step 4: Wire relation cell editor in cell-editor.tsx**

In `src/components/database/cell-editor.tsx`, add the import for RelationCellEditor:

```typescript
import { RelationCellEditor } from "./relation-cell-editor";
```

Then add a case in the cell editor switch (find where property types are handled) for the `relation` type:

```tsx
      case "relation": {
        const relatedDbId = property.config?.relatedDatabaseId || property.config?.relationDbId || "";
        const currentValue = Array.isArray(value) ? value : [];
        return (
          <RelationCellEditor
            databaseId={relatedDbId}
            value={currentValue}
            onChange={(newValue) => onSave(newValue)}
            onClose={onClose}
          />
        );
      }
```

- [ ] **Step 5: Wire relation cell renderer in cell-renderer.tsx**

In `src/components/database/cell-renderer.tsx`, add a case for displaying relation values:

```tsx
      case "relation": {
        const rowIds = Array.isArray(value) ? value : [];
        if (rowIds.length === 0) return <span style={{ color: "var(--text-tertiary)" }}>Empty</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {rowIds.map((id: string) => (
              <span
                key={id}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs"
                style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}
              >
                {id.slice(0, 8)}...
              </span>
            ))}
          </div>
        );
      }
```

- [ ] **Step 6: Commit**

```bash
git add src/components/database/relation-cell-editor.tsx src/components/database/property-editor.tsx src/components/database/cell-editor.tsx src/components/database/cell-renderer.tsx src/server/routers/database.ts
git commit -m "feat: add relation property with cross-database row search and multi-select UI"
```

---

### Task 2: Rollup Property
**Files:**
- Modify: `src/server/routers/database.ts`
- Create: `src/components/database/rollup-cell-renderer.tsx`
- Modify: `src/components/database/property-editor.tsx`
- Modify: `src/components/database/cell-renderer.tsx`

- [ ] **Step 1: Add rollup calculation procedure to database router**

In `src/server/routers/database.ts`, add after the `getRelatedRows` procedure:

```typescript
  computeRollup: protectedProcedure
    .input(
      z.object({
        rowId: z.string(),
        relationPropertyId: z.string(), // the relation property on this DB
        targetPropertyId: z.string(), // the property on the target DB to aggregate
        rollupFunction: z.enum(["count", "sum", "average", "min", "max", "show_original"]),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Get the row
      const row = await ctx.db.row.findUnique({
        where: { id: input.rowId },
        include: { database: { include: { page: { select: { workspaceId: true } } } } },
      });
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Row not found" });
      }
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, row.database.page.workspaceId);

      // Get related row IDs from the relation property value
      const values = (row.values as Record<string, unknown>) ?? {};
      const relatedRowIds = values[input.relationPropertyId];
      if (!Array.isArray(relatedRowIds) || relatedRowIds.length === 0) {
        return { value: input.rollupFunction === "count" ? 0 : null, items: [] };
      }

      // Fetch related rows
      const relatedRows = await ctx.db.row.findMany({
        where: { id: { in: relatedRowIds } },
      });

      // Extract target property values
      const targetValues = relatedRows
        .map((r) => {
          const vals = (r.values as Record<string, unknown>) ?? {};
          return vals[input.targetPropertyId];
        })
        .filter((v) => v !== null && v !== undefined);

      const numericValues = targetValues
        .map((v) => (typeof v === "number" ? v : parseFloat(String(v))))
        .filter((n) => !isNaN(n));

      let result: unknown;
      switch (input.rollupFunction) {
        case "count":
          result = targetValues.length;
          break;
        case "sum":
          result = numericValues.reduce((a, b) => a + b, 0);
          break;
        case "average":
          result = numericValues.length > 0
            ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length
            : null;
          break;
        case "min":
          result = numericValues.length > 0 ? Math.min(...numericValues) : null;
          break;
        case "max":
          result = numericValues.length > 0 ? Math.max(...numericValues) : null;
          break;
        case "show_original":
          result = targetValues;
          break;
      }

      return { value: result, items: targetValues };
    }),
```

- [ ] **Step 2: Create rollup cell renderer**

Create `src/components/database/rollup-cell-renderer.tsx`:

```tsx
"use client";

import { trpc } from "@/server/trpc/client";
import { Loader2 } from "lucide-react";
import type { PropertyConfig } from "@/types/database";

type RollupCellRendererProps = {
  rowId: string;
  config: PropertyConfig;
};

export function RollupCellRenderer({ rowId, config }: RollupCellRendererProps) {
  const relationPropertyId = config.relationPropertyId || "";
  const targetPropertyId = config.targetPropertyId || config.rollupPropertyId || "";
  const rollupFunction = config.rollupFunction || "count";

  const { data, isLoading } = trpc.database.computeRollup.useQuery(
    {
      rowId,
      relationPropertyId,
      targetPropertyId,
      rollupFunction,
    },
    {
      enabled: !!relationPropertyId && !!targetPropertyId,
    },
  );

  if (!relationPropertyId || !targetPropertyId) {
    return (
      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        Configure rollup
      </span>
    );
  }

  if (isLoading) {
    return <Loader2 size={12} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />;
  }

  if (data === undefined || data.value === null) {
    return <span style={{ color: "var(--text-tertiary)" }}>-</span>;
  }

  if (rollupFunction === "show_original" && Array.isArray(data.value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {data.value.map((item, i) => (
          <span
            key={i}
            className="inline-flex px-1.5 py-0.5 rounded text-xs"
            style={{
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
            }}
          >
            {String(item)}
          </span>
        ))}
      </div>
    );
  }

  const displayValue =
    typeof data.value === "number"
      ? rollupFunction === "average"
        ? data.value.toFixed(2)
        : data.value.toLocaleString()
      : String(data.value);

  return (
    <span className="text-sm" style={{ color: "var(--text-primary)" }}>
      {displayValue}
    </span>
  );
}
```

- [ ] **Step 3: Add rollup config to property editor**

In `src/components/database/property-editor.tsx`, add after the relation config section:

```tsx
      {/* Rollup config */}
      {type === "rollup" && (
        <div className="mt-3 space-y-2">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Relation Property
          </label>
          <select
            value={(config.relationPropertyId as string) || ""}
            onChange={(e) =>
              setConfig({ ...config, relationPropertyId: e.target.value })
            }
            className="w-full px-2 py-1.5 rounded border text-sm bg-transparent outline-none"
            style={{
              color: "var(--text-primary)",
              borderColor: "var(--border-default)",
            }}
          >
            <option value="">Select relation...</option>
            {allProperties
              ?.filter((p) => p.type === "relation")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>

          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Target Property ID
          </label>
          <input
            type="text"
            value={(config.targetPropertyId as string) || ""}
            onChange={(e) =>
              setConfig({ ...config, targetPropertyId: e.target.value })
            }
            placeholder="Property ID from related database..."
            className="w-full px-2 py-1.5 rounded border text-sm bg-transparent outline-none"
            style={{
              color: "var(--text-primary)",
              borderColor: "var(--border-default)",
            }}
          />

          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Function
          </label>
          <select
            value={(config.rollupFunction as string) || "count"}
            onChange={(e) =>
              setConfig({
                ...config,
                rollupFunction: e.target.value as PropertyConfig["rollupFunction"],
              })
            }
            className="w-full px-2 py-1.5 rounded border text-sm bg-transparent outline-none"
            style={{
              color: "var(--text-primary)",
              borderColor: "var(--border-default)",
            }}
          >
            <option value="count">Count</option>
            <option value="sum">Sum</option>
            <option value="average">Average</option>
            <option value="min">Min</option>
            <option value="max">Max</option>
            <option value="show_original">Show original</option>
          </select>
        </div>
      )}
```

- [ ] **Step 4: Wire rollup renderer in cell-renderer.tsx**

In `src/components/database/cell-renderer.tsx`, add the import:

```typescript
import { RollupCellRenderer } from "./rollup-cell-renderer";
```

Then add a case for the `rollup` type:

```tsx
      case "rollup":
        return <RollupCellRenderer rowId={rowId} config={property.config} />;
```

Note: ensure `rowId` is available in the cell renderer props. If not, add it to the component props type.

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/database.ts src/components/database/rollup-cell-renderer.tsx src/components/database/property-editor.tsx src/components/database/cell-renderer.tsx
git commit -m "feat: add rollup property with server-side aggregation and 6 rollup functions"
```

---

### Task 3: Linked Databases
**Files:**
- Create: `src/components/editor/extensions/linked-database-block.ts`
- Create: `src/components/database/linked-database-view.tsx`
- Modify: `src/components/editor/slash-command/slash-items.tsx`

- [ ] **Step 1: Create the linked database block extension**

Create `src/components/editor/extensions/linked-database-block.ts`:

```typescript
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface LinkedDatabaseBlockOptions {
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    linkedDatabaseBlock: {
      insertLinkedDatabase: (attrs: { databaseId: string; viewId?: string }) => ReturnType;
    };
  }
}

export const LinkedDatabaseBlock = Node.create<LinkedDatabaseBlockOptions>({
  name: "linkedDatabase",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      databaseId: { default: null },
      viewId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="linked-database"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "linked-database",
      }),
    ];
  },

  addCommands() {
    return {
      insertLinkedDatabase:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
```

- [ ] **Step 2: Create the linked database view component**

Create `src/components/database/linked-database-view.tsx`:

```tsx
"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { Link as LinkIcon, ExternalLink, Loader2 } from "lucide-react";
import { useRouter, useParams } from "next/navigation";

type LinkedDatabaseViewProps = {
  databaseId: string;
  viewId?: string | null;
};

export function LinkedDatabaseView({ databaseId, viewId }: LinkedDatabaseViewProps) {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const { data: database, isLoading } = trpc.database.get.useQuery(
    { databaseId },
    { enabled: !!databaseId },
  );

  const { data: rows } = trpc.database.queryRows.useQuery(
    { databaseId },
    { enabled: !!databaseId },
  );

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-8 rounded-lg border my-2"
        style={{
          borderColor: "var(--border-default)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
      </div>
    );
  }

  if (!database) {
    return (
      <div
        className="flex items-center gap-2 py-4 px-4 rounded-lg border my-2 text-sm"
        style={{
          borderColor: "var(--border-default)",
          backgroundColor: "var(--bg-secondary)",
          color: "var(--text-tertiary)",
        }}
      >
        <LinkIcon size={14} />
        Database not found or deleted
      </div>
    );
  }

  const visibleProperties = database.properties.filter((p) => p.isVisible).slice(0, 5);

  return (
    <div
      className="my-2 rounded-lg border overflow-hidden"
      style={{
        borderColor: "var(--border-default)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{
          borderColor: "var(--border-divider)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <div className="flex items-center gap-2">
          <LinkIcon size={14} style={{ color: "#2383e2" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {database.page.title || "Untitled Database"}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: "rgba(35, 131, 226, 0.1)",
              color: "#2383e2",
            }}
          >
            Linked
          </span>
        </div>
        <button
          onClick={() => router.push(`/${workspaceId}/${database.page.id}`)}
          className="p-1 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-tertiary)" }}
          title="Open original database"
        >
          <ExternalLink size={14} />
        </button>
      </div>

      {/* Simple table preview */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderBottom: "1px solid var(--border-divider)",
              }}
            >
              {visibleProperties.map((prop) => (
                <th
                  key={prop.id}
                  className="px-3 py-1.5 text-left text-xs font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {prop.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows?.slice(0, 10).map((row) => {
              const values = (row.values as Record<string, unknown>) ?? {};
              return (
                <tr
                  key={row.id}
                  className="hover:bg-notion-bg-hover cursor-pointer"
                  style={{ borderBottom: "1px solid var(--border-divider)" }}
                  onClick={() => router.push(`/${workspaceId}/${row.page.id}`)}
                >
                  {visibleProperties.map((prop) => (
                    <td
                      key={prop.id}
                      className="px-3 py-2 text-sm"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {prop.type === "title"
                        ? row.page.title || "Untitled"
                        : values[prop.id] !== undefined
                          ? String(values[prop.id])
                          : ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows && rows.length > 10 && (
        <div
          className="text-center py-2 text-xs border-t"
          style={{
            borderColor: "var(--border-divider)",
            color: "var(--text-tertiary)",
          }}
        >
          +{rows.length - 10} more rows
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add linked database to slash items**

In `src/components/editor/slash-command/slash-items.tsx`, add a new slash item in the `SLASH_ITEMS` array. Add before the last item:

```typescript
  {
    title: "Linked Database",
    description: "Insert a linked view of an existing database.",
    icon: <Database size={18} />,
    category: "데이터베이스",
    keywords: ["linked", "database", "view", "링크", "데이터베이스"],
    command: (editor) => {
      const databaseId = window.prompt("Enter database ID to link:");
      if (databaseId) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "linkedDatabase",
            attrs: { databaseId },
          })
          .run();
      }
    },
  },
```

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/extensions/linked-database-block.ts src/components/database/linked-database-view.tsx src/components/editor/slash-command/slash-items.tsx
git commit -m "feat: add linked database block with preview table and slash command insertion"
```

---

### Task 4: Row Templates
**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/components/database/row-template-manager.tsx`
- Modify: `src/server/routers/database.ts`

- [ ] **Step 1: Add RowTemplate Prisma model**

In `prisma/schema.prisma`, add after the Row model (after line 225):

```prisma
model RowTemplate {
  id         String   @id @default(cuid())
  databaseId String
  name       String
  icon       String?
  values     Json     @default("{}")
  position   Int      @default(0)
  createdBy  String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  database Database @relation(fields: [databaseId], references: [id], onDelete: Cascade)

  @@index([databaseId])
}
```

Also add the relation to the Database model. In the Database model, add before `@@index([pageId])`:

```prisma
  rowTemplates RowTemplate[]
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_row_template_model
```

- [ ] **Step 3: Add row template procedures to database router**

In `src/server/routers/database.ts`, add after the `computeRollup` procedure:

```typescript
  // ── Row Templates ─────────────────────────────────────────

  listRowTemplates: protectedProcedure
    .input(z.object({ databaseId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyDatabaseAccess(ctx.db, ctx.session.user.id, input.databaseId);
      return ctx.db.rowTemplate.findMany({
        where: { databaseId: input.databaseId },
        orderBy: { position: "asc" },
      });
    }),

  createRowTemplate: protectedProcedure
    .input(
      z.object({
        databaseId: z.string(),
        name: z.string().min(1),
        icon: z.string().nullish(),
        values: z.record(z.string(), z.any()).default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyDatabaseAccess(ctx.db, ctx.session.user.id, input.databaseId);

      const last = await ctx.db.rowTemplate.findFirst({
        where: { databaseId: input.databaseId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const position = (last?.position ?? -1) + 1;

      return ctx.db.rowTemplate.create({
        data: {
          databaseId: input.databaseId,
          name: input.name,
          icon: input.icon ?? null,
          values: input.values as Prisma.InputJsonValue,
          position,
          createdBy: ctx.session.user.id,
        },
      });
    }),

  updateRowTemplate: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        icon: z.string().nullish(),
        values: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.rowTemplate.findUnique({
        where: { id: input.id },
        include: { database: { include: { page: { select: { workspaceId: true } } } } },
      });
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, template.database.page.workspaceId);

      const { id, ...data } = input;
      return ctx.db.rowTemplate.update({
        where: { id },
        data: {
          ...data,
          values: data.values ? (data.values as Prisma.InputJsonValue) : undefined,
        },
      });
    }),

  deleteRowTemplate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.rowTemplate.findUnique({
        where: { id: input.id },
        include: { database: { include: { page: { select: { workspaceId: true } } } } },
      });
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, template.database.page.workspaceId);
      return ctx.db.rowTemplate.delete({ where: { id: input.id } });
    }),

  addRowFromTemplate: protectedProcedure
    .input(
      z.object({
        databaseId: z.string(),
        templateId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const database = await verifyDatabaseAccess(ctx.db, ctx.session.user.id, input.databaseId);
      const template = await ctx.db.rowTemplate.findUnique({
        where: { id: input.templateId },
      });
      if (!template || template.databaseId !== input.databaseId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      const templateValues = (template.values as Record<string, unknown>) ?? {};

      // Find title property to derive page title
      const titleProp = await ctx.db.property.findFirst({
        where: { databaseId: input.databaseId, type: "title" },
      });
      const pageTitle = titleProp && templateValues[titleProp.id]
        ? String(templateValues[titleProp.id])
        : template.name;

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
          values: templateValues as Prisma.InputJsonValue,
        },
        include: {
          page: { select: { id: true, title: true, icon: true } },
        },
      });
    }),
```

- [ ] **Step 4: Create the row template manager component**

Create `src/components/database/row-template-manager.tsx`:

```tsx
"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { Plus, Trash2, FileText, Edit3, X, ChevronDown } from "lucide-react";
import type { DatabaseData, PropertyConfig } from "@/types/database";

type RowTemplateManagerProps = {
  databaseId: string;
  properties: DatabaseData["properties"];
  onAddRowFromTemplate: (templateId: string) => void;
};

export function RowTemplateManager({
  databaseId,
  properties,
  onAddRowFromTemplate,
}: RowTemplateManagerProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValues, setNewValues] = useState<Record<string, unknown>>({});

  const utils = trpc.useUtils();

  const { data: templates } = trpc.database.listRowTemplates.useQuery(
    { databaseId },
    { enabled: !!databaseId },
  );

  const createTemplate = trpc.database.createRowTemplate.useMutation({
    onSuccess: () => {
      utils.database.listRowTemplates.invalidate();
      setShowCreate(false);
      setNewName("");
      setNewValues({});
    },
  });

  const deleteTemplate = trpc.database.deleteRowTemplate.useMutation({
    onSuccess: () => utils.database.listRowTemplates.invalidate(),
  });

  const editableProperties = properties.filter(
    (p) =>
      !["created_time", "created_by", "last_edited_time", "last_edited_by", "formula", "rollup"].includes(
        p.type,
      ),
  );

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-notion-bg-hover"
        style={{ color: "var(--text-secondary)" }}
      >
        <ChevronDown size={12} />
        Templates
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div
            className="absolute right-0 top-full mt-1 w-[260px] rounded-lg z-50 py-1"
            style={{
              backgroundColor: "var(--bg-primary)",
              boxShadow: "var(--shadow-popup)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div
              className="px-3 py-1.5 text-[10px] uppercase font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              Row Templates
            </div>

            {templates?.map((template) => (
              <div
                key={template.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-notion-bg-hover group"
              >
                <button
                  onClick={() => {
                    onAddRowFromTemplate(template.id);
                    setShowDropdown(false);
                  }}
                  className="flex items-center gap-2 flex-1 text-sm text-left"
                  style={{ color: "var(--text-primary)" }}
                >
                  <span>{template.icon || <FileText size={14} />}</span>
                  <span className="truncate">{template.name}</span>
                </button>
                <button
                  onClick={() => deleteTemplate.mutate({ id: template.id })}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-notion-bg-hover"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {(!templates || templates.length === 0) && (
              <div className="px-3 py-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                No templates yet
              </div>
            )}

            <div className="mx-2 my-1" style={{ height: "1px", backgroundColor: "var(--border-divider)" }} />

            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-notion-bg-hover"
                style={{ color: "#2383e2" }}
              >
                <Plus size={12} />
                Create template
              </button>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Template name..."
                    className="flex-1 text-xs bg-transparent outline-none px-2 py-1 rounded border"
                    style={{
                      color: "var(--text-primary)",
                      borderColor: "var(--border-default)",
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => setShowCreate(false)}
                    className="p-1 rounded hover:bg-notion-bg-hover"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Property value inputs */}
                {editableProperties.slice(0, 5).map((prop) => (
                  <div key={prop.id}>
                    <label className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                      {prop.name}
                    </label>
                    <input
                      type={prop.type === "number" ? "number" : "text"}
                      value={String(newValues[prop.id] ?? "")}
                      onChange={(e) =>
                        setNewValues((prev) => ({
                          ...prev,
                          [prop.id]:
                            prop.type === "number"
                              ? Number(e.target.value) || 0
                              : e.target.value,
                        }))
                      }
                      className="w-full text-xs bg-transparent outline-none px-2 py-1 rounded border"
                      style={{
                        color: "var(--text-primary)",
                        borderColor: "var(--border-default)",
                      }}
                    />
                  </div>
                ))}

                <button
                  onClick={() =>
                    createTemplate.mutate({
                      databaseId,
                      name: newName || "Untitled template",
                      values: newValues,
                    })
                  }
                  disabled={createTemplate.isPending}
                  className="w-full text-xs px-2 py-1.5 rounded text-white"
                  style={{ backgroundColor: "#2383e2" }}
                >
                  Save template
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/server/routers/database.ts src/components/database/row-template-manager.tsx
git commit -m "feat: add row templates with CRUD, preset values, and template-based row creation"
```

---

### Task 5: Database Lock
**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/server/routers/database.ts`
- Modify: `src/components/database/database-toolbar.tsx`

- [ ] **Step 1: Add lock fields to Database model**

In `prisma/schema.prisma`, in the Database model, add after `updatedAt`:

```prisma
  isLocked    Boolean  @default(false)
  lockedBy    String?
  lockedAt    DateTime?
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_database_lock_fields
```

- [ ] **Step 3: Add lock/unlock procedures to database router**

In `src/server/routers/database.ts`, add after the `addRowFromTemplate` procedure:

```typescript
  // ── Database Lock ──────────────────────────────────────────

  toggleLock: protectedProcedure
    .input(z.object({ databaseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const database = await verifyDatabaseAccess(ctx.db, ctx.session.user.id, input.databaseId);

      // If locked by someone else, only admin/owner can unlock
      if (database.isLocked && database.lockedBy !== ctx.session.user.id) {
        const member = await ctx.db.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId: ctx.session.user.id,
              workspaceId: database.page.workspaceId,
            },
          },
        });
        if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the user who locked it or admins can unlock",
          });
        }
      }

      const newLocked = !database.isLocked;
      return ctx.db.database.update({
        where: { id: input.databaseId },
        data: {
          isLocked: newLocked,
          lockedBy: newLocked ? ctx.session.user.id : null,
          lockedAt: newLocked ? new Date() : null,
        },
      });
    }),
```

Also, add a guard in the `addRow`, `updateRow`, `deleteRow`, `addProperty`, `updateProperty`, and `deleteProperty` procedures. Add this helper function after the `verifyDatabaseAccess` function:

```typescript
async function checkDatabaseNotLocked(
  db: Context["db"],
  databaseId: string,
) {
  const database = await db.database.findUnique({
    where: { id: databaseId },
    select: { isLocked: true },
  });
  if (database?.isLocked) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This database is locked. Unlock it to make changes.",
    });
  }
}
```

Then add `await checkDatabaseNotLocked(ctx.db, input.databaseId);` at the start of `addRow`, `updateRow`, `addProperty`, `updateProperty`, and `deleteProperty` mutations (after the access check).

- [ ] **Step 4: Add lock toggle to database toolbar**

In `src/components/database/database-toolbar.tsx`, add a lock button. Import `Lock` and `Unlock` from lucide-react, and add the button in the toolbar:

```tsx
        {/* Database lock toggle */}
        <button
          onClick={() => toggleLock.mutate({ databaseId })}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-notion-bg-hover"
          style={{
            color: database?.isLocked ? "#eb5757" : "var(--text-secondary)",
          }}
          title={database?.isLocked ? "Unlock database" : "Lock database"}
        >
          {database?.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
          {database?.isLocked ? "Locked" : "Lock"}
        </button>
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/server/routers/database.ts src/components/database/database-toolbar.tsx
git commit -m "feat: add database lock with role-based unlock and mutation guards"
```

---

### Task 6: Totals Row
**Files:**
- Modify: `src/components/database/views/table-view.tsx`

- [ ] **Step 1: Expand aggregation options**

In `src/components/database/views/table-view.tsx`, replace the `AGGREGATION_OPTIONS` constant (lines 44-51) with the full set:

```typescript
const AGGREGATION_OPTIONS: { value: AggregationFunction; label: string }[] = [
  { value: "none", label: "None" },
  { value: "count", label: "Count" },
  { value: "count_values", label: "Count values" },
  { value: "count_unique", label: "Count unique" },
  { value: "count_empty", label: "Count empty" },
  { value: "count_not_empty", label: "Count not empty" },
  { value: "percent_empty", label: "Percent empty" },
  { value: "percent_not_empty", label: "Percent not empty" },
  { value: "sum", label: "Sum" },
  { value: "average", label: "Average" },
  { value: "median", label: "Median" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
  { value: "range", label: "Range" },
];
```

- [ ] **Step 2: Add aggregation compute function**

In `src/components/database/views/table-view.tsx`, add the following function before the `TableView` component:

```typescript
function computeAggregation(
  fn: AggregationFunction,
  rows: RowData[],
  propertyId: string,
): string {
  if (fn === "none") return "";

  const values = rows.map((r) => {
    const vals = (r.values as Record<string, unknown>) ?? {};
    return vals[propertyId];
  });

  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== "");
  const numericValues = nonEmpty
    .map((v) => (typeof v === "number" ? v : parseFloat(String(v))))
    .filter((n) => !isNaN(n));

  switch (fn) {
    case "count":
      return String(rows.length);
    case "count_values":
      return String(nonEmpty.length);
    case "count_unique":
      return String(new Set(nonEmpty.map(String)).size);
    case "count_empty":
      return String(values.length - nonEmpty.length);
    case "count_not_empty":
      return String(nonEmpty.length);
    case "percent_empty":
      return values.length > 0
        ? `${(((values.length - nonEmpty.length) / values.length) * 100).toFixed(1)}%`
        : "0%";
    case "percent_not_empty":
      return values.length > 0
        ? `${((nonEmpty.length / values.length) * 100).toFixed(1)}%`
        : "0%";
    case "sum":
      return numericValues.reduce((a, b) => a + b, 0).toLocaleString();
    case "average":
      return numericValues.length > 0
        ? (numericValues.reduce((a, b) => a + b, 0) / numericValues.length).toFixed(2)
        : "-";
    case "median": {
      if (numericValues.length === 0) return "-";
      const sorted = [...numericValues].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0
        ? String(sorted[mid])
        : ((sorted[mid - 1]! + sorted[mid]!) / 2).toFixed(2);
    }
    case "min":
      return numericValues.length > 0 ? String(Math.min(...numericValues)) : "-";
    case "max":
      return numericValues.length > 0 ? String(Math.max(...numericValues)) : "-";
    case "range":
      return numericValues.length > 0
        ? String(Math.max(...numericValues) - Math.min(...numericValues))
        : "-";
    default:
      return "";
  }
}
```

- [ ] **Step 3: Add totals row rendering in the table footer**

In the table JSX, after the rows list (after the "Add row" button row), add a totals row. Find the end of the table body rendering and add:

```tsx
          {/* Totals row */}
          <div
            className="flex items-center border-t"
            style={{
              borderColor: "var(--border-default)",
              backgroundColor: "var(--bg-secondary)",
              minHeight: "33px",
            }}
          >
            {/* Row number placeholder */}
            <div style={{ width: ROW_NUMBER_WIDTH, flexShrink: 0 }} />
            {/* Title column aggregation */}
            <div
              className="flex items-center px-2 text-xs font-medium"
              style={{
                width: TITLE_COLUMN_WIDTH,
                flexShrink: 0,
                color: "var(--text-tertiary)",
                borderRight: "1px solid var(--border-divider)",
              }}
            >
              {computeAggregation(
                (viewConfig.aggregations?.title as AggregationFunction) || "count",
                rows,
                properties.find((p) => p.type === "title")?.id || "",
              ) || `Count: ${rows.length}`}
            </div>
            {/* Other columns */}
            {properties
              .filter((p) => p.type !== "title" && p.isVisible)
              .map((prop) => {
                const aggFn =
                  (viewConfig.aggregations?.[prop.id] as AggregationFunction) || "none";
                const width = columnWidths[prop.id] || DEFAULT_COLUMN_WIDTH;
                return (
                  <div
                    key={prop.id}
                    className="relative group"
                    style={{
                      width,
                      flexShrink: 0,
                      borderRight: "1px solid var(--border-divider)",
                    }}
                  >
                    <button
                      onClick={() => {
                        // Cycle to next aggregation function
                        const currentIdx = AGGREGATION_OPTIONS.findIndex(
                          (o) => o.value === aggFn,
                        );
                        const nextIdx = (currentIdx + 1) % AGGREGATION_OPTIONS.length;
                        const nextFn = AGGREGATION_OPTIONS[nextIdx]!.value;
                        // This would need a callback to update viewConfig
                      }}
                      className="w-full h-full flex items-center px-2 text-xs hover:bg-notion-bg-hover"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {aggFn === "none" ? (
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                          Calculate
                        </span>
                      ) : (
                        <span>
                          {AGGREGATION_OPTIONS.find((o) => o.value === aggFn)?.label}:{" "}
                          <span style={{ color: "var(--text-primary)" }}>
                            {computeAggregation(aggFn, rows, prop.id)}
                          </span>
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
          </div>
```

- [ ] **Step 4: Update AggregationFunction type**

In `src/types/database.ts`, update the `AggregationFunction` type to include all new functions. Find the existing type and replace it with:

```typescript
export type AggregationFunction =
  | "none"
  | "count"
  | "count_values"
  | "count_unique"
  | "count_empty"
  | "count_not_empty"
  | "percent_empty"
  | "percent_not_empty"
  | "sum"
  | "average"
  | "median"
  | "min"
  | "max"
  | "range";
```

- [ ] **Step 5: Commit**

```bash
git add src/components/database/views/table-view.tsx src/types/database.ts
git commit -m "feat: add full totals row with 14 aggregation functions including median and range"
```

---

### Task 7: Multiline Cells
**Files:**
- Modify: `src/components/database/cell-editor.tsx`
- Modify: `src/components/database/views/table-view.tsx`

- [ ] **Step 1: Update text cell editor for multiline**

In `src/components/database/cell-editor.tsx`, find the text cell editor case (where type === "text" is handled). Replace the input with a textarea that supports Shift+Enter:

```tsx
      case "text": {
        return (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={String(localValue ?? "")}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSave(localValue);
                onClose();
              }
              if (e.key === "Escape") {
                onClose();
              }
              // Shift+Enter inserts a line break (default textarea behavior)
            }}
            onBlur={() => {
              onSave(localValue);
              onClose();
            }}
            className="w-full bg-transparent outline-none text-sm resize-none"
            style={{
              color: "var(--text-primary)",
              minHeight: "33px",
              maxHeight: "200px",
              overflow: "auto",
            }}
            rows={String(localValue ?? "").split("\n").length || 1}
            autoFocus
          />
        );
      }
```

- [ ] **Step 2: Add auto-grow height to table rows**

In `src/components/database/views/table-view.tsx`, find the row rendering section. Update the row height calculation to support auto height. Add the following logic inside the `TableView` component:

```typescript
  // Calculate auto row height based on content
  const getRowHeight = useCallback(
    (row: RowData): number => {
      const rowHeight = viewConfig.rowHeight || "short";
      if (rowHeight !== "auto") {
        return ROW_HEIGHT_MAP[rowHeight] || 33;
      }

      // Auto height: calculate based on content
      const values = (row.values as Record<string, unknown>) ?? {};
      let maxLines = 1;
      for (const prop of properties) {
        const val = values[prop.id];
        if (typeof val === "string") {
          const lines = val.split("\n").length;
          if (lines > maxLines) maxLines = lines;
        }
      }
      return Math.max(33, maxLines * 22 + 11); // 22px per line + padding
    },
    [viewConfig.rowHeight, properties],
  );
```

Also update the `ROW_HEIGHT_MAP` to include a comment about auto mode:

```typescript
const ROW_HEIGHT_MAP: Record<Exclude<RowHeight, "auto">, number> = {
  short: 33,
  medium: 56,
  tall: 76,
  // "auto" is computed dynamically based on content
};
```

- [ ] **Step 3: Update RowHeight type to include auto**

In `src/types/database.ts`, find the `RowHeight` type and update it:

```typescript
export type RowHeight = "short" | "medium" | "tall" | "auto";
```

- [ ] **Step 4: Commit**

```bash
git add src/components/database/cell-editor.tsx src/components/database/views/table-view.tsx src/types/database.ts
git commit -m "feat: add multiline cells with Shift+Enter line breaks and auto-grow row height"
```
