# Editor UX Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete remaining editor UX features -- synced blocks, focus mode, toggle headings, text highlight picker, block colors, table controls, formula engine, and full-width toggle -- to reach Notion parity.
**Architecture:** Each feature is a self-contained TipTap extension or React component that integrates into the existing `editor.tsx` extension array. Server-side features use tRPC routers with Prisma. State that needs persistence crosses client via tRPC mutations; ephemeral UI state uses Zustand stores.
**Tech Stack:** TipTap 2 (ProseMirror), React 18, Zustand, tRPC, Prisma, Tailwind CSS

---

### Task 1: Synced Blocks -- Rewrite Extension + NodeView + tRPC Router

**Files:**
- Modify: `src/components/editor/extensions/synced-block.ts`
- Create: `src/components/editor/synced-block-view.tsx`
- Modify: `src/server/routers/synced-block.ts`
- Modify: `prisma/schema.prisma`
- Modify: `src/components/editor/editor.tsx`

- [ ] **Step 1: Update Prisma SyncedBlock model with content and version fields**
```prisma
// In prisma/schema.prisma, replace the SyncedBlock model:
model SyncedBlock {
  id            String   @id @default(cuid())
  sourceBlockId String
  sourcePageId  String
  content       Json     @default("{}")
  version       Int      @default(1)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([sourceBlockId])
  @@index([sourcePageId])
}
```
Run: `npx prisma db push`

- [ ] **Step 2: Rewrite synced-block.ts extension with ReactNodeViewRenderer support**
```ts
// src/components/editor/extensions/synced-block.ts
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { SyncedBlockView } from "../synced-block-view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    syncedBlock: {
      insertSyncedBlock: (attrs: {
        blockId?: string;
        sourceBlockId?: string;
        sourcePageId?: string;
      }) => ReturnType;
    };
  }
}

export const SyncedBlockNode = Node.create({
  name: "syncedBlock",
  group: "block",
  content: "block+",
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      blockId: { default: null },
      sourceBlockId: { default: null },
      sourcePageId: { default: null },
      synced: { default: true },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="synced-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "synced-block",
        class: "notion-synced-block",
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SyncedBlockView);
  },

  addCommands() {
    return {
      insertSyncedBlock:
        (attrs) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: "syncedBlock",
              attrs,
              content: [{ type: "paragraph" }],
            })
            .run();
        },
    };
  },
});
```

- [ ] **Step 3: Create SyncedBlockView React NodeView component**
```tsx
// src/components/editor/synced-block-view.tsx
"use client";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { RefreshCw, Unlink, Copy } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/server/trpc/client";

export function SyncedBlockView(props: {
  node: { attrs: Record<string, unknown> };
  updateAttributes: (attrs: Record<string, unknown>) => void;
  deleteNode: () => void;
  selected: boolean;
}) {
  const { node, updateAttributes, selected } = props;
  const isSynced = node.attrs.synced as boolean;
  const sourceBlockId = node.attrs.sourceBlockId as string | null;
  const [showMenu, setShowMenu] = useState(false);

  const detachMutation = trpc.syncedBlock.detach.useMutation({
    onSuccess: () => {
      updateAttributes({ synced: false, sourceBlockId: null, sourcePageId: null });
    },
  });

  const handleDetach = () => {
    if (sourceBlockId) {
      detachMutation.mutate({ sourceBlockId });
    } else {
      updateAttributes({ synced: false });
    }
    setShowMenu(false);
  };

  const handleCopyRef = () => {
    const blockId = node.attrs.blockId as string;
    if (blockId) {
      navigator.clipboard.writeText(blockId).catch(() => {});
    }
    setShowMenu(false);
  };

  return (
    <NodeViewWrapper
      className="relative my-1 rounded-md border-l-4 px-4 py-2 group"
      style={{
        borderColor: isSynced ? "#eb5757" : "var(--border-default)",
        backgroundColor: isSynced
          ? "rgba(235, 87, 87, 0.04)"
          : "transparent",
        outline: selected ? "2px solid #2383e2" : "none",
      }}
    >
      {/* Toolbar */}
      <div className="absolute -top-3 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isSynced && (
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ backgroundColor: "rgba(235, 87, 87, 0.1)", color: "#eb5757" }}
          >
            <RefreshCw size={10} />
            동기화됨
          </span>
        )}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-notion-bg-hover text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          ...
        </button>
        {showMenu && (
          <div
            className="absolute top-full right-0 mt-1 w-44 rounded-md border shadow-lg py-1"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-default)",
              zIndex: 50,
            }}
          >
            <button
              onClick={handleCopyRef}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-notion-bg-hover"
              style={{ color: "var(--text-primary)" }}
            >
              <Copy size={14} />
              블록 참조 복사
            </button>
            {isSynced && (
              <button
                onClick={handleDetach}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-notion-bg-hover"
                style={{ color: "#eb5757" }}
              >
                <Unlink size={14} />
                동기화 해제
              </button>
            )}
          </div>
        )}
      </div>

      <NodeViewContent className="synced-block-content" />
    </NodeViewWrapper>
  );
}
```

