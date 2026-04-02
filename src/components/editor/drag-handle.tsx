"use client";

import { useEffect, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as PmNode } from "@tiptap/pm/model";
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
 * Resolves the deepest block-level node position at a given ProseMirror position.
 * Walks from max depth upward to find the innermost block ancestor,
 * enabling drag handles on blocks inside toggles, columns, and tables.
 */
function resolveBlockPos(doc: PmNode, pos: number): number {
  try {
    const $pos = doc.resolve(pos);
    // Walk from deepest to shallowest to find the innermost block
    for (let d = $pos.depth; d >= 1; d--) {
      const node = $pos.node(d);
      if (node.isBlock && node.isTextblock === false) {
        return $pos.before(d);
      }
    }
    // Fallback: find the nearest textblock's parent
    for (let d = $pos.depth; d >= 1; d--) {
      const node = $pos.node(d);
      if (node.isBlock) {
        return $pos.before(d);
      }
    }
    if ($pos.depth >= 1) return $pos.before(1);
    return pos;
  } catch {
    return pos;
  }
}

export function DragHandle({ editor, onMenuOpen }: DragHandleProps) {
  const { state: vis, show, hide, lock, unlock, opacity } = useDragHandleVisibility();
  const dropIndicatorElRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleElRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastBlockPosRef = useRef<number | null>(null);

  const computeHandlePosition = useCallback(
    (blockDom: HTMLElement) => {
      const blockRect = blockDom.getBoundingClientRect();
      const editorRect = editor.view.dom.getBoundingClientRect();
      // Position handle at the far left edge of the editor area
      // Use editor left edge minus handle width for consistent positioning
      const handleWidth = 52; // + button (24) + grip button (24) + gap
      return {
        top: blockRect.top + 2,
        left: Math.max(editorRect.left - handleWidth - 4, 4),
      };
    },
    [editor]
  );

  // Delay hide so mouse has time to travel from editor to handle
  const hideDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHide = useCallback(() => {
    if (hideDelayRef.current) clearTimeout(hideDelayRef.current);
    hideDelayRef.current = setTimeout(() => {
      hide();
    }, 200);
  }, [hide]);

  const cancelHide = useCallback(() => {
    if (hideDelayRef.current) {
      clearTimeout(hideDelayRef.current);
      hideDelayRef.current = null;
    }
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      cancelHide();

      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!editor.view) return;
        const view = editor.view;
        const posResult = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (!posResult) { scheduleHide(); lastBlockPosRef.current = null; return; }

        try {
          const blockPos = resolveBlockPos(view.state.doc, posResult.pos);
          if (blockPos === lastBlockPosRef.current) return;
          lastBlockPosRef.current = blockPos;

          const blockDom = view.nodeDOM(blockPos);
          if (!blockDom || !(blockDom instanceof HTMLElement)) { scheduleHide(); return; }
          const handlePosition = computeHandlePosition(blockDom);
          show(blockPos, handlePosition);
        } catch { scheduleHide(); }
      });
    },
    [editor, show, scheduleHide, cancelHide, computeHandlePosition]
  );

  const handleMouseLeave = useCallback(() => { scheduleHide(); }, [scheduleHide]);

  // Also show handle when hovering the left gutter area (where handle lives)
  const handleGutterMouseMove = useCallback(
    (event: MouseEvent) => {
      cancelHide();
      if (!editor.view) return;
      const view = editor.view;

      // Use the editor's left edge X but the mouse's Y to find the block
      const editorRect = view.dom.getBoundingClientRect();
      const posResult = view.posAtCoords({ left: editorRect.left + 10, top: event.clientY });
      if (!posResult) return;

      try {
        const blockPos = resolveBlockPos(view.state.doc, posResult.pos);
        const blockDom = view.nodeDOM(blockPos);
        if (!blockDom || !(blockDom instanceof HTMLElement)) return;
        lastBlockPosRef.current = blockPos;
        const handlePosition = computeHandlePosition(blockDom);
        show(blockPos, handlePosition);
      } catch {}
    },
    [editor, show, cancelHide, computeHandlePosition]
  );

  const gutterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editor.view) return;
    const dom = editor.view.dom;
    dom.addEventListener("mousemove", handleMouseMove);
    dom.addEventListener("mouseleave", handleMouseLeave);

    // Position invisible gutter zone to the left of the editor
    const updateGutter = () => {
      if (!gutterRef.current) return;
      const editorRect = dom.getBoundingClientRect();
      const gutter = gutterRef.current;
      gutter.style.position = "fixed";
      gutter.style.top = `${editorRect.top}px`;
      gutter.style.left = `${Math.max(editorRect.left - 80, 0)}px`;
      gutter.style.width = "80px";
      gutter.style.height = `${editorRect.height}px`;
      gutter.style.zIndex = "40";
    };
    updateGutter();
    const resizeObs = new ResizeObserver(updateGutter);
    resizeObs.observe(dom);

    return () => {
      dom.removeEventListener("mousemove", handleMouseMove);
      dom.removeEventListener("mouseleave", handleMouseLeave);
      resizeObs.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (hideDelayRef.current) clearTimeout(hideDelayRef.current);
    };
  }, [editor, handleMouseMove, handleMouseLeave]);

  // When mouse enters the handle, cancel any pending hide and lock visibility
  const onHandleMouseEnter = useCallback(() => {
    cancelHide();
    lock();
  }, [cancelHide, lock]);

  // When mouse leaves the handle, unlock and schedule hide
  const onHandleMouseLeave = useCallback(() => {
    unlock();
    scheduleHide();
  }, [unlock, scheduleHide]);

  /** Find the gap between blocks where a drop should occur.
   *  Each gap is identified by the midpoint between two adjacent blocks.
   *  Cursor above the midpoint → insert before the block, below → insert after. */
  const findDropTarget = useCallback(
    (clientY: number): { top: number; blockPos: number } | null => {
      if (!editor.view) return null;
      const view = editor.view;
      const doc = view.state.doc;

      // Collect all top-level block rects
      const blocks: { offset: number; nodeSize: number; top: number; bottom: number }[] = [];
      doc.forEach((node, offset) => {
        const dom = view.nodeDOM(offset);
        if (!dom || !(dom instanceof HTMLElement)) return;
        const rect = dom.getBoundingClientRect();
        blocks.push({ offset, nodeSize: node.nodeSize, top: rect.top, bottom: rect.bottom });
      });

      if (blocks.length === 0) return null;

      // Above the first block → insert at position 0 (top of document)
      const firstBlock = blocks[0];
      if (firstBlock && clientY <= firstBlock.top) {
        return { top: firstBlock.top, blockPos: firstBlock.offset };
      }

      // Check each gap between blocks using midpoints
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]!;
        const midY = (block.top + block.bottom) / 2;

        // Top half → insert before this block
        if (clientY >= block.top && clientY < midY) {
          return { top: block.top, blockPos: block.offset };
        }

        // Bottom half → insert after this block
        if (clientY >= midY && clientY <= block.bottom) {
          return { top: block.bottom, blockPos: block.offset + block.nodeSize };
        }

        // Gap between this block and next
        if (i < blocks.length - 1) {
          const next = blocks[i + 1]!;
          if (clientY > block.bottom && clientY < next.top) {
            return { top: block.bottom, blockPos: block.offset + block.nodeSize };
          }
        }
      }

      // Below the last block → insert at end
      const last = blocks[blocks.length - 1]!;
      return { top: last.bottom, blockPos: last.offset + last.nodeSize };
    },
    [editor]
  );

  const clearAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  const handleAddBlock = useCallback(() => {
    if (vis.blockPos === null) return;
    const pos = vis.blockPos;
    editor
      .chain()
      .focus()
      .insertContentAt(pos, { type: "paragraph" })
      .setTextSelection(pos + 1)
      .run();
  }, [editor, vis.blockPos]);

  const handleGripMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (vis.blockPos === null || !editor.view) return;
      e.preventDefault();

      const startPos = vis.blockPos;

      if (e.shiftKey) {
        const currentState = BLOCK_SELECTION_KEY.getState(editor.state);
        if (currentState?.anchorBlock !== null) {
          selectBlockRange(editor, currentState.anchorBlock, startPos);
        } else {
          selectBlock(editor, startPos);
        }
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        toggleBlockInSelection(editor, startPos);
        return;
      }

      selectBlock(editor, startPos);

      try {
        const tr = editor.state.tr.setSelection(
          NodeSelection.create(editor.state.doc, startPos)
        );
        tr.setMeta(BLOCK_SELECTION_KEY, {
          selectedBlocks: [startPos],
          anchorBlock: startPos,
        });
        editor.view.dispatch(tr);
      } catch {}

      lock();

      let lastDropPos: number | null = null;
      // Track the current position of the dragged block (changes as we reorder live)
      let currentBlockPos = startPos;

      const handleMouseMoveForDrag = (moveEvent: MouseEvent) => {
        const editorRect = editor.view.dom.getBoundingClientRect();

        // Auto-scroll near edges
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

        // Find drop target
        const target = findDropTarget(moveEvent.clientY);
        if (!target) return;

        // Show thin blue drop indicator line
        if (dropIndicatorElRef.current) {
          dropIndicatorElRef.current.style.display = "block";
          dropIndicatorElRef.current.style.top = `${target.top}px`;
          dropIndicatorElRef.current.style.left = `${editorRect.left}px`;
          dropIndicatorElRef.current.style.width = `${editorRect.width}px`;
        }

        // Live reorder: move the block in real-time as cursor moves
        const dropPos = target.blockPos;
        if (dropPos === lastDropPos) return; // same position, skip
        lastDropPos = dropPos;

        try {
          const node = editor.state.doc.nodeAt(currentBlockPos);
          if (!node) return;

          // Don't move if dropping on itself
          if (dropPos === currentBlockPos || dropPos === currentBlockPos + node.nodeSize) return;
          // Don't move inside itself
          if (dropPos > currentBlockPos && dropPos < currentBlockPos + node.nodeSize) return;
          // Already at the top of the document — can't go higher
          if (currentBlockPos === 0 && dropPos === 0) return;

          let tr = editor.state.tr;
          const nodeSize = node.nodeSize;

          // Delete from current position
          tr = tr.delete(currentBlockPos, currentBlockPos + nodeSize);

          // Calculate new insert position (adjusted for deletion)
          let insertAt = dropPos > currentBlockPos ? dropPos - nodeSize : dropPos;
          insertAt = Math.max(0, Math.min(insertAt, tr.doc.content.size));

          // Insert at new position
          tr = tr.insert(insertAt, node);
          tr = tr.setMeta(BLOCK_SELECTION_KEY, { selectedBlocks: [insertAt], anchorBlock: insertAt });
          editor.view.dispatch(tr);

          // Update tracked position
          currentBlockPos = insertAt;
        } catch {
          // Position math can fail on edge cases — ignore silently
        }
      };

      const handleMouseUpForDrag = () => {
        clearAutoScroll();
        unlock();

        if (dropIndicatorElRef.current) {
          dropIndicatorElRef.current.style.display = "none";
        }

        // Clear selection after drop
        const tr = editor.state.tr.setMeta(BLOCK_SELECTION_KEY, { selectedBlocks: [], anchorBlock: null });
        editor.view.dispatch(tr);

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
      if (!e.shiftKey) onMenuOpen(vis.blockPos);
    },
    [vis.blockPos, onMenuOpen]
  );

  const isVisible = vis.phase !== "hidden";

  return (
    <>
      {/* Invisible gutter zone — hovering here shows the handle for the nearest block */}
      <div
        ref={gutterRef}
        onMouseMove={handleGutterMouseMove as unknown as React.MouseEventHandler}
        onMouseLeave={handleMouseLeave as unknown as React.MouseEventHandler}
        style={{ pointerEvents: "auto" }}
      />

      {isVisible && vis.handlePosition && (
        <div
          ref={handleElRef}
          className="fixed flex items-center gap-0.5 transition-opacity duration-150"
          style={{
            top: `${vis.handlePosition.top - 4}px`,
            left: `${vis.handlePosition.left - 8}px`,
            opacity,
            pointerEvents: opacity > 0 ? "auto" : "none",
            zIndex: 50,
            // Larger hit area with padding so handle is easier to reach
            padding: "4px 8px 4px 8px",
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

      {/* Persistent drop indicator line with endpoint dots */}
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
        <div
          className="absolute rounded-full"
          style={{
            width: "6px", height: "6px",
            backgroundColor: "var(--accent-blue)",
            top: "-2px", left: "-3px",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: "6px", height: "6px",
            backgroundColor: "var(--accent-blue)",
            top: "-2px", right: "-3px",
          }}
        />
      </div>
    </>
  );
}
