# Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Notion clone fully usable on mobile and tablet devices with touch gestures, responsive layouts, and a mobile-optimized editing toolbar.
**Architecture:** Build on the existing `ResponsiveProvider` and `useResponsive()` hook. Touch gestures are isolated in a reusable hook. Component changes are additive -- desktop behavior is preserved, mobile paths are gated behind `isMobile`/`isTablet` checks. The editor gets a mobile floating toolbar that replaces the desktop inline toolbar on small screens.
**Tech Stack:** React 18, TipTap 2, Tailwind CSS (sm:/md:/lg:), Touch Events API, Zustand

---

### Task 1: Touch Gesture Hook

**Files:**
- Create: `src/hooks/use-touch-gestures.ts`

- [ ] **Step 1: Create the swipe gesture hook**
```ts
// src/hooks/use-touch-gestures.ts
"use client";

import { useRef, useEffect, useCallback } from "react";

export type SwipeDirection = "left" | "right" | "up" | "down";

type TouchGestureOptions = {
  onSwipe?: (direction: SwipeDirection) => void;
  onLongPress?: (e: TouchEvent) => void;
  swipeThreshold?: number;
  longPressMs?: number;
  /** Element ref -- if not provided, uses document */
  ref?: React.RefObject<HTMLElement | null>;
};

export function useTouchGestures({
  onSwipe,
  onLongPress,
  swipeThreshold = 50,
  longPressMs = 500,
  ref,
}: TouchGestureOptions) {
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const el = ref?.current ?? document;

    const handleTouchStart = (e: Event) => {
      const touch = (e as TouchEvent).touches[0];
      if (!touch) return;
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      startTime.current = Date.now();
      moved.current = false;

      if (onLongPress) {
        longPressTimer.current = setTimeout(() => {
          if (!moved.current) {
            onLongPress(e as TouchEvent);
          }
        }, longPressMs);
      }
    };

    const handleTouchMove = (e: Event) => {
      const touch = (e as TouchEvent).touches[0];
      if (!touch) return;
      const dx = Math.abs(touch.clientX - startX.current);
      const dy = Math.abs(touch.clientY - startY.current);
      if (dx > 10 || dy > 10) {
        moved.current = true;
        clearLongPress();
      }
    };

    const handleTouchEnd = (e: Event) => {
      clearLongPress();
      const touch = (e as TouchEvent).changedTouches[0];
      if (!touch || !onSwipe) return;

      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;
      const elapsed = Date.now() - startTime.current;

      // Must complete within 300ms to count as swipe
      if (elapsed > 300) return;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx > swipeThreshold && absDx > absDy) {
        onSwipe(dx > 0 ? "right" : "left");
      } else if (absDy > swipeThreshold && absDy > absDx) {
        onSwipe(dy > 0 ? "down" : "up");
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      clearLongPress();
    };
  }, [ref, onSwipe, onLongPress, swipeThreshold, longPressMs, clearLongPress]);
}
```

- [ ] **Step 2: Commit**
```
git add src/hooks/use-touch-gestures.ts
git commit -m "feat: reusable touch gesture hook (swipe + long press)"
```

---

### Task 2: Sidebar Mobile Overlay with Swipe

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add swipe-to-open gesture on document and overlay mode**

In `src/components/layout/sidebar.tsx`, add imports and swipe handling:

```tsx
// Add import at top:
import { useTouchGestures } from "@/hooks/use-touch-gestures";

// Inside the Sidebar component, add swipe gesture:
useTouchGestures({
  onSwipe: (direction) => {
    if (direction === "right" && !isOpen && isMobile) {
      useSidebarStore.getState().setOpen(true);
    }
    if (direction === "left" && isOpen && isMobile) {
      useSidebarStore.getState().setOpen(false);
    }
  },
  swipeThreshold: 60,
});
```

- [ ] **Step 2: Wrap sidebar in mobile overlay container**

Replace the sidebar `<aside>` wrapper to conditionally render an overlay on mobile. Update the outer rendering:

