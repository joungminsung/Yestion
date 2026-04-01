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
 * Resolves the nearest top-level block position for a given ProseMirror position.
 * Walks up from the deepest node to find the outermost block ancestor.
 */
function resolveBlockPos(doc: PmNode, pos: number): number {
  try {
    const $pos = doc.resolve(pos);
    for (let d = 1; d <= $pos.depth; d++) {
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
      return {
        top: blockRect.top + 2,
        left: Math.max(editorRect.left - 44, 8),
      };
    },
    [editor]
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (rafRef.current) return; // already scheduled
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!editor.view) return;
        const view = editor.view;
        const posResult = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (!posResult) { hide(); lastBlockPosRef.current = null; return; }

        try {
          const blockPos = resolveBlockPos(view.state.doc, posResult.pos);
          // Skip if same block
          if (blockPos === lastBlockPosRef.current) return;
          lastBlockPosRef.current = blockPos;

          const blockDom = view.nodeDOM(blockPos);
          if (!blockDom || !(blockDom instanceof HTMLElement)) { hide(); return; }
          const handlePosition = computeHandlePosition(blockDom);
          show(blockPos, handlePosition);
        } catch { hide(); }
      });
    },
    [editor, show, hide, computeHandlePosition]
  );

  const handleMouseLeave = useCallback(() => { hide(); }, [hide]);

  useEffect(() => {
    if (!editor.view) return;
    const dom = editor.view.dom;
    dom.addEventListener("mousemove", handleMouseMove);
    dom.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      dom.removeEventListener("mousemove", handleMouseMove);
      dom.removeEventListener("mouseleave", handleMouseLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [editor, handleMouseMove, handleMouseLeave]);

  const onHandleMouseEnter = useCallback(() => {
    if (vis.blockPos !== null && vis.handlePosition) {
      show(vis.blockPos, vis.handlePosition);
    }
  }, [vis.blockPos, vis.handlePosition, show]);

  const onHandleMouseLeave = useCallback(() => { hide(); }, [hide]);

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

      let isDragging = false;
      let dropTargetPos: number | null = null;

      const handleMouseMoveForDrag = (moveEvent: MouseEvent) => {
        isDragging = true;
        const editorRect = editor.view.dom.getBoundingClientRect();

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

        const coords = editor.view.posAtCoords({
          left: moveEvent.clientX,
          top: moveEvent.clientY,
        });
        if (coords) {
          try {
            const endBlockPos = resolveBlockPos(editor.state.doc, coords.pos);
            selectBlockRange(editor, startPos, endBlockPos);
          } catch {}
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
                .map((p: number) => ({ pos: p, node: editor.state.doc.nodeAt(p) }))
                .filter((n: { pos: number; node: ReturnType<typeof editor.state.doc.nodeAt> }) => n.node !== null);

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

              tr = tr.setMeta(BLOCK_SELECTION_KEY, { selectedBlocks: [], anchorBlock: null });
              editor.view.dispatch(tr);
            }
          } catch {}
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
      if (!e.shiftKey) onMenuOpen(vis.blockPos);
    },
    [vis.blockPos, onMenuOpen]
  );

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
