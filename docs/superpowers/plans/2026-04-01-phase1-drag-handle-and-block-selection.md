# Phase 1-A: Drag Handle Redesign + Block Selection System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix drag handle disappearing bugs, add state-machine visibility, improve block selection visuals and multi-select UX.

**Architecture:** Replace timer-based show/hide with a 4-state machine (`useReducer`). Fix position calculation to be relative to block elements. Add CSS for block selection visuals. Extend selection with Cmd+A, lasso drag, and floating action bar.

**Tech Stack:** React 18, Tiptap 3, ProseMirror, Tailwind CSS, lucide-react, vitest

---

## File Structure

### New Files
- `src/components/editor/use-drag-handle-visibility.ts` — State machine hook for handle show/hide
- `src/components/editor/selection-action-bar.tsx` — Floating toolbar for multi-block selection
- `tests/components/editor/use-drag-handle-visibility.test.ts` — State machine unit tests
- `tests/components/editor/block-selection.test.ts` — Block selection logic tests

### Modified Files
- `src/components/editor/drag-handle.tsx` — Rewrite to use new state machine + fix positioning
- `src/components/editor/extensions/block-selection.ts` — Add Cmd+A, fix range selection, improve clipboard
- `src/app/globals.css` — Add block selection visual styles
- `src/styles/notion-tokens.css` — Add accent color tokens

---

## Task 1: Add Design Tokens for Selection & Accent Colors

**Files:**
- Modify: `src/styles/notion-tokens.css:1-74` (light theme root)
- Modify: `src/styles/notion-tokens.css:76-116` (dark theme)

- [ ] **Step 1: Add accent and selection tokens to light theme**

In `src/styles/notion-tokens.css`, add after the `--color-red-bg` line (line 49), before the `/* Sizing */` comment (line 51):

```css
  /* Accent */
  --accent-blue: #2383e2;
  --accent-blue-light: rgba(35, 131, 226, 0.08);
  --accent-blue-hover: rgba(35, 131, 226, 0.12);
  --accent-blue-drag: rgba(35, 131, 226, 0.05);

  /* Selection */
  --selection-bg: rgba(35, 131, 226, 0.08);
  --selection-bg-hover: rgba(35, 131, 226, 0.12);
  --selection-border: #2383e2;
  --selection-drag-bg: rgba(35, 131, 226, 0.05);
  --selection-drag-border: #2383e2;

  /* Comment highlight */
  --comment-highlight: rgba(255, 212, 0, 0.3);
```

- [ ] **Step 2: Add dark theme selection tokens**

In the `[data-theme="dark"]` block, add after `--color-red-bg` (line 115):

```css
  --accent-blue: #2383e2;
  --accent-blue-light: rgba(35, 131, 226, 0.15);
  --accent-blue-hover: rgba(35, 131, 226, 0.20);
  --accent-blue-drag: rgba(35, 131, 226, 0.08);

  --selection-bg: rgba(35, 131, 226, 0.15);
  --selection-bg-hover: rgba(35, 131, 226, 0.20);
  --selection-border: #2383e2;
  --selection-drag-bg: rgba(35, 131, 226, 0.08);
  --selection-drag-border: #2383e2;

  --comment-highlight: rgba(255, 212, 0, 0.25);
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/notion-tokens.css
git commit -m "feat: add accent color and selection design tokens"
```

---

## Task 2: Fix Block Selection CSS (Critical Visual Bug)

**Files:**
- Modify: `src/app/globals.css:97-99`

- [ ] **Step 1: Replace the empty `.notion-block-selected` rule**

In `src/app/globals.css`, replace lines 96-99:

```css
/* 5.7 Selection animation */
.notion-block-selected {
  transition: background-color 150ms ease;
}
```

with:

```css
/* 5.7 Block selection */
.notion-block-selected {
  background-color: var(--selection-bg);
  border-left: 3px solid var(--selection-border);
  border-radius: 2px 0 0 2px;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.notion-block-selected:hover {
  background-color: var(--selection-bg-hover);
}

/* Consecutive selected blocks: connect left borders */
.notion-block-selected + .notion-block-selected {
  margin-top: -1px;
}

/* Drag source */
.notion-block-drag-source {
  background-color: var(--selection-drag-bg);
  border-left: 3px dashed var(--selection-drag-border);
  border-radius: 2px 0 0 2px;
  opacity: 0.7;
}

/* Lasso selection rectangle */
.notion-lasso {
  position: fixed;
  border: 1px solid var(--accent-blue);
  background-color: rgba(35, 131, 226, 0.04);
  pointer-events: none;
  z-index: 1000;
}
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`
Open a page with multiple blocks, use shift+click on drag handles to multi-select. Confirm blue background and left border appear on selected blocks.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "fix: add visible block selection styles (background + border)"
```

---

## Task 3: Drag Handle Visibility State Machine

**Files:**
- Create: `src/components/editor/use-drag-handle-visibility.ts`
- Create: `tests/components/editor/use-drag-handle-visibility.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/editor/use-drag-handle-visibility.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  visibilityReducer,
  type VisibilityState,
  type VisibilityAction,
} from "@/components/editor/use-drag-handle-visibility";