```tsx
// Replace the sidebar's return to add overlay:
return (
  <>
    {/* Mobile overlay backdrop */}
    {isMobile && isOpen && (
      <div
        className="fixed inset-0 bg-black/30 z-[39]"
        onClick={() => useSidebarStore.getState().setOpen(false)}
        aria-hidden="true"
      />
    )}

    {/* Hover zone for desktop */}
    {!isMobile && !isOpen && !isHoverExpanded && (
      <div
        className="fixed left-0 top-0 w-2 h-full z-[41]"
        onMouseEnter={handleHoverZoneEnter}
        onMouseLeave={handleHoverZoneLeave}
      />
    )}

    <aside
      className={cn(
        "flex flex-col h-full overflow-hidden border-r shrink-0 transition-[width,transform] duration-200",
        isMobile && "fixed top-0 left-0 z-[40] h-full",
        isMobile && !isOpen && "-translate-x-full",
        isMobile && isOpen && "translate-x-0",
      )}
      style={{
        width: isMobile ? MOBILE_SIDEBAR_WIDTH : (isOpen || isHoverExpanded ? width : 0),
        backgroundColor: "var(--bg-sidebar)",
        borderColor: "var(--border-default)",
      }}
      onMouseLeave={handleSidebarMouseLeave}
      onMouseEnter={handleSidebarMouseEnter}
    >
      {/* ... existing sidebar content ... */}
    </aside>
  </>
);
```

- [ ] **Step 3: Commit**
```
git add src/components/layout/sidebar.tsx
git commit -m "feat: mobile sidebar overlay with swipe gesture"
```

---

### Task 3: Mobile Editor Toolbar

**Files:**
- Create: `src/components/editor/mobile-toolbar.tsx`
- Modify: `src/components/editor/editor.tsx`