- [ ] **Step 4: Expand synced-block tRPC router with detach and listReferences**
```ts
// src/server/routers/synced-block.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";

export const syncedBlockRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        sourceBlockId: z.string(),
        sourcePageId: z.string(),
        content: z.record(z.string(), z.unknown()).default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.syncedBlock.create({
        data: {
          sourceBlockId: input.sourceBlockId,
          sourcePageId: input.sourcePageId,
          content: input.content,
        },
      });
    }),

  get: protectedProcedure
    .input(z.object({ sourceBlockId: z.string() }))
    .query(async ({ ctx, input }) => {
      const synced = await ctx.db.syncedBlock.findFirst({
        where: { sourceBlockId: input.sourceBlockId },
      });
      if (!synced) throw new TRPCError({ code: "NOT_FOUND" });
      return synced;
    }),

  detach: protectedProcedure
    .input(z.object({ sourceBlockId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.syncedBlock.deleteMany({
        where: { sourceBlockId: input.sourceBlockId },
      });
      return { success: true, count: deleted.count };
    }),

  listReferences: protectedProcedure
    .input(z.object({ sourcePageId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.syncedBlock.findMany({
        where: { sourcePageId: input.sourcePageId },
        orderBy: { createdAt: "desc" },
      });
    }),

  updateContent: protectedProcedure
    .input(
      z.object({
        sourceBlockId: z.string(),
        content: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.syncedBlock.findFirst({
        where: { sourceBlockId: input.sourceBlockId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.syncedBlock.update({
        where: { id: existing.id },
        data: {
          content: input.content,
          version: { increment: 1 },
        },
      });
    }),
});
```

- [ ] **Step 5: Update slash-items.tsx to pass proper synced block content**

In `src/components/editor/slash-command/slash-items.tsx`, find the synced block entry and update the command:
```tsx
// Replace the existing "동기화 블록" command function:
command: (editor) => {
  editor
    .chain()
    .focus()
    .insertContent({
      type: "syncedBlock",
      attrs: { synced: true },
      content: [{ type: "paragraph" }],
    })
    .run();
},
```

- [ ] **Step 6: Commit**
```
git add src/components/editor/extensions/synced-block.ts src/components/editor/synced-block-view.tsx src/server/routers/synced-block.ts prisma/schema.prisma src/components/editor/slash-command/slash-items.tsx
git commit -m "feat: synced blocks with NodeView, detach, and content sync"
```

---

### Task 2: Focus Mode -- Zustand Store + ProseMirror Plugin + CSS

**Files:**
- Create: `src/stores/focus-mode.ts`
- Create: `src/components/editor/extensions/focus-mode.ts`
- Modify: `src/components/editor/editor.tsx`
- Modify: `src/components/editor/utils/editor-styles.css`

- [ ] **Step 1: Create focus-mode Zustand store**
```ts
// src/stores/focus-mode.ts
import { create } from "zustand";

type FocusModeStore = {
  isActive: boolean;
  toggle: () => void;
  setActive: (active: boolean) => void;
};

export const useFocusModeStore = create<FocusModeStore>()((set) => ({
  isActive: false,
  toggle: () => set((s) => ({ isActive: !s.isActive })),
  setActive: (active) => set({ isActive: active }),
}));
```

- [ ] **Step 2: Create focus-mode ProseMirror plugin extension**
```ts
// src/components/editor/extensions/focus-mode.ts
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const FOCUS_MODE_KEY = new PluginKey("focusMode");

export const FocusMode = Extension.create({
  name: "focusMode",

  addStorage() {
    return { enabled: false };
  },

  addCommands() {
    return {
      toggleFocusMode:
        () =>
        ({ editor }) => {
          editor.storage.focusMode.enabled =
            !editor.storage.focusMode.enabled;
          // Force re-decoration
          editor.view.dispatch(editor.state.tr.setMeta(FOCUS_MODE_KEY, true));
          return true;
        },
    } as Record<string, (...args: unknown[]) => unknown>;
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-f": () => {
        (this.editor.commands as Record<string, () => boolean>).toggleFocusMode();
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: FOCUS_MODE_KEY,
        props: {
          decorations(state) {
            if (!editor.storage.focusMode.enabled) {
              return DecorationSet.empty;
            }

            const { $from } = state.selection;
            // Find the top-level block containing the cursor
            const depth = $from.depth;
            let activePos = -1;
            let activeEnd = -1;

            if (depth >= 1) {
              const resolved = state.doc.resolve($from.before(1));
              activePos = resolved.pos;
              const node = state.doc.nodeAt(activePos);
              activeEnd = node ? activePos + node.nodeSize : activePos;
            }

            const decorations: Decoration[] = [];
            state.doc.forEach((node, pos) => {
              if (pos !== activePos) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: "focus-mode-dimmed",
                  })
                );
              } else {
                decorations.push(
                  Decoration.node(pos, activeEnd, {
                    class: "focus-mode-active",
                  })
                );
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
```

