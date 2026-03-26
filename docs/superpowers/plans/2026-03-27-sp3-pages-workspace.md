# SP-3: Pages & Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build complete page management — CRUD, nested page tree in sidebar, favorites, trash, page icons/covers, page lock/width, workspace switcher, and page templates.

**Architecture:** Expand the existing page tRPC router with full CRUD + favorites + trash operations. Build an interactive sidebar with a recursive page tree component. Add page header UI (icon, cover, breadcrumb). Sidebar fetches page tree via tRPC and uses Zustand for expanded/collapsed state.

**Tech Stack:** tRPC (page router), Prisma (existing Page/Favorite models), Zustand (sidebar page tree state), React (recursive tree component, page header), next/navigation (routing)

---

## File Structure

```
src/
├── server/routers/
│   └── page.ts                         # Expand: full CRUD, favorites, trash, move, duplicate
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx                  # Rewrite: fetch real page tree, render sections
│   │   ├── sidebar-page-item.tsx        # New: recursive page tree item (expand/collapse, context menu)
│   │   ├── sidebar-favorites.tsx        # New: favorites section
│   │   ├── sidebar-trash.tsx            # New: trash panel (modal)
│   │   ├── workspace-switcher.tsx       # New: workspace dropdown
│   │   └── topbar.tsx                   # Modify: dynamic breadcrumb from page hierarchy
│   ├── page/
│   │   ├── page-header.tsx              # New: icon + cover + title area
│   │   ├── page-icon-picker.tsx         # New: emoji picker for page icon
│   │   ├── page-cover.tsx              # New: cover image with change/remove
│   │   ├── sub-pages-list.tsx          # New: child pages list at bottom
│   │   └── page-template-picker.tsx    # New: template selection on new page
│   └── editor/
│       └── page-editor.tsx              # Modify: respect page lock
├── stores/
│   └── page-tree.ts                    # New: expanded nodes, active page state
├── app/(main)/
│   └── [workspaceId]/
│       ├── page.tsx                    # Modify: redirect to first page or show empty state
│       └── [pageId]/
│           └── page.tsx                # Modify: use PageHeader component
tests/
└── server/routers/
    └── page.test.ts                    # New: comprehensive page router tests
```

---

## Task 1: Page Router — Full CRUD

**Files:**
- Modify: `src/server/routers/page.ts`
- Create: `tests/server/routers/page.test.ts`

- [ ] **Step 1: Write failing tests for page CRUD**

`tests/server/routers/page.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db/client";
import { appRouter } from "@/server/trpc/router";
import { createCallerFactory } from "@/server/trpc/init";
import bcrypt from "bcryptjs";

const createCaller = createCallerFactory(appRouter);

let userId: string;
let workspaceId: string;

async function setup() {
  const user = await db.user.create({
    data: { email: "page@test.com", name: "Page Tester", password: await bcrypt.hash("password123", 12) },
  });
  userId = user.id;
  const workspace = await db.workspace.create({
    data: { name: "Test WS", members: { create: { userId: user.id, role: "OWNER" } } },
  });
  workspaceId = workspace.id;
}

function getCaller() {
  return createCaller({ db, session: { user: { id: userId, email: "page@test.com", name: "Page Tester" } }, headers: new Headers() });
}

describe("page router", () => {
  beforeEach(async () => {
    await db.block.deleteMany();
    await db.favorite.deleteMany();
    await db.session.deleteMany();
    await db.page.deleteMany();
    await db.workspaceMember.deleteMany();
    await db.workspace.deleteMany();
    await db.user.deleteMany();
    await setup();
  });

  describe("create", () => {
    it("should create a page in workspace", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "New Page" });
      expect(page.title).toBe("New Page");
      expect(page.workspaceId).toBe(workspaceId);
      expect(page.createdBy).toBe(userId);
    });

    it("should create a sub-page", async () => {
      const caller = getCaller();
      const parent = await caller.page.create({ workspaceId, title: "Parent" });
      const child = await caller.page.create({ workspaceId, title: "Child", parentId: parent.id });
      expect(child.parentId).toBe(parent.id);
    });
  });

  describe("list", () => {
    it("should return page tree for workspace", async () => {
      const caller = getCaller();
      await caller.page.create({ workspaceId, title: "Page 1" });
      await caller.page.create({ workspaceId, title: "Page 2" });
      const pages = await caller.page.list({ workspaceId });
      expect(pages).toHaveLength(2);
    });

    it("should not return deleted pages", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "To Delete" });
      await caller.page.moveToTrash({ id: page.id });
      const pages = await caller.page.list({ workspaceId });
      expect(pages).toHaveLength(0);
    });
  });

  describe("moveToTrash", () => {
    it("should soft-delete a page", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "Page" });
      await caller.page.moveToTrash({ id: page.id });
      const found = await db.page.findUnique({ where: { id: page.id } });
      expect(found?.isDeleted).toBe(true);
      expect(found?.deletedAt).toBeTruthy();
    });
  });

  describe("restore", () => {
    it("should restore a deleted page", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "Page" });
      await caller.page.moveToTrash({ id: page.id });
      await caller.page.restore({ id: page.id });
      const found = await db.page.findUnique({ where: { id: page.id } });
      expect(found?.isDeleted).toBe(false);
      expect(found?.deletedAt).toBeNull();
    });
  });

  describe("deletePermanently", () => {
    it("should hard-delete a page", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "Page" });
      await caller.page.moveToTrash({ id: page.id });
      await caller.page.deletePermanently({ id: page.id });
      const found = await db.page.findUnique({ where: { id: page.id } });
      expect(found).toBeNull();
    });
  });

  describe("favorites", () => {
    it("should add and remove favorite", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "Fav" });
      await caller.page.addFavorite({ pageId: page.id });
      let favs = await caller.page.listFavorites({ workspaceId });
      expect(favs).toHaveLength(1);

      await caller.page.removeFavorite({ pageId: page.id });
      favs = await caller.page.listFavorites({ workspaceId });
      expect(favs).toHaveLength(0);
    });
  });

  describe("updateIcon", () => {
    it("should update page icon", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "Page" });
      const updated = await caller.page.update({ id: page.id, icon: "🚀" });
      expect(updated.icon).toBe("🚀");
    });
  });

  describe("move", () => {
    it("should move page to another parent", async () => {
      const caller = getCaller();
      const parent1 = await caller.page.create({ workspaceId, title: "Parent 1" });
      const parent2 = await caller.page.create({ workspaceId, title: "Parent 2" });
      const child = await caller.page.create({ workspaceId, title: "Child", parentId: parent1.id });
      await caller.page.move({ id: child.id, parentId: parent2.id });
      const moved = await db.page.findUnique({ where: { id: child.id } });
      expect(moved?.parentId).toBe(parent2.id);
    });
  });

  describe("duplicate", () => {
    it("should duplicate a page", async () => {
      const caller = getCaller();
      const page = await caller.page.create({ workspaceId, title: "Original" });
      const dup = await caller.page.duplicate({ id: page.id });
      expect(dup.title).toBe("Original (복사본)");
      expect(dup.id).not.toBe(page.id);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/server/routers/page.test.ts
```