- [ ] **Step 1: Create mobile-toolbar.tsx with floating bottom format bar**
```tsx
// src/components/editor/mobile-toolbar.tsx
"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, List, ListOrdered, ListChecks,
  Code, Quote, Highlighter, Link as LinkIcon, Undo2, Redo2,
  ChevronUp, ChevronDown, Type,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MobileToolbarProps = {
  editor: Editor;
};

type ToolGroup = "format" | "blocks" | "history";

const FORMAT_BUTTONS = [
  { icon: Bold, label: "Bold", action: (e: Editor) => e.chain().focus().toggleBold().run(), isActive: (e: Editor) => e.isActive("bold") },
  { icon: Italic, label: "Italic", action: (e: Editor) => e.chain().focus().toggleItalic().run(), isActive: (e: Editor) => e.isActive("italic") },
  { icon: UnderlineIcon, label: "Underline", action: (e: Editor) => e.chain().focus().toggleUnderline().run(), isActive: (e: Editor) => e.isActive("underline") },
  { icon: Strikethrough, label: "Strike", action: (e: Editor) => e.chain().focus().toggleStrike().run(), isActive: (e: Editor) => e.isActive("strike") },
  { icon: Highlighter, label: "Highlight", action: (e: Editor) => e.chain().focus().toggleHighlight({ color: "var(--color-yellow-bg)" }).run(), isActive: (e: Editor) => e.isActive("highlight") },
  { icon: Code, label: "Code", action: (e: Editor) => e.chain().focus().toggleCode().run(), isActive: (e: Editor) => e.isActive("code") },
  { icon: LinkIcon, label: "Link", action: (e: Editor) => {
    const url = prompt("URL");
    if (url) e.chain().focus().setLink({ href: url }).run();
  }, isActive: (e: Editor) => e.isActive("link") },
];

const BLOCK_BUTTONS = [
  { icon: Type, label: "Text", action: (e: Editor) => e.chain().focus().setParagraph().run(), isActive: (e: Editor) => e.isActive("paragraph") },
  { icon: Heading1, label: "H1", action: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run(), isActive: (e: Editor) => e.isActive("heading", { level: 1 }) },
  { icon: Heading2, label: "H2", action: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run(), isActive: (e: Editor) => e.isActive("heading", { level: 2 }) },
  { icon: List, label: "Bullet", action: (e: Editor) => e.chain().focus().toggleBulletList().run(), isActive: (e: Editor) => e.isActive("bulletList") },
  { icon: ListOrdered, label: "Number", action: (e: Editor) => e.chain().focus().toggleOrderedList().run(), isActive: (e: Editor) => e.isActive("orderedList") },
  { icon: ListChecks, label: "Todo", action: (e: Editor) => e.chain().focus().toggleTaskList().run(), isActive: (e: Editor) => e.isActive("taskList") },
  { icon: Quote, label: "Quote", action: (e: Editor) => e.chain().focus().toggleBlockquote().run(), isActive: (e: Editor) => e.isActive("blockquote") },
];

export function MobileToolbar({ editor }: MobileToolbarProps) {
  const [activeGroup, setActiveGroup] = useState<ToolGroup>("format");
  const [expanded, setExpanded] = useState(false);

  if (!editor.isFocused && !expanded) return null;

  const buttons = activeGroup === "format"
    ? FORMAT_BUTTONS
    : activeGroup === "blocks"
      ? BLOCK_BUTTONS
      : [];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 border-t safe-area-pb"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
        zIndex: "var(--z-dropdown)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Tool group tabs */}
      <div className="flex items-center border-b" style={{ borderColor: "var(--border-divider)" }}>
        {(["format", "blocks", "history"] as const).map((group) => (
          <button
            key={group}
            onClick={() => setActiveGroup(group)}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors",
              activeGroup === group
                ? "text-[#2383e2] border-b-2 border-[#2383e2]"
                : "text-[var(--text-tertiary)]"
            )}
          >
            {group === "format" ? "서식" : group === "blocks" ? "블록" : "기록"}
          </button>
        ))}
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-2"
          style={{ color: "var(--text-tertiary)" }}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {/* Buttons row */}
      <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto">
        {activeGroup === "history" ? (
          <>
            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="p-2.5 rounded-md hover:bg-notion-bg-hover disabled:opacity-30"
              style={{ color: "var(--text-primary)" }}
            >
              <Undo2 size={18} />
            </button>
            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="p-2.5 rounded-md hover:bg-notion-bg-hover disabled:opacity-30"
              style={{ color: "var(--text-primary)" }}
            >
              <Redo2 size={18} />
            </button>
          </>
        ) : (
          buttons.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.label}
                onClick={() => btn.action(editor)}
                className={cn(
                  "p-2.5 rounded-md transition-colors shrink-0",
                  btn.isActive(editor)
                    ? "bg-[#2383e2]/10"
                    : "hover:bg-notion-bg-hover"
                )}
                style={{
                  color: btn.isActive(editor) ? "#2383e2" : "var(--text-primary)",
                }}
                title={btn.label}
              >
                <Icon size={18} />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrate MobileToolbar in editor.tsx**

In `src/components/editor/editor.tsx`:
```tsx
// Add import at top:
import { useDevice } from "@/components/providers/responsive-provider";

// Add lazy import:
const MobileToolbar = lazy(() => import("./mobile-toolbar").then(m => ({ default: m.MobileToolbar })));

// Inside the NotionEditor component, get isMobile:
const { isMobile } = useDevice();

// Add to JSX, at the end of the return, before closing </div>:
{isMobile && editor && (
  <Suspense fallback={null}>
    <MobileToolbar editor={editor} />
  </Suspense>
)}
```

- [ ] **Step 3: Commit**
```
git add src/components/editor/mobile-toolbar.tsx src/components/editor/editor.tsx
git commit -m "feat: floating mobile toolbar with format/block/history tabs"
```

---

### Task 4: Touch Drag Handle (Long-Press Block Reorder)

**Files:**
- Create: `src/components/editor/extensions/touch-drag-handle.ts`
- Modify: `src/components/editor/editor.tsx`

- [ ] **Step 1: Create touch-drag-handle extension**
```ts
// src/components/editor/extensions/touch-drag-handle.ts
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const TOUCH_DRAG_KEY = new PluginKey("touchDragHandle");