- [ ] **Step 3: Add focus mode CSS to editor-styles.css**

Append to `src/components/editor/utils/editor-styles.css`:
```css
/* Focus Mode */
.focus-mode-dimmed {
  opacity: 0.15;
  transition: opacity 0.2s ease;
}

.focus-mode-dimmed:hover {
  opacity: 0.4;
}

.focus-mode-active {
  opacity: 1;
  transition: opacity 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .focus-mode-dimmed,
  .focus-mode-active {
    transition: none;
  }
}
```

- [ ] **Step 4: Register FocusMode extension in editor.tsx**

In `src/components/editor/editor.tsx`, add the import and extension:
```ts
// Add import at the top:
import { FocusMode } from "./extensions/focus-mode";

// Add to extensions array, after MicroInteractions:
FocusMode,
```

- [ ] **Step 5: Commit**
```
git add src/stores/focus-mode.ts src/components/editor/extensions/focus-mode.ts src/components/editor/editor.tsx src/components/editor/utils/editor-styles.css
git commit -m "feat: focus mode with Cmd+Shift+F dimming inactive blocks"
```

---

### Task 3: Toggle Headings

**Files:**
- Create: `src/components/editor/extensions/toggle-heading.ts`
- Modify: `src/components/editor/editor.tsx`
- Modify: `src/components/editor/slash-command/slash-items.tsx`
- Modify: `src/components/editor/utils/editor-styles.css`

- [ ] **Step 1: Create toggle-heading TipTap extension**
```ts
// src/components/editor/extensions/toggle-heading.ts
import { Node, mergeAttributes } from "@tiptap/core";

export interface ToggleHeadingOptions {
  levels: number[];
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    toggleHeading: {
      setToggleHeading: (attrs: { level: number }) => ReturnType;
    };
  }
}

export const ToggleHeading = Node.create<ToggleHeadingOptions>({
  name: "toggleHeading",
  group: "block",
  content: "inline*",
  defining: true,
  draggable: true,

  addOptions() {
    return { levels: [1, 2, 3] };
  },

  addAttributes() {
    return {
      level: {
        default: 2,
        parseHTML: (el) => parseInt(el.getAttribute("data-level") || "2"),
        renderHTML: (attrs) => ({ "data-level": attrs.level }),
      },
      collapsed: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-collapsed") === "true",
        renderHTML: (attrs) => ({ "data-collapsed": String(attrs.collapsed) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toggle-heading"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const level = HTMLAttributes["data-level"] || 2;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "toggle-heading",
        class: `notion-toggle-heading notion-toggle-heading-${level}`,
        role: "heading",
        "aria-level": level,
      }),
      [
        "button",
        {
          class: "toggle-heading-trigger",
          contenteditable: "false",
          "aria-label": "토글",
        },
        ["span", { class: "toggle-heading-arrow" }, "\u25B6"],
      ],
      ["span", { class: "toggle-heading-content" }, 0],
    ];
  },

  addCommands() {
    return {
      setToggleHeading:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: "toggleHeading",
            attrs,
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (!editor.isActive("toggleHeading")) return false;
        // Insert paragraph after toggle heading
        return editor.commands.insertContentAt(
          editor.state.selection.$to.after(),
          { type: "paragraph" }
        );
      },
    };
  },
});
```

- [ ] **Step 2: Add toggle heading CSS to editor-styles.css**

Append to `src/components/editor/utils/editor-styles.css`:
```css
/* Toggle Headings */
.notion-toggle-heading {
  display: flex;
  align-items: baseline;
  gap: 4px;
  cursor: text;
}

.notion-toggle-heading-1 .toggle-heading-content {
  font-size: 1.875em;
  font-weight: 700;
  line-height: 1.3;
}

.notion-toggle-heading-2 .toggle-heading-content {
  font-size: 1.5em;
  font-weight: 600;
  line-height: 1.3;
}

.notion-toggle-heading-3 .toggle-heading-content {
  font-size: 1.25em;
  font-weight: 600;
  line-height: 1.3;
}

.toggle-heading-trigger {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  border-radius: 3px;
  color: var(--text-tertiary);
  transition: background-color 0.1s;
}

.toggle-heading-trigger:hover {
  background-color: var(--bg-hover);
}

.toggle-heading-arrow {
  font-size: 10px;
  transition: transform 0.15s ease;
}

.notion-toggle-heading[data-collapsed="false"] .toggle-heading-arrow {
  transform: rotate(90deg);
}
```