- [ ] **Step 3: Implement full page router**

Replace `src/server/routers/page.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";

async function verifyWorkspaceAccess(db: any, userId: string, workspaceId: string) {
  const membership = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
}

async function verifyPageAccess(db: any, userId: string, pageId: string) {
  const page = await db.page.findUnique({ where: { id: pageId }, select: { workspaceId: true } });
  if (!page) throw new TRPCError({ code: "NOT_FOUND" });
  await verifyWorkspaceAccess(db, userId, page.workspaceId);
  return page;
}

export const pageRouter = router({
  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      title: z.string().default(""),
      parentId: z.string().optional(),
      icon: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, input.workspaceId);

      const maxPosition = await ctx.db.page.aggregate({
        where: { workspaceId: input.workspaceId, parentId: input.parentId ?? null, isDeleted: false },
        _max: { position: true },
      });

      return ctx.db.page.create({
        data: {
          workspaceId: input.workspaceId,
          title: input.title,
          parentId: input.parentId,
          icon: input.icon,
          position: (maxPosition._max.position ?? -1) + 1,
          createdBy: ctx.session.user.id,
          lastEditedBy: ctx.session.user.id,
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, input.workspaceId);

      return ctx.db.page.findMany({
        where: { workspaceId: input.workspaceId, parentId: null, isDeleted: false },
        include: {
          children: {
            where: { isDeleted: false },
            orderBy: { position: "asc" },
            include: {
              children: {
                where: { isDeleted: false },
                orderBy: { position: "asc" },
                include: { children: { where: { isDeleted: false }, orderBy: { position: "asc" } } },
              },
            },
          },
        },
        orderBy: { position: "asc" },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const page = await ctx.db.page.findUnique({
        where: { id: input.id },
        include: {
          children: { where: { isDeleted: false }, orderBy: { position: "asc" } },
          parent: { select: { id: true, title: true, icon: true, parentId: true } },
        },
      });
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, page.workspaceId);
      return page;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      icon: z.string().nullable().optional(),
      cover: z.string().nullable().optional(),
      isFullWidth: z.boolean().optional(),
      isLocked: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      const { id, ...data } = input;
      return ctx.db.page.update({
        where: { id },
        data: { ...data, lastEditedBy: ctx.session.user.id },
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
      return ctx.db.page.update({
        where: { id: input.id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.page.update({
        where: { id: input.id },
        data: { isDeleted: false, deletedAt: null },
      });
    }),

  deletePermanently: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.page.delete({ where: { id: input.id } });
      return { success: true };
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
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.id);
      return ctx.db.page.update({
        where: { id: input.id },
        data: { parentId: input.parentId, lastEditedBy: ctx.session.user.id },
      });
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const original = await ctx.db.page.findUnique({
        where: { id: input.id },
        include: { blocks: true },
      });
      if (!original) throw new TRPCError({ code: "NOT_FOUND" });
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, original.workspaceId);

      const newPage = await ctx.db.page.create({
        data: {
          workspaceId: original.workspaceId,
          parentId: original.parentId,
          title: `${original.title} (복사본)`,
          icon: original.icon,
          cover: original.cover,
          isFullWidth: original.isFullWidth,
          position: original.position + 1,
          createdBy: ctx.session.user.id,
          lastEditedBy: ctx.session.user.id,
        },
      });

      if (original.blocks.length > 0) {
        await ctx.db.block.createMany({
          data: original.blocks.map((b) => ({
            pageId: newPage.id,
            parentId: b.parentId,
            type: b.type,
            content: b.content ?? {},
            position: b.position,
          })),
        });
      }

      return newPage;
    }),

  reorder: protectedProcedure
    .input(z.object({
      pages: z.array(z.object({ id: z.string(), position: z.number() })),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(
        input.pages.map((p) => ctx.db.page.update({ where: { id: p.id }, data: { position: p.position } }))
      );
      return { success: true };
    }),

  addFavorite: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const maxPos = await ctx.db.favorite.aggregate({
        where: { userId: ctx.session.user.id },
        _max: { position: true },
      });
      return ctx.db.favorite.create({
        data: {
          userId: ctx.session.user.id,
          pageId: input.pageId,
          position: (maxPos._max.position ?? -1) + 1,
        },
      });
    }),

  removeFavorite: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.favorite.deleteMany({
        where: { userId: ctx.session.user.id, pageId: input.pageId },
      });
      return { success: true };
    }),

  listFavorites: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.favorite.findMany({
        where: {
          userId: ctx.session.user.id,
          page: { workspaceId: input.workspaceId, isDeleted: false },
        },
        include: { page: { select: { id: true, title: true, icon: true, parentId: true } } },
        orderBy: { position: "asc" },
      });
    }),
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm test tests/server/routers/page.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/page.ts tests/server/routers/page.test.ts
git commit -m "feat(sp3): expand page router with full CRUD, trash, favorites, move, duplicate"
```