export const TouchDragHandle = Extension.create({
  name: "touchDragHandle",

  addProseMirrorPlugins() {
    const editor = this.editor;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let dragStartPos = -1;
    let dragNode: HTMLElement | null = null;
    let placeholder: HTMLElement | null = null;

    return [
      new Plugin({
        key: TOUCH_DRAG_KEY,
        props: {
          handleDOMEvents: {
            touchstart(view, event) {
              const touch = event.touches[0];
              if (!touch) return false;

              const pos = view.posAtCoords({
                left: touch.clientX,
                top: touch.clientY,
              });
              if (!pos) return false;

              longPressTimer = setTimeout(() => {
                // Find the top-level node at this position
                const $pos = view.state.doc.resolve(pos.pos);
                if ($pos.depth < 1) return;

                const nodePos = $pos.before(1);
                const node = view.state.doc.nodeAt(nodePos);
                if (!node) return;

                dragStartPos = nodePos;

                // Visual feedback -- highlight the block
                const dom = view.nodeDOM(nodePos);
                if (dom instanceof HTMLElement) {
                  dragNode = dom;
                  dom.style.opacity = "0.5";
                  dom.style.outline = "2px dashed #2383e2";

                  // Haptic feedback if available
                  if (navigator.vibrate) navigator.vibrate(50);
                }
              }, 500);

              return false;
            },

            touchmove(_view, _event) {
              if (longPressTimer && dragStartPos === -1) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
              }
              return false;
            },

            touchend(view, event) {
              if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
              }

              if (dragStartPos === -1) return false;

              const touch = event.changedTouches[0];
              if (!touch) {
                dragStartPos = -1;
                return false;
              }

              // Find drop target position
              const dropCoords = view.posAtCoords({
                left: touch.clientX,
                top: touch.clientY,
              });

              if (dropCoords) {
                const $drop = view.state.doc.resolve(dropCoords.pos);
                if ($drop.depth >= 1) {
                  const dropPos = $drop.before(1);
                  const sourceNode = view.state.doc.nodeAt(dragStartPos);

                  if (sourceNode && dropPos !== dragStartPos) {
                    const tr = view.state.tr;
                    const slice = view.state.doc.slice(
                      dragStartPos,
                      dragStartPos + sourceNode.nodeSize
                    );
                    tr.delete(dragStartPos, dragStartPos + sourceNode.nodeSize);

                    const adjustedPos = dropPos > dragStartPos
                      ? dropPos - sourceNode.nodeSize
                      : dropPos;

                    tr.insert(Math.max(0, adjustedPos), slice.content);
                    view.dispatch(tr);
                  }
                }
              }

              // Cleanup visual
              if (dragNode) {
                dragNode.style.opacity = "";
                dragNode.style.outline = "";
                dragNode = null;
              }
              if (placeholder) {
                placeholder.remove();
                placeholder = null;
              }

              dragStartPos = -1;
              return true;
            },
          },
        },
      }),
    ];
  },
});
```

- [ ] **Step 2: Register extension in editor.tsx (mobile only)**

In `src/components/editor/editor.tsx`, add:
```tsx
// Add import:
import { TouchDragHandle } from "./extensions/touch-drag-handle";

// In the extensions array, conditionally add for touch devices:
// After LinkPreviewExtension line, add:
...(typeof window !== "undefined" && "ontouchstart" in window ? [TouchDragHandle] : []),
```

- [ ] **Step 3: Commit**
```
git add src/components/editor/extensions/touch-drag-handle.ts src/components/editor/editor.tsx
git commit -m "feat: long-press touch drag handle for mobile block reordering"
```

---

### Task 5: Mobile Database Views

**Files:**
- Modify: `src/components/database/database-view.tsx`

- [ ] **Step 1: Add mobile layout adaptations to database-view.tsx**

In `src/components/database/database-view.tsx`, add mobile detection and conditional rendering:

```tsx
// Add import at top:
import { useDevice } from "@/components/providers/responsive-provider";

// Inside the component:
const { isMobile } = useDevice();