- [ ] **Step 3: Register ToggleHeading in editor.tsx and add slash items**

In `src/components/editor/editor.tsx`:
```ts
// Add import:
import { ToggleHeading } from "./extensions/toggle-heading";

// Add to extensions array after Callout:
ToggleHeading,
```

In `src/components/editor/slash-command/slash-items.tsx`, add after the "제목 3" entry:
```tsx
{
  title: "토글 제목 1",
  description: "접을 수 있는 대제목",
  icon: <ChevronRight size={18} />,
  category: "기본 블록",
  keywords: ["toggle", "heading", "h1", "토글", "제목"],
  command: (editor) => {
    (editor.commands as Record<string, (attrs: Record<string, unknown>) => boolean>)
      .setToggleHeading({ level: 1 });
  },
},
{
  title: "토글 제목 2",
  description: "접을 수 있는 중제목",
  icon: <ChevronRight size={18} />,
  category: "기본 블록",
  keywords: ["toggle", "heading", "h2", "토글", "제목"],
  command: (editor) => {
    (editor.commands as Record<string, (attrs: Record<string, unknown>) => boolean>)
      .setToggleHeading({ level: 2 });
  },
},
{
  title: "토글 제목 3",
  description: "접을 수 있는 소제목",
  icon: <ChevronRight size={18} />,
  category: "기본 블록",
  keywords: ["toggle", "heading", "h3", "토글", "제목"],
  command: (editor) => {
    (editor.commands as Record<string, (attrs: Record<string, unknown>) => boolean>)
      .setToggleHeading({ level: 3 });
  },
},
```

- [ ] **Step 4: Commit**
```
git add src/components/editor/extensions/toggle-heading.ts src/components/editor/editor.tsx src/components/editor/slash-command/slash-items.tsx src/components/editor/utils/editor-styles.css
git commit -m "feat: toggle headings (collapsible H1/H2/H3)"
```

---

### Task 4: Text Highlight Color Picker Enhancement

**Files:**
- Modify: `src/components/editor/inline-toolbar.tsx`

- [ ] **Step 1: Replace the Highlight button with color-aware picker**

In `src/components/editor/inline-toolbar.tsx`, replace the existing Highlight button in the `buttons` array:
```tsx
{
  label: "Highlight",
  icon: <Highlighter size={14} />,
  action: () => togglePanel("highlight"),
  isActive: () => editor.isActive("highlight") || activePanel === "highlight",
},
```

- [ ] **Step 2: Add "highlight" to PanelType and add the highlight panel UI**

Update the PanelType:
```tsx
type PanelType = null | "colors" | "align" | "ai" | "link" | "comment" | "highlight";
```

Add after the `showCommentInput` panel in the return JSX:
```tsx
{activePanel === "highlight" && (
  <div
    className="absolute top-full left-0 mt-1 p-2 rounded-lg"
    style={{
      backgroundColor: "var(--bg-primary)",
      boxShadow: "var(--shadow-popup)",
      width: "240px",
      zIndex: 1,
    }}
  >
    <div
      className="mb-2"
      style={{
        fontSize: "11px",
        color: "var(--text-tertiary)",
        fontWeight: 500,
      }}
    >
      하이라이트 색상
    </div>
    <div className="flex flex-wrap gap-1">
      {BG_COLORS.filter((c) => c.value !== "default").map((c) => (
        <button
          key={c.value}
          className="w-7 h-7 rounded-md border hover:ring-2 ring-[#2383e2] flex items-center justify-center transition-all"
          style={{
            backgroundColor: c.css,
            borderColor: "var(--border-default)",
          }}
          title={c.name}
          onClick={() => {
            editor.chain().focus().setHighlight({ color: c.css }).run();
            setActivePanel(null);
          }}
        >
          {editor.isActive("highlight", { color: c.css }) && (
            <span style={{ fontSize: "12px" }}>&#10003;</span>
          )}
        </button>
      ))}
    </div>
    <button
      className="w-full mt-2 px-2 py-1.5 text-sm rounded hover:bg-notion-bg-hover text-left"
      style={{ color: "var(--text-secondary)" }}
      onClick={() => {
        editor.chain().focus().unsetHighlight().run();
        setActivePanel(null);
      }}
    >
      하이라이트 제거
    </button>
    <div
      className="mt-2 pt-2 text-[10px]"
      style={{
        borderTop: "1px solid var(--border-default)",
        color: "var(--text-tertiary)",
      }}
    >
      단축키: {"\u2318\u21E7H"}
    </div>
  </div>
)}
```

- [ ] **Step 3: Commit**
```
git add src/components/editor/inline-toolbar.tsx
git commit -m "feat: highlight color picker popover in inline toolbar"
```

---

### Task 5: Block Background Color in Block Menu

**Files:**
- Modify: `src/components/editor/block-menu.tsx`