---

## Task 2: Page Tree Store & Sidebar Page Item

**Files:**
- Create: `src/stores/page-tree.ts`, `src/components/layout/sidebar-page-item.tsx`

- [ ] **Step 1: Create page tree Zustand store**

`src/stores/page-tree.ts`:

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

type PageTreeStore = {
  expandedNodes: Set<string>;
  activePageId: string | null;
  toggleExpanded: (pageId: string) => void;
  setExpanded: (pageId: string, expanded: boolean) => void;
  setActivePage: (pageId: string | null) => void;
};

export const usePageTreeStore = create<PageTreeStore>()(
  persist(
    (set) => ({
      expandedNodes: new Set<string>(),
      activePageId: null,
      toggleExpanded: (pageId) =>
        set((state) => {
          const next = new Set(state.expandedNodes);
          if (next.has(pageId)) next.delete(pageId);
          else next.add(pageId);
          return { expandedNodes: next };
        }),
      setExpanded: (pageId, expanded) =>
        set((state) => {
          const next = new Set(state.expandedNodes);
          if (expanded) next.add(pageId);
          else next.delete(pageId);
          return { expandedNodes: next };
        }),
      setActivePage: (pageId) => set({ activePageId: pageId }),
    }),
    {
      name: "notion-page-tree",
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          if (parsed?.state?.expandedNodes) {
            parsed.state.expandedNodes = new Set(parsed.state.expandedNodes);
          }
          return parsed;
        },
        setItem: (name, value) => {
          const toStore = {
            ...value,
            state: {
              ...value.state,
              expandedNodes: Array.from(value.state.expandedNodes),
            },
          };
          localStorage.setItem(name, JSON.stringify(toStore));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
```

- [ ] **Step 2: Create sidebar page item component**

`src/components/layout/sidebar-page-item.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePageTreeStore } from "@/stores/page-tree";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";

type Page = {
  id: string;
  title: string;
  icon: string | null;
  children?: Page[];
};

type SidebarPageItemProps = {
  page: Page;
  workspaceId: string;
  depth?: number;
};

export function SidebarPageItem({ page, workspaceId, depth = 0 }: SidebarPageItemProps) {
  const router = useRouter();
  const { expandedNodes, toggleExpanded, activePageId } = usePageTreeStore();
  const addToast = useToastStore((s) => s.addToast);
  const [showMenu, setShowMenu] = useState(false);

  const isExpanded = expandedNodes.has(page.id);
  const isActive = activePageId === page.id;
  const hasChildren = page.children && page.children.length > 0;

  const utils = trpc.useUtils();
  const moveToTrash = trpc.page.moveToTrash.useMutation({
    onSuccess: () => {
      addToast({ message: "페이지가 휴지통으로 이동했습니다", type: "info", undo: () => restorePage.mutate({ id: page.id }) });
      utils.page.list.invalidate();
    },
  });
  const restorePage = trpc.page.restore.useMutation({
    onSuccess: () => { utils.page.list.invalidate(); },
  });
  const createSubPage = trpc.page.create.useMutation({
    onSuccess: (newPage) => {
      utils.page.list.invalidate();
      router.push(`/${workspaceId}/${newPage.id}`);
    },
  });
  const duplicatePage = trpc.page.duplicate.useMutation({
    onSuccess: () => {
      addToast({ message: "페이지가 복제되었습니다", type: "success" });
      utils.page.list.invalidate();
    },
  });

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 py-[2px] pr-2 rounded-sm cursor-pointer",
          "hover:bg-notion-bg-hover",
          isActive && "bg-notion-bg-active"
        )}
        style={{ paddingLeft: `${12 + depth * 16}px`, fontSize: "14px", color: "var(--text-primary)", minHeight: "28px" }}
        onClick={() => {
          usePageTreeStore.getState().setActivePage(page.id);
          router.push(`/${workspaceId}/${page.id}`);
        }}
      >
        {/* Expand toggle */}
        <button
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-notion-bg-active flex-shrink-0"
          style={{ color: "var(--text-tertiary)", fontSize: "10px" }}
          onClick={(e) => { e.stopPropagation(); toggleExpanded(page.id); }}
        >
          <span style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>
            ▶
          </span>
        </button>

        {/* Icon */}
        <span className="flex-shrink-0 text-sm" style={{ width: "20px", textAlign: "center" }}>
          {page.icon || "📄"}
        </span>

        {/* Title */}
        <span className="truncate flex-1" style={{ color: page.title ? "var(--text-primary)" : "var(--text-tertiary)" }}>
          {page.title || "제목 없음"}
        </span>

        {/* Action buttons (visible on hover) */}
        <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
          <button
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-notion-bg-active"
            style={{ color: "var(--text-tertiary)", fontSize: "14px" }}
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            title="메뉴"
          >
            ···
          </button>
          <button
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-notion-bg-active"
            style={{ color: "var(--text-tertiary)", fontSize: "14px" }}
            onClick={(e) => {
              e.stopPropagation();
              createSubPage.mutate({ workspaceId, title: "", parentId: page.id });
              usePageTreeStore.getState().setExpanded(page.id, true);
            }}
            title="하위 페이지 추가"
          >
            +
          </button>
        </div>
      </div>

      {/* Context menu */}
      {showMenu && (
        <div
          className="ml-8 rounded-lg overflow-hidden py-1 mb-1"
          style={{ backgroundColor: "var(--bg-primary)", boxShadow: "var(--shadow-popup)", fontSize: "13px" }}
        >
          {[
            { label: "삭제", action: () => { moveToTrash.mutate({ id: page.id }); setShowMenu(false); } },
            { label: "복제", action: () => { duplicatePage.mutate({ id: page.id }); setShowMenu(false); } },
            { label: "즐겨찾기에 추가", action: () => { /* handled in Task 3 */ setShowMenu(false); } },
          ].map((item) => (
            <button
              key={item.label}
              className="w-full text-left px-3 py-1.5 hover:bg-notion-bg-hover"
              style={{ color: "var(--text-primary)" }}
              onClick={item.action}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {page.children!.map((child) => (
            <SidebarPageItem key={child.id} page={child} workspaceId={workspaceId} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/page-tree.ts src/components/layout/sidebar-page-item.tsx
git commit -m "feat(sp3): add page tree store and recursive sidebar page item"
```

---

## Task 3: Sidebar Rewrite with Real Data

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/sidebar-favorites.tsx`

- [ ] **Step 1: Create favorites section**

`src/components/layout/sidebar-favorites.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { usePageTreeStore } from "@/stores/page-tree";

export function SidebarFavorites({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { activePageId, setActivePage } = usePageTreeStore();
  const { data: favorites } = trpc.page.listFavorites.useQuery({ workspaceId });

  if (!favorites || favorites.length === 0) return null;

  return (
    <div className="mb-2">
      <div className="px-3 py-1" style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-tertiary)", letterSpacing: "0.02em" }}>
        즐겨찾기
      </div>
      {favorites.map((fav) => (
        <div
          key={fav.id}
          className="flex items-center gap-2 px-3 py-[3px] rounded-sm cursor-pointer hover:bg-notion-bg-hover"
          style={{
            fontSize: "14px",
            color: "var(--text-primary)",
            backgroundColor: activePageId === fav.page.id ? "var(--bg-active)" : undefined,
          }}
          onClick={() => { setActivePage(fav.page.id); router.push(`/${workspaceId}/${fav.page.id}`); }}
        >
          <span className="text-sm">{fav.page.icon || "📄"}</span>
          <span className="truncate">{fav.page.title || "제목 없음"}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite sidebar with real data**

Replace `src/components/layout/sidebar.tsx` to fetch pages from tRPC and render the page tree. The sidebar needs a `workspaceId` prop — get it from the URL params or pass it down from the layout.

Key changes:
- Accept `workspaceId` prop
- Use `trpc.page.list.useQuery({ workspaceId })` to fetch page tree
- Render `SidebarFavorites` section
- Render "개인 페이지" section with `SidebarPageItem` for each top-level page
- "새 페이지" button calls `page.create` mutation
- Search button opens command palette
- Settings button navigates to settings

```tsx
"use client";

import { useRouter, useParams } from "next/navigation";
import { useSidebarStore } from "@/stores/sidebar";
import { useCommandPaletteStore } from "@/stores/command-palette";
import { SidebarResizer } from "./sidebar-resizer";
import { SidebarPageItem } from "./sidebar-page-item";
import { SidebarFavorites } from "./sidebar-favorites";
import { cn } from "@/lib/utils";
import { trpc } from "@/server/trpc/client";

export function Sidebar() {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const { isOpen, width, isResizing } = useSidebarStore();
  const openPalette = useCommandPaletteStore((s) => s.open);

  const { data: pages } = trpc.page.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );
  const { data: memberships } = trpc.workspace.list.useQuery();
  const workspace = memberships?.find((m) => m.workspaceId === workspaceId)?.workspace;

  const utils = trpc.useUtils();
  const createPage = trpc.page.create.useMutation({
    onSuccess: (newPage) => {
      utils.page.list.invalidate();
      router.push(`/${workspaceId}/${newPage.id}`);
    },
  });

  return (
    <>
      <aside
        className={cn("fixed top-0 left-0 bottom-0 flex flex-col bg-notion-bg-sidebar", !isResizing && "transition-all duration-300 ease-in-out")}
        style={{ width: isOpen ? `${width}px` : "0px", zIndex: "var(--z-sidebar)", overflow: "hidden" }}
      >
        <div className="flex flex-col h-full" style={{ width: `${width}px` }}>
          {/* Workspace name */}
          <div className="flex items-center px-3 h-[45px] hover:bg-notion-bg-hover cursor-pointer"
            style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
            <span className="mr-2 text-lg">{workspace?.icon || "📋"}</span>
            <span className="truncate flex-1">{workspace?.name || "Workspace"}</span>
          </div>

          {/* Search */}
          <button onClick={openPalette}
            className="flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-auto"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            <span>🔍</span><span>검색</span><span className="ml-auto text-xs opacity-50">⌘K</span>
          </button>

          {/* Settings */}
          <button onClick={() => router.push(`/${workspaceId}/settings`)}
            className="flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-auto"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            <span>⚙️</span><span>설정</span>
          </button>

          <div className="mx-3 my-1" style={{ height: "1px", backgroundColor: "var(--border-divider)" }} />

          {/* Page sections */}
          <div className="flex-1 overflow-y-auto px-1">
            {/* Favorites */}
            {workspaceId && <SidebarFavorites workspaceId={workspaceId} />}

            {/* Private pages */}
            <div className="px-3 py-1 mt-2" style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-tertiary)", letterSpacing: "0.02em" }}>
              개인 페이지
            </div>
            {pages?.map((page: any) => (
              <SidebarPageItem key={page.id} page={page} workspaceId={workspaceId} />
            ))}
            {(!pages || pages.length === 0) && (
              <div className="px-3 py-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                페이지가 없습니다
              </div>
            )}
          </div>

          {/* New page */}
          <button
            onClick={() => createPage.mutate({ workspaceId, title: "" })}
            className="flex items-center gap-2 mx-2 mb-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-auto"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            <span>➕</span><span>새 페이지</span>
          </button>
        </div>
        <SidebarResizer />
      </aside>

      <div className={cn(!isResizing && "transition-all duration-300 ease-in-out")}
        style={{ width: isOpen ? `${width}px` : "0px", flexShrink: 0 }} />
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx src/components/layout/sidebar-favorites.tsx
git commit -m "feat(sp3): rewrite sidebar with real page tree, favorites, create page"
```

---

## Task 4: Trash Panel

**Files:**
- Create: `src/components/layout/sidebar-trash.tsx`
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Create trash panel**

`src/components/layout/sidebar-trash.tsx`:

```tsx
"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";

export function SidebarTrash({ workspaceId }: { workspaceId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const addToast = useToastStore((s) => s.addToast);
  const { data: trashPages, refetch } = trpc.page.listTrash.useQuery(
    { workspaceId },
    { enabled: isOpen }
  );
  const utils = trpc.useUtils();

  const restore = trpc.page.restore.useMutation({
    onSuccess: () => {
      addToast({ message: "페이지가 복원되었습니다", type: "success" });
      refetch();
      utils.page.list.invalidate();
    },
  });

  const deletePermanently = trpc.page.deletePermanently.useMutation({
    onSuccess: () => {
      addToast({ message: "페이지가 영구 삭제되었습니다", type: "info" });
      refetch();
    },
  });

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-auto"
        style={{ fontSize: "14px", color: "var(--text-secondary)" }}
      >
        <span>🗑</span><span>휴지통</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0" style={{ zIndex: "var(--z-modal)", backgroundColor: "rgba(15, 15, 15, 0.6)" }}
            onClick={() => setIsOpen(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-h-[70vh] rounded-lg overflow-hidden flex flex-col"
            style={{ zIndex: "calc(var(--z-modal) + 1)", backgroundColor: "var(--bg-primary)", boxShadow: "var(--shadow-popup)" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border-default)" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>휴지통</h3>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-notion-bg-hover"
                style={{ color: "var(--text-tertiary)" }}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {(!trashPages || trashPages.length === 0) ? (
                <div className="py-8 text-center" style={{ color: "var(--text-tertiary)", fontSize: "14px" }}>
                  휴지통이 비어있습니다
                </div>
              ) : (
                trashPages.map((page) => (
                  <div key={page.id} className="flex items-center justify-between px-4 py-2 hover:bg-notion-bg-hover"
                    style={{ fontSize: "14px" }}>
                    <div className="flex items-center gap-2 truncate">
                      <span>{page.icon || "📄"}</span>
                      <span style={{ color: "var(--text-primary)" }}>{page.title || "제목 없음"}</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => restore.mutate({ id: page.id })}
                        className="px-2 py-1 rounded text-xs hover:bg-notion-bg-active"
                        style={{ color: "var(--color-blue)" }}>복원</button>
                      <button onClick={() => deletePermanently.mutate({ id: page.id })}
                        className="px-2 py-1 rounded text-xs hover:bg-notion-bg-active"
                        style={{ color: "var(--color-red)" }}>삭제</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Add trash to sidebar**

In `src/components/layout/sidebar.tsx`, add before the "새 페이지" button:

```tsx
import { SidebarTrash } from "./sidebar-trash";

// Before the new page button:
{workspaceId && <SidebarTrash workspaceId={workspaceId} />}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar-trash.tsx src/components/layout/sidebar.tsx
git commit -m "feat(sp3): add trash panel with restore and permanent delete"
```

---

## Task 5: Page Header (Icon + Cover + Title)

**Files:**
- Create: `src/components/page/page-header.tsx`, `src/components/page/page-icon-picker.tsx`, `src/components/page/page-cover.tsx`
- Modify: `src/app/(main)/[workspaceId]/[pageId]/page.tsx`

- [ ] **Step 1: Create emoji icon picker**

`src/components/page/page-icon-picker.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";

const EMOJI_LIST = [
  "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂",
  "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛",
  "📄", "📝", "📋", "📌", "📎", "📔", "📕", "📖", "📗", "📘",
  "🚀", "⭐", "🔥", "💡", "💎", "🎯", "🎨", "🏆", "🎪", "🎭",
  "🏠", "🏢", "🏗️", "🌍", "🌈", "☀️", "🌙", "⚡", "💧", "🌸",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯", "✅",
  "📊", "📈", "📉", "🗂️", "📁", "🔗", "🔧", "⚙️", "🛠️", "🔑",
  "👋", "👍", "👎", "👏", "🤝", "✌️", "🤞", "👀", "🧠", "💪",
];

type Props = {
  currentIcon: string | null;
  onSelect: (icon: string | null) => void;
  onClose: () => void;
};

export function PageIconPicker({ currentIcon, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-primary)", boxShadow: "var(--shadow-popup)", width: "340px" }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: "12px", color: "var(--text-tertiary)", fontWeight: 500 }}>아이콘</span>
        {currentIcon && (
          <button onClick={() => { onSelect(null); onClose(); }}
            className="text-xs px-2 py-0.5 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-secondary)" }}>제거</button>
        )}
      </div>
      <div className="grid grid-cols-10 gap-0.5">
        {EMOJI_LIST.map((emoji) => (
          <button key={emoji} onClick={() => { onSelect(emoji); onClose(); }}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-notion-bg-hover text-lg">
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create page cover component**

`src/components/page/page-cover.tsx`:

```tsx
"use client";

type Props = {
  cover: string | null;
  onChangeCover: () => void;
  onRemoveCover: () => void;
};

export function PageCover({ cover, onChangeCover, onRemoveCover }: Props) {
  if (!cover) return null;

  return (
    <div className="relative group w-full h-[200px] mb-4">
      <img src={cover} alt="" className="w-full h-full object-cover" />
      <div className="absolute bottom-3 right-3 hidden group-hover:flex gap-1">
        <button onClick={onChangeCover}
          className="px-3 py-1 rounded text-xs"
          style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)", boxShadow: "var(--shadow-tooltip)" }}>
          커버 변경
        </button>
        <button onClick={onRemoveCover}
          className="px-3 py-1 rounded text-xs"
          style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)", boxShadow: "var(--shadow-tooltip)" }}>
          제거
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create page header component**

`src/components/page/page-header.tsx`:

```tsx
"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { PageIconPicker } from "./page-icon-picker";
import { PageCover } from "./page-cover";
import { PageTitle } from "@/components/editor/page-title";

type PageHeaderProps = {
  page: {
    id: string;
    title: string;
    icon: string | null;
    cover: string | null;
    isLocked: boolean;
    isFullWidth: boolean;
  };
};

export function PageHeader({ page }: PageHeaderProps) {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const utils = trpc.useUtils();

  const updatePage = trpc.page.update.useMutation({
    onSuccess: () => utils.page.get.invalidate(),
  });

  return (
    <div>
      <PageCover
        cover={page.cover}
        onChangeCover={() => {
          const url = window.prompt("커버 이미지 URL:");
          if (url) updatePage.mutate({ id: page.id, cover: url });
        }}
        onRemoveCover={() => updatePage.mutate({ id: page.id, cover: null })}
      />

      <div style={{ maxWidth: page.isFullWidth ? "100%" : "var(--page-max-width)", margin: "0 auto", paddingLeft: "var(--page-padding-x)", paddingRight: "var(--page-padding-x)" }}>
        {/* Hover actions: Add icon, Add cover */}
        <div className="flex gap-2 mb-1 opacity-0 hover:opacity-100 transition-opacity" style={{ marginTop: page.cover ? "-20px" : "60px" }}>
          {!page.icon && (
            <button onClick={() => setShowIconPicker(true)}
              className="px-2 py-1 rounded text-xs hover:bg-notion-bg-hover"
              style={{ color: "var(--text-tertiary)" }}>
              🙂 아이콘 추가
            </button>
          )}
          {!page.cover && (
            <button onClick={() => {
              const url = window.prompt("커버 이미지 URL:");
              if (url) updatePage.mutate({ id: page.id, cover: url });
            }}
              className="px-2 py-1 rounded text-xs hover:bg-notion-bg-hover"
              style={{ color: "var(--text-tertiary)" }}>
              🖼 커버 추가
            </button>
          )}
        </div>

        {/* Icon */}
        {page.icon && (
          <div className="relative inline-block mb-2">
            <button onClick={() => setShowIconPicker(true)}
              className="text-6xl hover:opacity-80 cursor-pointer transition-opacity">
              {page.icon}
            </button>
            {showIconPicker && (
              <div className="absolute top-full left-0 mt-1" style={{ zIndex: "var(--z-dropdown)" }}>
                <PageIconPicker
                  currentIcon={page.icon}
                  onSelect={(icon) => updatePage.mutate({ id: page.id, icon })}
                  onClose={() => setShowIconPicker(false)}
                />
              </div>
            )}
          </div>
        )}

        {showIconPicker && !page.icon && (
          <div className="relative mb-2">
            <div className="absolute" style={{ zIndex: "var(--z-dropdown)" }}>
              <PageIconPicker
                currentIcon={null}
                onSelect={(icon) => updatePage.mutate({ id: page.id, icon })}
                onClose={() => setShowIconPicker(false)}
              />
            </div>
          </div>
        )}

        {/* Title */}
        <PageTitle pageId={page.id} initialTitle={page.title} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update page view to use PageHeader**

Replace `src/app/(main)/[workspaceId]/[pageId]/page.tsx`:

```tsx
import { db } from "@/server/db/client";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page/page-header";
import { PageEditor } from "@/components/editor/page-editor";
import { SubPagesList } from "@/components/page/sub-pages-list";

export default async function PageView({ params }: { params: { workspaceId: string; pageId: string } }) {
  const page = await db.page.findUnique({
    where: { id: params.pageId },
    include: {
      blocks: { where: { parentId: null }, orderBy: { position: "asc" }, include: { children: { orderBy: { position: "asc" } } } },
      children: { where: { isDeleted: false }, orderBy: { position: "asc" }, select: { id: true, title: true, icon: true } },
    },
  });

  if (!page || page.isDeleted) notFound();

  return (
    <div>
      <PageHeader page={{ id: page.id, title: page.title, icon: page.icon, cover: page.cover, isLocked: page.isLocked, isFullWidth: page.isFullWidth }} />

      <div style={{ maxWidth: page.isFullWidth ? "100%" : "var(--page-max-width)", margin: "0 auto", paddingLeft: "var(--page-padding-x)", paddingRight: "var(--page-padding-x)", paddingBottom: "100px" }}>
        <PageEditor
          pageId={page.id}
          initialBlocks={page.blocks.map((b) => ({ id: b.id, type: b.type, content: b.content, position: b.position, parentId: b.parentId }))}
        />

        {page.children.length > 0 && <SubPagesList pages={page.children} workspaceId={params.workspaceId} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create sub-pages list**

`src/components/page/sub-pages-list.tsx`:

```tsx
"use client";

import Link from "next/link";

type Props = {
  pages: { id: string; title: string; icon: string | null }[];
  workspaceId: string;
};

export function SubPagesList({ pages, workspaceId }: Props) {
  return (
    <div className="mt-8 pt-4" style={{ borderTop: "1px solid var(--border-divider)" }}>
      {pages.map((page) => (
        <Link key={page.id} href={`/${workspaceId}/${page.id}`}
          className="flex items-center gap-2 px-2 py-2 rounded hover:bg-notion-bg-hover"
          style={{ fontSize: "14px", color: "var(--text-primary)" }}>
          <span>{page.icon || "📄"}</span>
          <span>{page.title || "제목 없음"}</span>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/page/ src/app/
git commit -m "feat(sp3): add page header with icon picker, cover, title, and sub-pages list"
```

---

## Task 6: Dynamic Breadcrumb

**Files:**
- Modify: `src/components/layout/topbar.tsx`

- [ ] **Step 1: Update topbar with dynamic breadcrumb**

Replace `src/components/layout/topbar.tsx` to fetch the page hierarchy and render breadcrumbs:

```tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useSidebarStore } from "@/stores/sidebar";
import { trpc } from "@/server/trpc/client";

export function Topbar() {
  const { isOpen, toggle } = useSidebarStore();
  const params = useParams();
  const router = useRouter();
  const pageId = params.pageId as string | undefined;
  const workspaceId = params.workspaceId as string;

  const { data: page } = trpc.page.get.useQuery(
    { id: pageId! },
    { enabled: !!pageId }
  );

  // Build breadcrumb chain from page.parent
  const breadcrumbs: { id: string; title: string; icon: string | null }[] = [];
  if (page) {
    let current = page.parent;
    while (current) {
      breadcrumbs.unshift({ id: current.id, title: current.title, icon: current.icon });
      current = null; // Only one level loaded; for deeper nesting, would need recursive fetch
    }
    breadcrumbs.push({ id: page.id, title: page.title, icon: page.icon });
  }

  return (
    <header className="sticky top-0 flex items-center justify-between px-3"
      style={{ height: "var(--topbar-height)", zIndex: "var(--z-topbar)", backgroundColor: "var(--bg-primary)", fontSize: "14px" }}>
      <div className="flex items-center gap-1">
        {!isOpen && (
          <button onClick={toggle} className="p-1 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-secondary)" }} title="Open sidebar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3h12v1.5H2V3zm0 4.25h12v1.5H2v-1.5zm0 4.25h12V13H2v-1.5z" />
            </svg>
          </button>
        )}
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 px-1">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1">
              {i > 0 && <span style={{ color: "var(--text-tertiary)" }}>/</span>}
              <button
                onClick={() => router.push(`/${workspaceId}/${crumb.id}`)}
                className="hover:bg-notion-bg-hover rounded px-1 py-0.5 truncate max-w-[150px]"
                style={{
                  color: i === breadcrumbs.length - 1 ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: i === breadcrumbs.length - 1 ? 500 : 400,
                }}
              >
                {crumb.icon && <span className="mr-1">{crumb.icon}</span>}
                {crumb.title || "제목 없음"}
              </button>
            </span>
          ))}
          {!pageId && (
            <span style={{ color: "var(--text-secondary)" }}>워크스페이스 홈</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <button className="px-3 py-1 rounded hover:bg-notion-bg-hover text-sm" style={{ color: "var(--text-secondary)" }}>
          공유
        </button>
        <button className="p-1.5 rounded hover:bg-notion-bg-hover" style={{ color: "var(--text-secondary)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 8a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm4.5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM12 6.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/topbar.tsx
git commit -m "feat(sp3): add dynamic breadcrumb navigation in topbar"
```

---

## Task 7: Page Lock & Width Toggle

**Files:**
- Modify: `src/components/editor/page-editor.tsx`, `src/app/(main)/[workspaceId]/[pageId]/page.tsx`

- [ ] **Step 1: Add lock/width controls to page view**

The page header already passes `isLocked` and `isFullWidth`. Add controls to the topbar's more menu or the page header.

Add a simple more menu in the topbar that allows toggling lock and width. Or simpler: pass `isLocked` to `PageEditor` and disable editing when locked.

Update `src/components/editor/page-editor.tsx` to accept `isLocked` prop:

```tsx
type PageEditorProps = {
  pageId: string;
  initialBlocks: ...;
  isLocked?: boolean;
};

// Pass to NotionEditor:
<NotionEditor
  initialContent={...}
  onUpdate={isLocked ? undefined : handleUpdate}
  editable={!isLocked}
/>
```

Update page.tsx to pass `isLocked`:
```tsx
<PageEditor pageId={page.id} initialBlocks={...} isLocked={page.isLocked} />
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/page-editor.tsx src/app/
git commit -m "feat(sp3): support page lock (read-only mode) and full-width toggle"
```

---

## Task 8: Final Integration & Build

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

- [ ] **Step 2: Run build**

```bash
pnpm build
```

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore(sp3): pages & workspace complete — CRUD, page tree, favorites, trash, icons, covers, breadcrumbs"
```