// For table view on mobile, add card list wrapper:
// Wrap the table rendering section with:
{isMobile && currentView?.type === "table" ? (
  <div className="flex flex-col gap-2 px-2">
    {rows.map((row) => (
      <div
        key={row.id}
        className="rounded-lg border p-3"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border-default)",
        }}
        onClick={() => onRowClick?.(row.id)}
      >
        <div className="font-medium mb-1" style={{ color: "var(--text-primary)" }}>
          {String(row.values[titlePropId] || "Untitled")}
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleProperties.slice(0, 3).map((prop) => (
            <div key={prop.id} className="text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="font-medium">{prop.name}: </span>
              <CellRenderer value={row.values[prop.id]} type={prop.type} config={prop.config} />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
) : (
  /* existing table rendering */
)}

// For board view on mobile, add horizontal scroll:
// Wrap board columns with:
<div className={cn(
  "flex gap-3",
  isMobile && "overflow-x-auto snap-x snap-mandatory pb-4 -mx-2 px-2",
)}>
  {/* board columns -- add snap-start to each column */}
</div>

// For calendar view on mobile, switch to week view:
// Add week-only mode when isMobile is true
```

- [ ] **Step 2: Commit**
```
git add src/components/database/database-view.tsx
git commit -m "feat: mobile-optimized database views (card list, scrollable board)"
```

---

### Task 6: Editor Mobile Layout Adjustments

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/editor/editor.tsx`

- [ ] **Step 1: Add mobile editor CSS to globals.css**

Append to `src/app/globals.css`:
```css
/* Mobile Editor Adjustments */
@media (max-width: 767px) {
  .notion-editor {
    padding-left: 1rem !important;
    padding-right: 1rem !important;
    font-size: 15px;
  }

  .notion-editor h1 {
    font-size: 1.625em;
  }

  .notion-editor h2 {
    font-size: 1.375em;
  }

  .notion-editor h3 {
    font-size: 1.125em;
  }

  /* Full width blocks on mobile */
  .notion-editor .notion-synced-block,
  .notion-editor .notion-callout,
  .notion-editor table {
    margin-left: -0.5rem;
    margin-right: -0.5rem;
    border-radius: 0;
  }

  /* Column list stacks vertically on mobile */
  .notion-editor .column-list {
    flex-direction: column !important;
  }

  .notion-editor .column-list .column {
    width: 100% !important;
    min-width: 100% !important;
  }

  /* Add bottom padding for mobile toolbar */
  .notion-editor {
    padding-bottom: 80px !important;
  }
}

/* Tablet adjustments */
@media (min-width: 768px) and (max-width: 1023px) {
  .notion-editor {
    padding-left: 2rem !important;
    padding-right: 2rem !important;
  }
}
```

- [ ] **Step 2: Conditionally hide desktop-only components on mobile**

In `src/components/editor/editor.tsx`, wrap desktop-only components:

```tsx
// Wrap DragHandle, BlockMenu, InlineToolbar in desktop-only rendering:
{!isMobile && editor.view && (
  <Suspense fallback={null}>
    <InlineToolbar editor={editor} onAddComment={onAddComment} />
    <DragHandle editor={editor} onMenuOpen={(pos) => {
      if (!editor.view) return;
      const coords = editor.view.coordsAtPos(pos);
      setMenuState({ pos, coords: { top: coords.top, left: coords.left - 4 } });
    }} />
  </Suspense>
)}

// SlashCommand, MentionList, BlockContextMenu remain on both mobile and desktop
{editor.view && (
  <Suspense fallback={null}>
    <SlashCommand editor={editor} />
    <MentionList editor={editor} items={mentionItems} />
    <BlockContextMenu editor={editor} onTurnIntoPage={onTurnIntoPage} onAddComment={onAddComment} />
  </Suspense>
)}
```

- [ ] **Step 3: Commit**
```
git add src/app/globals.css src/components/editor/editor.tsx
git commit -m "feat: mobile editor layout — stacked columns, reduced padding, toolbar spacing"
```