- [ ] **Step 1: Add block background color submenu to block-menu.tsx**

The block menu already has a `showColors` state and a "색상" action. Expand the color panel that renders when `showColors` is true. Find the existing color rendering section (after the actions map) and replace/add:

```tsx
// After the actions list rendering, add the colors panel:
{showColors && (
  <div
    className="border-t pt-2 mt-1 px-2"
    style={{ borderColor: "var(--border-default)" }}
  >
    <div className="mb-1" style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 500 }}>
      블록 배경 색상
    </div>
    <div className="flex flex-wrap gap-1 mb-2">
      {[
        { name: "기본", css: "transparent" },
        { name: "회색", css: "var(--color-gray-bg)" },
        { name: "갈색", css: "var(--color-brown-bg)" },
        { name: "주황", css: "var(--color-orange-bg)" },
        { name: "노랑", css: "var(--color-yellow-bg)" },
        { name: "초록", css: "var(--color-green-bg)" },
        { name: "파랑", css: "var(--color-blue-bg)" },
        { name: "보라", css: "var(--color-purple-bg)" },
        { name: "분홍", css: "var(--color-pink-bg)" },
        { name: "빨강", css: "var(--color-red-bg)" },
      ].map((c) => (
        <button
          key={c.name}
          className="w-6 h-6 rounded border hover:ring-2 ring-[#2383e2]"
          style={{
            backgroundColor: c.css,
            borderColor: "var(--border-default)",
          }}
          title={c.name}
          onClick={() => {
            const node = editor.state.doc.nodeAt(pos);
            if (node) {
              const tr = editor.state.tr;
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                backgroundColor: c.css === "transparent" ? null : c.css,
              });
              editor.view.dispatch(tr);
            }
            onClose();
          }}
        />
      ))}
    </div>
    <div className="mb-1" style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 500 }}>
      텍스트 색상
    </div>
    <div className="flex flex-wrap gap-1">
      {[
        { name: "기본", css: "var(--text-primary)" },
        { name: "회색", css: "var(--color-gray)" },
        { name: "갈색", css: "var(--color-brown)" },
        { name: "주황", css: "var(--color-orange)" },
        { name: "노랑", css: "var(--color-yellow)" },
        { name: "초록", css: "var(--color-green)" },
        { name: "파랑", css: "var(--color-blue)" },
        { name: "보라", css: "var(--color-purple)" },
        { name: "분홍", css: "var(--color-pink)" },
        { name: "빨강", css: "var(--color-red)" },
      ].map((c) => (
        <button
          key={c.name}
          className="w-6 h-6 rounded flex items-center justify-center text-sm hover:ring-2 ring-[#2383e2]"
          style={{ color: c.css }}
          title={c.name}
          onClick={() => {
            editor.chain().focus().setTextSelection(pos + 1).selectAll().setColor(c.css).run();
            onClose();
          }}
        >
          A
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Commit**
```
git add src/components/editor/block-menu.tsx
git commit -m "feat: block background/text color submenu in drag-handle menu"
```

---

### Task 6: Table Advanced Controls

**Files:**
- Create: `src/components/editor/media/table-controls.tsx`
- Create: `src/components/editor/media/table-controls.css`
- Modify: `src/components/editor/editor.tsx`

- [ ] **Step 1: Create table-controls.tsx with row/col add buttons and context menu**
```tsx
// src/components/editor/media/table-controls.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { Plus, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import "./table-controls.css";

type TableControlsProps = {
  editor: Editor;
};

type MenuState = {
  type: "row" | "column";
  index: number;
  coords: { top: number; left: number };
} | null;