describe("visibilityReducer", () => {
  it("transitions HIDDEN -> APPEARING on SHOW", () => {
    const state: VisibilityState = {
      phase: "hidden",
      blockPos: null,
      handlePosition: null,
    };
    const result = visibilityReducer(state, {
      type: "SHOW",
      blockPos: 0,
      handlePosition: { top: 100, left: 50 },
    });
    expect(result.phase).toBe("appearing");
    expect(result.blockPos).toBe(0);
    expect(result.handlePosition).toEqual({ top: 100, left: 50 });
  });

  it("transitions APPEARING -> VISIBLE on TRANSITION_END", () => {
    const state: VisibilityState = {
      phase: "appearing",
      blockPos: 0,
      handlePosition: { top: 100, left: 50 },
    };
    const result = visibilityReducer(state, { type: "TRANSITION_END" });
    expect(result.phase).toBe("visible");
  });

  it("transitions VISIBLE -> DISAPPEARING on HIDE", () => {
    const state: VisibilityState = {
      phase: "visible",
      blockPos: 0,
      handlePosition: { top: 100, left: 50 },
    };
    const result = visibilityReducer(state, { type: "HIDE" });
    expect(result.phase).toBe("disappearing");
  });

  it("transitions DISAPPEARING -> HIDDEN on TRANSITION_END", () => {
    const state: VisibilityState = {
      phase: "disappearing",
      blockPos: 0,
      handlePosition: { top: 100, left: 50 },
    };
    const result = visibilityReducer(state, { type: "TRANSITION_END" });
    expect(result.phase).toBe("hidden");
    expect(result.blockPos).toBeNull();
    expect(result.handlePosition).toBeNull();
  });

  it("DISAPPEARING -> VISIBLE on SHOW (handle hover recovery)", () => {
    const state: VisibilityState = {
      phase: "disappearing",
      blockPos: 0,
      handlePosition: { top: 100, left: 50 },
    };
    const result = visibilityReducer(state, {
      type: "SHOW",
      blockPos: 5,
      handlePosition: { top: 200, left: 50 },
    });
    expect(result.phase).toBe("visible");
    expect(result.blockPos).toBe(5);
  });

  it("VISIBLE -> VISIBLE on SHOW (update position without disappearing)", () => {
    const state: VisibilityState = {
      phase: "visible",
      blockPos: 0,
      handlePosition: { top: 100, left: 50 },
    };
    const result = visibilityReducer(state, {
      type: "SHOW",
      blockPos: 10,
      handlePosition: { top: 300, left: 50 },
    });
    expect(result.phase).toBe("visible");
    expect(result.blockPos).toBe(10);
    expect(result.handlePosition).toEqual({ top: 300, left: 50 });
  });

  it("LOCK prevents HIDE", () => {
    const state: VisibilityState = {
      phase: "visible",
      blockPos: 0,
      handlePosition: { top: 100, left: 50 },
    };
    const locked = visibilityReducer(state, { type: "LOCK" });
    expect(locked.locked).toBe(true);
    const afterHide = visibilityReducer(locked, { type: "HIDE" });
    expect(afterHide.phase).toBe("visible"); // stays visible while locked
  });

  it("UNLOCK after LOCK allows HIDE", () => {
    const state: VisibilityState = {
      phase: "visible",
      blockPos: 0,
      handlePosition: { top: 100, left: 50 },
      locked: true,
    };
    const unlocked = visibilityReducer(state, { type: "UNLOCK" });
    expect(unlocked.locked).toBe(false);
  });

  it("HIDDEN ignores HIDE", () => {
    const state: VisibilityState = {
      phase: "hidden",
      blockPos: null,
      handlePosition: null,
    };
    const result = visibilityReducer(state, { type: "HIDE" });
    expect(result.phase).toBe("hidden");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/editor/use-drag-handle-visibility.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the state machine**

Create `src/components/editor/use-drag-handle-visibility.ts`:

```typescript
import { useReducer, useRef, useCallback, useEffect } from "react";

export type HandlePosition = { top: number; left: number };

export type VisibilityState = {
  phase: "hidden" | "appearing" | "visible" | "disappearing";
  blockPos: number | null;
  handlePosition: HandlePosition | null;
  locked?: boolean;
};

export type VisibilityAction =
  | { type: "SHOW"; blockPos: number; handlePosition: HandlePosition }
  | { type: "HIDE" }
  | { type: "TRANSITION_END" }
  | { type: "LOCK" }
  | { type: "UNLOCK" };

const INITIAL_STATE: VisibilityState = {
  phase: "hidden",
  blockPos: null,
  handlePosition: null,
  locked: false,
};

export function visibilityReducer(
  state: VisibilityState,
  action: VisibilityAction
): VisibilityState {
  switch (action.type) {
    case "SHOW": {
      const update = {
        blockPos: action.blockPos,
        handlePosition: action.handlePosition,
        locked: state.locked,
      };
      if (state.phase === "hidden" || state.phase === "appearing") {
        return { ...update, phase: "appearing" };
      }
      // VISIBLE or DISAPPEARING -> jump to VISIBLE with new position
      return { ...update, phase: "visible" };
    }
    case "HIDE": {
      if (state.locked) return state;
      if (state.phase === "visible") {
        return { ...state, phase: "disappearing" };
      }
      if (state.phase === "appearing") {
        return { ...INITIAL_STATE, locked: state.locked };
      }
      return state;
    }
    case "TRANSITION_END": {
      if (state.phase === "appearing") {
        return { ...state, phase: "visible" };
      }
      if (state.phase === "disappearing") {
        return { ...INITIAL_STATE, locked: state.locked };
      }
      return state;
    }
    case "LOCK":
      return { ...state, locked: true };
    case "UNLOCK":
      return { ...state, locked: false };
    default:
      return state;
  }
}

/**
 * Hook that manages drag handle visibility with a state machine.
 * Returns state + dispatch + computed opacity for CSS.
 */
export function useDragHandleVisibility() {
  const [state, dispatch] = useReducer(visibilityReducer, INITIAL_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(
    (blockPos: number, handlePosition: HandlePosition) => {
      clearTimer();
      dispatch({ type: "SHOW", blockPos, handlePosition });
      // Auto-transition APPEARING -> VISIBLE after 150ms
      timerRef.current = setTimeout(() => {
        dispatch({ type: "TRANSITION_END" });
      }, 150);
    },
    [clearTimer]
  );

  const hide = useCallback(() => {
    clearTimer();
    dispatch({ type: "HIDE" });
    // Auto-transition DISAPPEARING -> HIDDEN after 150ms
    timerRef.current = setTimeout(() => {
      dispatch({ type: "TRANSITION_END" });
    }, 150);
  }, [clearTimer]);

  const lock = useCallback(() => dispatch({ type: "LOCK" }), []);
  const unlock = useCallback(() => dispatch({ type: "UNLOCK" }), []);

  // Cleanup on unmount
  useEffect(() => clearTimer, [clearTimer]);

  const opacity =
    state.phase === "hidden"
      ? 0
      : state.phase === "appearing"
        ? 0.5
        : state.phase === "visible"
          ? 1
          : 0.5; // disappearing

  return { state, show, hide, lock, unlock, opacity };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/editor/use-drag-handle-visibility.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/use-drag-handle-visibility.ts tests/components/editor/use-drag-handle-visibility.test.ts
git commit -m "feat: add drag handle visibility state machine with tests"
```

---

## Task 4: Rewrite Drag Handle Component

**Files:**
- Modify: `src/components/editor/drag-handle.tsx` (full rewrite)

- [ ] **Step 1: Rewrite drag-handle.tsx**

Replace the entire content of `src/components/editor/drag-handle.tsx`:

```tsx
"use client";

import { useEffect, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { GripVertical, Plus } from "lucide-react";
import {
  selectBlock,
  selectBlockRange,
  toggleBlockInSelection,
  BLOCK_SELECTION_KEY,
} from "./extensions/block-selection";
import { useDragHandleVisibility } from "./use-drag-handle-visibility";

type DragHandleProps = { editor: Editor; onMenuOpen: (pos: number) => void };

/**
 * Resolves the nearest top-level block position for a given ProseMirror position.
 * Walks up from the deepest node to find the outermost block ancestor at depth 1+.
 */
function resolveBlockPos(
  doc: InstanceType<typeof import("@tiptap/pm/model").Node>,
  pos: number
): number {
  try {
    const $pos = doc.resolve(pos);
    // Walk from depth 1 (top-level blocks) — depth 0 is the doc itself
    for (let d = 1; d <= $pos.depth; d++) {
      const node = $pos.node(d);
      if (node.isBlock) {
        return $pos.before(d);
      }
    }
    // Fallback: try depth 1
    if ($pos.depth >= 1) return $pos.before(1);
    return pos;
  } catch {
    return pos;
  }
}

export function DragHandle({ editor, onMenuOpen }: DragHandleProps) {
  const { state: vis, show, hide, lock, unlock, opacity } = useDragHandleVisibility();
  const dropIndicatorRef = useRef<{ top: number; left: number; width: number } | null>(null);
  const dropIndicatorElRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleElRef = useRef<HTMLDivElement | null>(null);

  // Compute handle position from a block DOM element
  const computeHandlePosition = useCallback(
    (blockDom: HTMLElement) => {
      const blockRect = blockDom.getBoundingClientRect();
      const editorRect = editor.view.dom.getBoundingClientRect();
      return {
        top: blockRect.top + 2,
        left: Math.max(editorRect.left - 44, 8), // never go off-screen left
      };
    },
    [editor]
  );

  // Mouse move over editor: find block, show handle
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!editor.view) return;
      const view = editor.view;

      const posResult = view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      });
      if (!posResult) {
        hide();
        return;
      }

      try {
        const blockPos = resolveBlockPos(view.state.doc, posResult.pos);
        const blockDom = view.nodeDOM(blockPos);
        if (!blockDom || !(blockDom instanceof HTMLElement)) {
          hide();
          return;
        }

        const handlePosition = computeHandlePosition(blockDom);
        show(blockPos, handlePosition);
      } catch {
        hide();
      }
    },
    [editor, show, hide, computeHandlePosition]
  );

  const handleMouseLeave = useCallback(() => {
    hide();
  }, [hide]);

  // Attach/detach editor listeners
  useEffect(() => {
    if (!editor.view) return;
    const dom = editor.view.dom;
    dom.addEventListener("mousemove", handleMouseMove);
    dom.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      dom.removeEventListener("mousemove", handleMouseMove);
      dom.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [editor, handleMouseMove, handleMouseLeave]);

  // Handle element hover: cancel hide when mouse is over the handle itself
  const onHandleMouseEnter = useCallback(() => {
    if (vis.blockPos !== null && vis.handlePosition) {
      show(vis.blockPos, vis.handlePosition);
    }
  }, [vis.blockPos, vis.handlePosition, show]);

  const onHandleMouseLeave = useCallback(() => {
    hide();
  }, [hide]);

  /** Find the nearest block boundary for drop targeting */
  const findDropTarget = useCallback(
    (clientY: number): { top: number; blockPos: number } | null => {
      if (!editor.view) return null;
      const view = editor.view;
      const doc = view.state.doc;
      let closestTop = 0;
      let closestBlockPos = 0;
      let closestDist = Infinity;

      doc.forEach((node, offset) => {
        const dom = view.nodeDOM(offset);
        if (!dom || !(dom instanceof HTMLElement)) return;
        const rect = dom.getBoundingClientRect();

        const topDist = Math.abs(clientY - rect.top);
        if (topDist < closestDist) {
          closestTop = rect.top;
          closestBlockPos = offset;
          closestDist = topDist;
        }

        const bottomDist = Math.abs(clientY - rect.bottom);
        if (bottomDist < closestDist) {
          closestTop = rect.bottom;
          closestBlockPos = offset + node.nodeSize;
          closestDist = bottomDist;
        }
      });

      return closestDist < Infinity ? { top: closestTop, blockPos: closestBlockPos } : null;
    },
    [editor]
  );

  const clearAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  // + button click: insert paragraph below
  const handleAddBlock = useCallback(() => {
    if (vis.blockPos === null) return;
    editor.chain().focus().insertContentAt(vis.blockPos, { type: "paragraph" }).run();
    setTimeout(() => {
      editor
        .chain()
        .focus()
        .setTextSelection(vis.blockPos! + 1)
        .insertContent("/")
        .run();
    }, 50);
  }, [editor, vis.blockPos]);

  // Drag handle mousedown: selection + drag-to-move
  const handleGripMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (vis.blockPos === null || !editor.view) return;
      e.preventDefault();

      const startPos = vis.blockPos;

      // Shift+click: range select
      if (e.shiftKey) {
        const currentState = BLOCK_SELECTION_KEY.getState(editor.state);
        if (currentState?.anchorBlock !== null) {
          selectBlockRange(editor, currentState.anchorBlock, startPos);
        } else {
          selectBlock(editor, startPos);
        }
        return;
      }

      // Cmd/Ctrl+click: toggle select
      if (e.metaKey || e.ctrlKey) {
        toggleBlockInSelection(editor, startPos);
        return;
      }

      // Single block select
      selectBlock(editor, startPos);

      // Set ProseMirror NodeSelection for native drag
      try {
        const tr = editor.state.tr.setSelection(
          NodeSelection.create(editor.state.doc, startPos)
        );
        tr.setMeta(BLOCK_SELECTION_KEY, {
          selectedBlocks: [startPos],
          anchorBlock: startPos,
        });
        editor.view.dispatch(tr);
      } catch {
        // NodeSelection may fail for some node types
      }

      // Lock handle visible during drag
      lock();

      let isDragging = false;
      let dropTargetPos: number | null = null;

      const handleMouseMoveForDrag = (moveEvent: MouseEvent) => {
        isDragging = true;
        const editorRect = editor.view.dom.getBoundingClientRect();

        // Auto-scroll near edges (80px zone, proportional speed)
        clearAutoScroll();
        const topDist = moveEvent.clientY - editorRect.top;
        const bottomDist = editorRect.bottom - moveEvent.clientY;

        if (topDist < 80 && topDist > 0) {
          const speed = Math.max(1, Math.round((80 - topDist) / 10));
          autoScrollRef.current = setInterval(() => window.scrollBy(0, -speed), 16);
        } else if (bottomDist < 80 && bottomDist > 0) {
          const speed = Math.max(1, Math.round((80 - bottomDist) / 10));
          autoScrollRef.current = setInterval(() => window.scrollBy(0, speed), 16);
        }

        // Drop indicator
        const target = findDropTarget(moveEvent.clientY);
        if (target) {
          dropTargetPos = target.blockPos;
          if (dropIndicatorElRef.current) {
            dropIndicatorElRef.current.style.display = "block";
            dropIndicatorElRef.current.style.top = `${target.top}px`;
            dropIndicatorElRef.current.style.left = `${editorRect.left}px`;
            dropIndicatorElRef.current.style.width = `${editorRect.width}px`;
          }
        }

        // Update range selection visual
        const coords = editor.view.posAtCoords({
          left: moveEvent.clientX,
          top: moveEvent.clientY,
        });
        if (coords) {
          try {
            const endBlockPos = resolveBlockPos(editor.state.doc, coords.pos);
            selectBlockRange(editor, startPos, endBlockPos);
          } catch {
            // ignore
          }
        }
      };

      const handleMouseUpForDrag = () => {
        clearAutoScroll();
        unlock();

        if (dropIndicatorElRef.current) {
          dropIndicatorElRef.current.style.display = "none";
        }

        if (isDragging && dropTargetPos !== null) {
          try {
            const blockState = BLOCK_SELECTION_KEY.getState(editor.state);
            const selectedPositions =
              blockState && blockState.selectedBlocks.length > 1
                ? [...blockState.selectedBlocks].sort((a: number, b: number) => a - b)
                : [startPos];

            const isMoving =
              !selectedPositions.includes(dropTargetPos) &&
              !selectedPositions.some((p: number) => {
                const n = editor.state.doc.nodeAt(p);
                return n && dropTargetPos! > p && dropTargetPos! <= p + n.nodeSize;
              });

            if (isMoving) {
              let tr = editor.state.tr;
              const nodes = selectedPositions
                .map((p: number) => ({
                  pos: p,
                  node: editor.state.doc.nodeAt(p),
                }))
                .filter(
                  (n: { pos: number; node: ReturnType<typeof editor.state.doc.nodeAt> }) =>
                    n.node !== null
                );

              let sizeBeforeDrop = 0;
              for (const { pos, node } of nodes) {
                if (pos < dropTargetPos!) sizeBeforeDrop += node!.nodeSize;
              }

              for (const { pos, node } of [...nodes].reverse()) {
                tr = tr.delete(pos, pos + node!.nodeSize);
              }

              let insertAt = dropTargetPos! - sizeBeforeDrop;
              insertAt = Math.max(0, Math.min(insertAt, tr.doc.content.size));

              for (const { node } of nodes) {
                tr = tr.insert(insertAt, node!);
                insertAt += node!.nodeSize;
              }

              tr = tr.setMeta(BLOCK_SELECTION_KEY, {
                selectedBlocks: [],
                anchorBlock: null,
              });
              editor.view.dispatch(tr);
            }
          } catch {
            // ignore move errors
          }
        }

        document.removeEventListener("mousemove", handleMouseMoveForDrag);
        document.removeEventListener("mouseup", handleMouseUpForDrag);
      };

      document.addEventListener("mousemove", handleMouseMoveForDrag);
      document.addEventListener("mouseup", handleMouseUpForDrag);
    },
    [editor, vis.blockPos, lock, unlock, clearAutoScroll, findDropTarget]
  );

  const handleGripClick = useCallback(
    (e: React.MouseEvent) => {
      if (vis.blockPos === null) return;
      if (!e.shiftKey) {
        onMenuOpen(vis.blockPos);
      }
    },
    [vis.blockPos, onMenuOpen]
  );

  // Don't render anything if fully hidden
  const isVisible = vis.phase !== "hidden";

  return (
    <>
      {isVisible && vis.handlePosition && (
        <div
          ref={handleElRef}
          className="fixed flex items-center gap-0.5 transition-opacity duration-150"
          style={{
            top: `${vis.handlePosition.top}px`,
            left: `${vis.handlePosition.left}px`,
            opacity,
            pointerEvents: opacity > 0 ? "auto" : "none",
            zIndex: 50,
          }}
          onMouseEnter={onHandleMouseEnter}
          onMouseLeave={onHandleMouseLeave}
        >
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-tertiary)" }}
            onClick={handleAddBlock}
            title="Add block below"
          >
            <Plus size={16} />
          </button>
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-notion-bg-hover cursor-grab active:cursor-grabbing"
            style={{ color: "var(--text-tertiary)" }}
            draggable
            onDragStart={(e) => {
              if (vis.blockPos === null) return;
              const node = editor.state.doc.nodeAt(vis.blockPos);
              const blockId = node?.attrs?.blockId as string | undefined;
              if (blockId) {
                e.dataTransfer.setData("text/block-id", blockId);
                e.dataTransfer.setData("text/plain", node?.textContent ?? "");
              }
            }}
            onMouseDown={handleGripMouseDown}
            onClick={handleGripClick}
            title="Drag to move / Click for menu"
          >
            <GripVertical size={14} />
          </button>
        </div>
      )}

      {/* Persistent drop indicator (hidden by default, shown via ref) */}
      <div
        ref={dropIndicatorElRef}
        className="fixed pointer-events-none"
        style={{
          display: "none",
          height: "2px",
          backgroundColor: "var(--accent-blue)",
          zIndex: 1000,
        }}
      >
        {/* Left dot */}
        <div
          className="absolute rounded-full"
          style={{
            width: "6px",
            height: "6px",
            backgroundColor: "var(--accent-blue)",
            top: "-2px",
            left: "-3px",
          }}
        />
        {/* Right dot */}
        <div
          className="absolute rounded-full"
          style={{
            width: "6px",
            height: "6px",
            backgroundColor: "var(--accent-blue)",
            top: "-2px",
            right: "-3px",
          }}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify the rewrite works**

Run: `npm run dev`
Navigate to any page. Hover over blocks — handle should appear with fade-in, disappear with fade-out, and stay visible when hovering the handle itself. Drag should show drop indicator with dots on ends.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/drag-handle.tsx
git commit -m "refactor: rewrite drag handle with state machine, lucide icons, and improved drop indicator"
```

---

## Task 5: Add Cmd+A Block Selection

**Files:**
- Modify: `src/components/editor/extensions/block-selection.ts:52-149` (handleKeyDown)
- Create: `tests/components/editor/block-selection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/editor/block-selection.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  visibilityReducer,
} from "@/components/editor/use-drag-handle-visibility";

// We test the pure helper functions from block-selection.
// The ProseMirror plugin itself requires a full editor environment,
// so we test the exported utility logic here.

import { selectBlockRangePositions } from "@/components/editor/extensions/block-selection";

describe("selectBlockRangePositions", () => {
  it("returns positions between fromPos and toPos inclusive", () => {
    // Simulate a doc with blocks at offsets 0, 10, 20, 30
    const blockOffsets = [0, 10, 20, 30];
    const result = selectBlockRangePositions(blockOffsets, 10, 30);
    expect(result).toEqual([10, 20, 30]);
  });

  it("handles reversed range (toPos < fromPos)", () => {
    const blockOffsets = [0, 10, 20, 30];
    const result = selectBlockRangePositions(blockOffsets, 30, 10);
    expect(result).toEqual([10, 20, 30]);
  });

  it("returns single block when from === to", () => {
    const blockOffsets = [0, 10, 20];
    const result = selectBlockRangePositions(blockOffsets, 10, 10);
    expect(result).toEqual([10]);
  });

  it("returns empty when no offsets in range", () => {
    const blockOffsets = [0, 10, 20, 30];
    const result = selectBlockRangePositions(blockOffsets, 15, 18);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/editor/block-selection.test.ts`
Expected: FAIL — `selectBlockRangePositions` not found

- [ ] **Step 3: Add the helper function and Cmd+A support**

In `src/components/editor/extensions/block-selection.ts`, add after the existing imports (line 4):

```typescript
/**
 * Pure utility: given a sorted list of block offsets, returns those
 * falling within [min(fromPos,toPos), max(fromPos,toPos)].
 */
export function selectBlockRangePositions(
  blockOffsets: number[],
  fromPos: number,
  toPos: number
): number[] {
  const minPos = Math.min(fromPos, toPos);
  const maxPos = Math.max(fromPos, toPos);
  return blockOffsets.filter((offset) => offset >= minPos && offset <= maxPos);
}
```

Then in the `handleKeyDown` function, add Cmd+A handling **before** the existing Escape handler (before line 127). Insert after the Cut handler block (after line 125):

```typescript
            // Select all blocks (Cmd+A / Ctrl+A double-press)
            if ((event.metaKey || event.ctrlKey) && event.key === "a") {
              // If blocks are already selected, this is a "double Cmd+A" -> select all
              // First Cmd+A is handled by ProseMirror (select all text in block)
              // We intercept only when blocks are already in selection
              if (pluginState.selectedBlocks.length > 0) {
                event.preventDefault();
                const positions: number[] = [];
                view.state.doc.forEach((_node: PmNode, offset: number) => {
                  positions.push(offset);
                });
                const tr = view.state.tr.setMeta(BLOCK_SELECTION_KEY, {
                  selectedBlocks: positions,
                  anchorBlock: positions[0] ?? null,
                });
                view.dispatch(tr);
                return true;
              }
              return false;
            }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/components/editor/block-selection.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/block-selection.ts tests/components/editor/block-selection.test.ts
git commit -m "feat: add Cmd+A block selection and pure range helper"
```

---

## Task 6: Selection Action Bar Component

**Files:**
- Create: `src/components/editor/selection-action-bar.tsx`

- [ ] **Step 1: Create the floating action bar**

Create `src/components/editor/selection-action-bar.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Trash2, ChevronDown, Copy, Link as LinkIcon } from "lucide-react";
import { BLOCK_SELECTION_KEY } from "./extensions/block-selection";

type Props = { editor: Editor };

const TURN_INTO_OPTIONS = [
  { label: "Text", type: "paragraph" },
  { label: "Heading 1", type: "heading", attrs: { level: 1 } },
  { label: "Heading 2", type: "heading", attrs: { level: 2 } },
  { label: "Heading 3", type: "heading", attrs: { level: 3 } },
  { label: "Bullet list", type: "bulletList" },
  { label: "Numbered list", type: "orderedList" },
  { label: "To-do", type: "taskList" },
  { label: "Toggle", type: "details" },
  { label: "Callout", type: "callout" },
  { label: "Quote", type: "blockquote" },
] as const;

export function SelectionActionBar({ editor }: Props) {
  const [selectedCount, setSelectedCount] = useState(0);
  const [showTurnInto, setShowTurnInto] = useState(false);

  useEffect(() => {
    const update = () => {
      const state = BLOCK_SELECTION_KEY.getState(editor.state);
      setSelectedCount(state?.selectedBlocks?.length ?? 0);
    };
    editor.on("transaction", update);
    return () => {
      editor.off("transaction", update);
    };
  }, [editor]);

  if (selectedCount < 2) return null;

  const handleDelete = () => {
    const state = BLOCK_SELECTION_KEY.getState(editor.state);
    if (!state) return;
    const sorted = [...state.selectedBlocks].sort((a, b) => b - a);
    let tr = editor.state.tr;
    for (const pos of sorted) {
      const node = tr.doc.nodeAt(pos);
      if (node) tr = tr.delete(pos, pos + node.nodeSize);
    }
    tr = tr.setMeta(BLOCK_SELECTION_KEY, { selectedBlocks: [], anchorBlock: null });
    editor.view.dispatch(tr);
  };

  const handleDuplicate = () => {
    const state = BLOCK_SELECTION_KEY.getState(editor.state);
    if (!state) return;
    const sorted = [...state.selectedBlocks].sort((a, b) => a - b);
    let tr = editor.state.tr;
    // Insert duplicates after the last selected block
    const lastPos = sorted[sorted.length - 1];
    const lastNode = tr.doc.nodeAt(lastPos);
    if (!lastNode) return;
    let insertAt = lastPos + lastNode.nodeSize;

    for (const pos of sorted) {
      const node = editor.state.doc.nodeAt(pos);
      if (node) {
        tr = tr.insert(insertAt, node.copy(node.content));
        insertAt += node.nodeSize;
      }
    }
    tr = tr.setMeta(BLOCK_SELECTION_KEY, { selectedBlocks: [], anchorBlock: null });
    editor.view.dispatch(tr);
  };

  return (
    <div
      className="sticky top-0 z-50 flex items-center gap-2 px-3 py-1.5 mx-auto w-fit rounded-lg shadow-md border"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
        boxShadow: "var(--shadow-popup)",
      }}
    >
      <span
        className="text-xs font-medium px-2"
        style={{ color: "var(--text-secondary)" }}
      >
        {selectedCount} blocks
      </span>

      <div className="w-px h-4" style={{ backgroundColor: "var(--border-divider)" }} />

      {/* Turn into dropdown */}
      <div className="relative">
        <button
          className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
          onClick={() => setShowTurnInto(!showTurnInto)}
        >
          Turn into <ChevronDown size={12} />
        </button>
        {showTurnInto && (
          <div
            className="absolute top-full left-0 mt-1 py-1 rounded-lg shadow-lg border min-w-[160px] dropdown-enter"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-default)",
              boxShadow: "var(--shadow-popup)",
              zIndex: 100,
            }}
          >
            {TURN_INTO_OPTIONS.map((opt) => (
              <button
                key={opt.type + (("attrs" in opt && opt.attrs && "level" in opt.attrs) ? opt.attrs.level : "")}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-notion-bg-hover"
                style={{ color: "var(--text-primary)" }}
                onClick={() => {
                  // Turn into is complex per block type — for now just close
                  // Full conversion logic will be added in Phase 1-5 (block type conversion)
                  setShowTurnInto(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-4" style={{ backgroundColor: "var(--border-divider)" }} />

      <button
        className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-notion-bg-hover"
        style={{ color: "var(--text-secondary)" }}
        onClick={handleDuplicate}
        title="Duplicate"
      >
        <Copy size={12} />
      </button>

      <button
        className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-notion-bg-hover"
        style={{ color: "var(--text-secondary)" }}
        onClick={handleDelete}
        title="Delete"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire SelectionActionBar into the editor**

In `src/components/editor/editor.tsx`, add the import at the lazy-loaded components section (around line 47-53). Find the line that imports DragHandle and add nearby:

```typescript
import { SelectionActionBar } from "./selection-action-bar";
```

Then in the JSX return, add `<SelectionActionBar editor={editor} />` right above the editor content area (find where `<DragHandle>` is rendered, add SelectionActionBar before the editor `<div>`).

The exact location depends on the JSX structure — look for the `<EditorContent>` component and add before it:

```tsx
<SelectionActionBar editor={editor} />
```

- [ ] **Step 3: Verify**

Run: `npm run dev`
Select 2+ blocks using Shift+click on drag handles. Floating bar should appear at top showing "N blocks selected" with Turn into, Copy, Trash buttons.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/selection-action-bar.tsx src/components/editor/editor.tsx
git commit -m "feat: add floating selection action bar for multi-block operations"
```

---

## Task 7: Improve Block Selection Clipboard (Fix Formatting Loss)

**Files:**
- Modify: `src/components/editor/extensions/block-selection.ts:77-103` (copy handler)

- [ ] **Step 1: Fix the copy handler to serialize complete nodes**

In `src/components/editor/extensions/block-selection.ts`, replace the copy handler (the `if ((event.metaKey || event.ctrlKey) && event.key === "c")` block, approximately lines 78-105):

```typescript
            // Copy selected blocks with full formatting
            if ((event.metaKey || event.ctrlKey) && event.key === "c") {
              event.preventDefault();
              const fragments: string[] = [];
              const serializer = DOMSerializer.fromSchema(view.state.schema);

              // Build a complete HTML document fragment
              const container = document.createElement("div");

              for (const pos of pluginState.selectedBlocks) {
                const node = view.state.doc.nodeAt(pos);
                if (node) {
                  fragments.push(node.textContent);
                  // Serialize the entire node (not just content) to preserve block-level formatting
                  const domNode = serializer.serializeNode(node);
                  container.appendChild(domNode);
                }
              }

              const text = fragments.join("\n");
              const html = container.innerHTML;

              // Also include internal format for same-app paste
              const internalData = JSON.stringify(
                pluginState.selectedBlocks.map((pos: number) => {
                  const node = view.state.doc.nodeAt(pos);
                  return node ? node.toJSON() : null;
                }).filter(Boolean)
              );

              navigator.clipboard
                .write([
                  new ClipboardItem({
                    "text/plain": new Blob([text], { type: "text/plain" }),
                    "text/html": new Blob([html], { type: "text/html" }),
                  }),
                ])
                .catch(() => {
                  navigator.clipboard.writeText(text).catch(() => {});
                });

              // Store internal data in a module-level variable for same-tab paste
              (window as Record<string, unknown>).__notionBlockClipboard = internalData;

              return true;
            }
```

- [ ] **Step 2: Also fix cut to use same serialization**

Replace the cut handler (the `if ((event.metaKey || event.ctrlKey) && event.key === "x")` block):

```typescript
            // Cut selected blocks
            if ((event.metaKey || event.ctrlKey) && event.key === "x") {
              event.preventDefault();
              // Reuse copy logic
              const fragments: string[] = [];
              const serializer = DOMSerializer.fromSchema(view.state.schema);
              const container = document.createElement("div");

              for (const pos of pluginState.selectedBlocks) {
                const node = view.state.doc.nodeAt(pos);
                if (node) {
                  fragments.push(node.textContent);
                  const domNode = serializer.serializeNode(node);
                  container.appendChild(domNode);
                }
              }

              navigator.clipboard
                .write([
                  new ClipboardItem({
                    "text/plain": new Blob([fragments.join("\n")], { type: "text/plain" }),
                    "text/html": new Blob([container.innerHTML], { type: "text/html" }),
                  }),
                ])
                .catch(() => {
                  navigator.clipboard.writeText(fragments.join("\n")).catch(() => {});
                });

              // Delete blocks
              const sorted = [...pluginState.selectedBlocks].sort((a, b) => b - a);
              let tr = view.state.tr;
              for (const pos of sorted) {
                const node = tr.doc.nodeAt(pos);
                if (node) tr = tr.delete(pos, pos + node.nodeSize);
              }
              tr = tr.setMeta(BLOCK_SELECTION_KEY, { selectedBlocks: [], anchorBlock: null });
              view.dispatch(tr);
              return true;
            }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/extensions/block-selection.ts
git commit -m "fix: preserve formatting when copying/cutting selected blocks"
```

---

## Task 8: Fix selectBlockRange to Use nodesBetween

**Files:**
- Modify: `src/components/editor/extensions/block-selection.ts:197-218` (selectBlockRange function)

- [ ] **Step 1: Replace the selectBlockRange implementation**

Replace the existing `selectBlockRange` function (lines 197-218):

```typescript
/** Select all top-level blocks between fromPos and toPos (inclusive). */
export function selectBlockRange(
  editor: EditorLike,
  fromPos: number,
  toPos: number,
) {
  const positions: number[] = [];
  const minPos = Math.min(fromPos, toPos);
  const maxPos = Math.max(fromPos, toPos);

  // Use doc.forEach for top-level blocks only (more reliable than nodesBetween for this use case)
  // but include blocks whose start falls within the range
  editor.state.doc.forEach((node: PmNode, offset: number) => {
    const blockEnd = offset + node.nodeSize;
    // Include if block overlaps the range at all
    if (offset <= maxPos && blockEnd > minPos) {
      positions.push(offset);
    }
  });

  const tr = editor.state.tr.setMeta(BLOCK_SELECTION_KEY, {
    selectedBlocks: positions,
    anchorBlock: fromPos,
  });
  editor.view.dispatch(tr);
}
```

The key change: `offset >= minPos && offset <= maxPos` (old, strict) -> `offset <= maxPos && blockEnd > minPos` (new, overlap-based). This correctly includes blocks at the boundaries.

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/extensions/block-selection.ts
git commit -m "fix: selectBlockRange now includes blocks overlapping range boundaries"
```

---

## Summary

| Task | Description | Files | Tests |
|------|-------------|-------|-------|
| 1 | Design tokens | notion-tokens.css | — |
| 2 | Block selection CSS | globals.css | Visual |
| 3 | Visibility state machine | use-drag-handle-visibility.ts | 8 unit tests |
| 4 | Drag handle rewrite | drag-handle.tsx | Visual |
| 5 | Cmd+A selection | block-selection.ts | 4 unit tests |
| 6 | Selection action bar | selection-action-bar.tsx | Visual |
| 7 | Clipboard formatting | block-selection.ts | Manual |
| 8 | Range selection fix | block-selection.ts | Manual |

**Total:** 8 tasks, ~12 test cases, 2 new files, 4 modified files.

**Next plans after this one:**
- Phase 1-B: Icon System Overhaul (UnifiedIcon + Icon Picker + topbar replacement)
- Phase 1-C: Mobile Responsive Foundation
- Phase 1-D: Editor Micro UX (keyboard shortcuts, block conversion, inline toolbar)