export function TableControls({ editor }: TableControlsProps) {
  const [contextMenu, setContextMenu] = useState<MenuState>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isTableActive = editor.isActive("table");

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAddRowBelow = useCallback(() => {
    editor.chain().focus().addRowAfter().run();
    setContextMenu(null);
  }, [editor]);

  const handleAddRowAbove = useCallback(() => {
    editor.chain().focus().addRowBefore().run();
    setContextMenu(null);
  }, [editor]);

  const handleAddColRight = useCallback(() => {
    editor.chain().focus().addColumnAfter().run();
    setContextMenu(null);
  }, [editor]);

  const handleAddColLeft = useCallback(() => {
    editor.chain().focus().addColumnBefore().run();
    setContextMenu(null);
  }, [editor]);

  const handleDeleteRow = useCallback(() => {
    editor.chain().focus().deleteRow().run();
    setContextMenu(null);
  }, [editor]);

  const handleDeleteCol = useCallback(() => {
    editor.chain().focus().deleteColumn().run();
    setContextMenu(null);
  }, [editor]);

  if (!isTableActive) return null;

  return (
    <>
      {/* Quick add row button (bottom of table) */}
      <div className="table-add-row-btn">
        <button
          onClick={handleAddRowBelow}
          className="flex items-center justify-center w-full h-6 rounded hover:bg-notion-bg-hover transition-colors"
          style={{ color: "var(--text-tertiary)" }}
          title="행 추가"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Quick add column button (right of table) */}
      <div className="table-add-col-btn">
        <button
          onClick={handleAddColRight}
          className="flex items-center justify-center w-6 h-full rounded hover:bg-notion-bg-hover transition-colors"
          style={{ color: "var(--text-tertiary)" }}
          title="열 추가"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed rounded-lg border shadow-lg py-1 min-w-[180px]"
          style={{
            top: contextMenu.coords.top,
            left: contextMenu.coords.left,
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-default)",
            zIndex: "var(--z-dropdown)",
          }}
        >
          {contextMenu.type === "row" ? (
            <>
              <button onClick={handleAddRowAbove} className="table-ctx-item">
                <ArrowUp size={14} /> 위에 행 삽입
              </button>
              <button onClick={handleAddRowBelow} className="table-ctx-item">
                <ArrowDown size={14} /> 아래에 행 삽입
              </button>
              <button
                onClick={handleDeleteRow}
                className="table-ctx-item"
                style={{ color: "#e03e3e" }}
              >
                <Trash2 size={14} /> 행 삭제
              </button>
            </>
          ) : (
            <>
              <button onClick={handleAddColLeft} className="table-ctx-item">
                <ArrowLeft size={14} /> 왼쪽에 열 삽입
              </button>
              <button onClick={handleAddColRight} className="table-ctx-item">
                <ArrowRight size={14} /> 오른쪽에 열 삽입
              </button>
              <button
                onClick={handleDeleteCol}
                className="table-ctx-item"
                style={{ color: "#e03e3e" }}
              >
                <Trash2 size={14} /> 열 삭제
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create table-controls.css**
```css
/* src/components/editor/media/table-controls.css */
.table-add-row-btn {
  opacity: 0;
  transition: opacity 0.15s;
  margin-top: 2px;
}

.table-add-col-btn {
  opacity: 0;
  transition: opacity 0.15s;
  position: absolute;
  right: -28px;
  top: 0;
  height: 100%;
}

.ProseMirror table:hover ~ .table-add-row-btn,
.table-add-row-btn:hover,
.ProseMirror table:hover ~ .table-add-col-btn,
.table-add-col-btn:hover {
  opacity: 1;
}

.table-ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  font-size: 13px;
  text-align: left;
  color: var(--text-primary);
  transition: background-color 0.1s;
}

.table-ctx-item:hover {
  background-color: var(--bg-hover);
}
```

- [ ] **Step 3: Import TableControls in editor.tsx**

In `src/components/editor/editor.tsx`, add lazy import and render:
```tsx
// Add with other lazy imports:
const TableControls = lazy(() => import("./media/table-controls").then(m => ({ default: m.TableControls })));

// Add inside the return JSX, after EditorContent:
{editor.isActive("table") && (
  <Suspense fallback={null}>
    <TableControls editor={editor} />
  </Suspense>
)}
```

- [ ] **Step 4: Commit**
```
git add src/components/editor/media/table-controls.tsx src/components/editor/media/table-controls.css src/components/editor/editor.tsx
git commit -m "feat: table add row/column buttons and context menu"
```

---

### Task 7: Formula Engine

**Files:**
- Create: `src/lib/database/formula-engine.ts`
- Modify: `src/components/database/cell-renderer.tsx`

- [ ] **Step 1: Create formula-engine.ts with all 24 functions**
```ts
// src/lib/database/formula-engine.ts

type FormulaValue = string | number | boolean | Date | null;
type PropertyGetter = (name: string) => FormulaValue;

class FormulaEngine {
  private pos = 0;
  private input = "";
  private getProp: PropertyGetter;

  constructor(getProp: PropertyGetter) {
    this.getProp = getProp;
  }

  evaluate(formula: string): FormulaValue {
    this.input = formula.trim();
    this.pos = 0;
    if (!this.input) return null;
    try {
      const result = this.parseExpression();
      return result;
    } catch {
      return null;
    }
  }

  private parseExpression(): FormulaValue {
    let left = this.parseTerm();
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      const ch = this.input[this.pos];
      if (ch === "+" || ch === "-") {
        this.pos++;
        const right = this.parseTerm();
        if (typeof left === "number" && typeof right === "number") {
          left = ch === "+" ? left + right : left - right;
        } else {
          left = String(left ?? "") + String(right ?? "");
        }
      } else {
        break;
      }
    }
    return left;
  }

  private parseTerm(): FormulaValue {
    let left = this.parseFactor();
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      const ch = this.input[this.pos];
      if (ch === "*" || ch === "/") {
        this.pos++;
        const right = this.parseFactor();
        const l = Number(left);
        const r = Number(right);
        if (ch === "*") left = l * r;
        else left = r === 0 ? null : l / r;
      } else {
        break;
      }
    }
    return left;
  }

  private parseFactor(): FormulaValue {
    this.skipWhitespace();
    const ch = this.input[this.pos];

    if (ch === "-") {
      this.pos++;
      const val = this.parseFactor();
      return -(Number(val));
    }

    if (ch === "(") {
      this.pos++;
      const val = this.parseExpression();
      this.skipWhitespace();
      if (this.input[this.pos] === ")") this.pos++;
      return val;
    }

    if (ch === '"') return this.parseString();

    if (ch !== undefined && ((ch >= "0" && ch <= "9") || ch === ".")) {
      return this.parseNumber();
    }

    if (ch !== undefined && /[a-zA-Z_]/.test(ch)) {
      return this.parseFunctionOrIdent();
    }

    return null;
  }

  private parseString(): string {
    this.pos++; // skip opening "
    let str = "";
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      if (this.input[this.pos] === "\\" && this.pos + 1 < this.input.length) {
        this.pos++;
      }
      str += this.input[this.pos];
      this.pos++;
    }
    this.pos++; // skip closing "
    return str;
  }

  private parseNumber(): number {
    const start = this.pos;
    while (this.pos < this.input.length && /[\d.]/.test(this.input[this.pos]!)) {
      this.pos++;
    }
    return parseFloat(this.input.slice(start, this.pos));
  }

  private parseFunctionOrIdent(): FormulaValue {
    const start = this.pos;
    while (this.pos < this.input.length && /[a-zA-Z_\d]/.test(this.input[this.pos]!)) {
      this.pos++;
    }
    const name = this.input.slice(start, this.pos);
    this.skipWhitespace();

    // Check for true/false literals
    if (name === "true") return true;
    if (name === "false") return false;

    if (this.input[this.pos] !== "(") return null;
    this.pos++; // skip (

    const args = this.parseArgs();
    this.skipWhitespace();
    if (this.input[this.pos] === ")") this.pos++;

    return this.callFunction(name, args);
  }

  private parseArgs(): FormulaValue[] {
    const args: FormulaValue[] = [];
    this.skipWhitespace();
    if (this.input[this.pos] === ")") return args;

    args.push(this.parseExpression());
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.input[this.pos] !== ",") break;
      this.pos++;
      args.push(this.parseExpression());
    }
    return args;
  }

  private skipWhitespace() {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos]!)) {
      this.pos++;
    }
  }

  private callFunction(name: string, args: FormulaValue[]): FormulaValue {
    switch (name) {
      case "prop":
        return this.getProp(String(args[0] ?? ""));

      case "if":
        return args[0] ? args[1] ?? null : args[2] ?? null;

      case "add":
        return Number(args[0] ?? 0) + Number(args[1] ?? 0);

      case "subtract":
        return Number(args[0] ?? 0) - Number(args[1] ?? 0);

      case "multiply":
        return Number(args[0] ?? 0) * Number(args[1] ?? 0);

      case "divide": {
        const divisor = Number(args[1] ?? 0);
        return divisor === 0 ? null : Number(args[0] ?? 0) / divisor;
      }

      case "now":
        return new Date();

      case "length":
        return String(args[0] ?? "").length;

      case "contains":
        return String(args[0] ?? "").includes(String(args[1] ?? ""));

      case "lower":
        return String(args[0] ?? "").toLowerCase();

      case "upper":
        return String(args[0] ?? "").toUpperCase();

      case "round":
        return Math.round(Number(args[0] ?? 0));

      case "ceil":
        return Math.ceil(Number(args[0] ?? 0));

      case "floor":
        return Math.floor(Number(args[0] ?? 0));

      case "dateAdd": {
        const date = new Date(args[0] as string | number | Date);
        const num = Number(args[1] ?? 0);
        const unit = String(args[2] ?? "days");
        const ms = unit === "years" ? num * 365.25 * 86400000
          : unit === "months" ? num * 30 * 86400000
          : unit === "weeks" ? num * 7 * 86400000
          : unit === "hours" ? num * 3600000
          : unit === "minutes" ? num * 60000
          : num * 86400000;
        return new Date(date.getTime() + ms);
      }

      case "dateBetween": {
        const d1 = new Date(args[0] as string | number | Date);
        const d2 = new Date(args[1] as string | number | Date);
        const u = String(args[2] ?? "days");
        const diffMs = d1.getTime() - d2.getTime();
        if (u === "years") return Math.floor(diffMs / (365.25 * 86400000));
        if (u === "months") return Math.floor(diffMs / (30 * 86400000));
        if (u === "weeks") return Math.floor(diffMs / (7 * 86400000));
        if (u === "hours") return Math.floor(diffMs / 3600000);
        if (u === "minutes") return Math.floor(diffMs / 60000);
        return Math.floor(diffMs / 86400000);
      }

      case "formatDate": {
        const d = new Date(args[0] as string | number | Date);
        const fmt = String(args[1] ?? "YYYY-MM-DD");
        return fmt
          .replace("YYYY", String(d.getFullYear()))
          .replace("MM", String(d.getMonth() + 1).padStart(2, "0"))
          .replace("DD", String(d.getDate()).padStart(2, "0"));
      }

      case "and":
        return Boolean(args[0]) && Boolean(args[1]);

      case "or":
        return Boolean(args[0]) || Boolean(args[1]);

      case "not":
        return !args[0];

      case "empty":
        return args[0] === null || args[0] === undefined || args[0] === "";

      case "sum":
        return args.reduce((acc, v) => Number(acc) + Number(v ?? 0), 0 as FormulaValue) as number;

      case "average": {
        const nums = args.filter((v) => v !== null && v !== undefined);
        if (nums.length === 0) return 0;
        const total = nums.reduce((a, v) => Number(a) + Number(v), 0);
        return Number(total) / nums.length;
      }

      case "min":
        return Math.min(...args.map((v) => Number(v ?? Infinity)));

      case "max":
        return Math.max(...args.map((v) => Number(v ?? -Infinity)));

      case "count":
        return args.filter((v) => v !== null && v !== undefined && v !== "").length;

      default:
        return null;
    }
  }
}

export function evaluateFormula(
  formula: string,
  getProperty: (name: string) => FormulaValue
): FormulaValue {
  const engine = new FormulaEngine(getProperty);
  return engine.evaluate(formula);
}

export function formatFormulaResult(value: FormulaValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return value.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}
```

- [ ] **Step 2: Update cell-renderer.tsx to use formula engine for formula type**

In `src/components/database/cell-renderer.tsx`, add the formula case in the `renderByType` switch. Add import and case:
```tsx
// Add import at top:
import { evaluateFormula, formatFormulaResult } from "@/lib/database/formula-engine";

// Add case in the switch, before default:
case "formula": {
  const formulaStr = (config.formula as string) || "";
  if (!formulaStr) return <span className="text-[var(--text-tertiary)]">&mdash;</span>;
  // value here carries the row values keyed by property ID
  const rowValues = (typeof value === "object" && value !== null) ? value as Record<string, unknown> : {};
  const result = evaluateFormula(formulaStr, (propName: string) => {
    // Find property by name from config.properties
    const props = (config.properties || []) as { id: string; name: string }[];
    const prop = props.find((p) => p.name === propName);
    return prop ? (rowValues[prop.id] as string | number | boolean | null) ?? null : null;
  });
  return <span className="font-mono text-sm">{formatFormulaResult(result)}</span>;
}
```

- [ ] **Step 3: Commit**
```
git add src/lib/database/formula-engine.ts src/components/database/cell-renderer.tsx
git commit -m "feat: formula engine evaluating all 24 functions with inline cell rendering"
```

---

### Task 8: Full-Width Page Toggle

**Files:**
- Modify: `src/components/layout/topbar.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add full-width toggle button to topbar.tsx**

The Page model already has `isFullWidth` in the Prisma schema. In `src/components/layout/topbar.tsx`, locate the topbar actions area and add a toggle button. Find the area where the other action buttons are rendered and add:

```tsx
// Import at top:
import { ArrowLeftRight } from "lucide-react"; // already imported

// Add the toggle button in the topbar actions (near Lock/Star buttons):
{page && (
  <button
    onClick={() => {
      toggleFullWidthMutation.mutate({
        pageId: page.id,
        isFullWidth: !page.isFullWidth,
      });
    }}
    className="p-1.5 rounded hover:bg-notion-bg-hover transition-colors"
    style={{ color: page.isFullWidth ? "#2383e2" : "var(--text-tertiary)" }}
    title={page.isFullWidth ? "기본 너비" : "전체 너비"}
  >
    <ArrowLeftRight size={16} />
  </button>
)}
```

Add the tRPC mutation:
```tsx
const toggleFullWidthMutation = trpc.page.update.useMutation({
  onSuccess: () => utils.page.get.invalidate(),
});
```

- [ ] **Step 2: Add full-width CSS to globals.css**

Append to `src/app/globals.css`:
```css
/* Full-width page mode */
.page-full-width .notion-editor,
.page-full-width .page-content-wrapper {
  max-width: 100% !important;
  padding-left: 2rem;
  padding-right: 2rem;
}

@media (min-width: 1024px) {
  .page-full-width .notion-editor,
  .page-full-width .page-content-wrapper {
    padding-left: 5rem;
    padding-right: 5rem;
  }
}
```

- [ ] **Step 3: Commit**
```
git add src/components/layout/topbar.tsx src/app/globals.css
git commit -m "feat: full-width page toggle with topbar button and responsive CSS"
```
