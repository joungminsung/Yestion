"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import {
  selectBlock,
  selectBlockRange,
  toggleBlockInSelection,
  BLOCK_SELECTION_KEY,
} from "./extensions/block-selection";

type DragHandleProps = { editor: Editor; onMenuOpen: (pos: number) => void };

export function DragHandle({ editor, onMenuOpen }: DragHandleProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [hoveredPos, setHoveredPos] = useState<number | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ top: number; left: number; width: number } | null>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!editor.view) { setPosition(null); return; }
    const view = editor.view;
    const editorDom = view.dom;
    const editorRect = editorDom.getBoundingClientRect();

    // Find the block element at mouse position
    const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (!pos) {
      // Start hide delay
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      if (showTimeoutRef.current) { clearTimeout(showTimeoutRef.current); showTimeoutRef.current = null; }
      hideTimeoutRef.current = setTimeout(() => setPosition(null), 200);
      return;
    }

    try {
      const $pos = view.state.doc.resolve(pos.pos);
      const blockPos = $pos.before(1);
      const blockDom = view.nodeDOM(blockPos);
      if (!blockDom || !(blockDom instanceof HTMLElement)) {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        if (showTimeoutRef.current) { clearTimeout(showTimeoutRef.current); showTimeoutRef.current = null; }
        hideTimeoutRef.current = setTimeout(() => setPosition(null), 200);
        return;
      }

      const blockRect = blockDom.getBoundingClientRect();
      const newTop = blockRect.top + 2; // align with first line
      const newLeft = editorRect.left - 44; // fixed left offset

      // Cancel any pending hide
      if (hideTimeoutRef.current) { clearTimeout(hideTimeoutRef.current); hideTimeoutRef.current = null; }

      // Show with delay
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = setTimeout(() => {
        setPosition({ top: newTop, left: newLeft });
        setHoveredPos(blockPos);
      }, 150);
    } catch {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      if (showTimeoutRef.current) { clearTimeout(showTimeoutRef.current); showTimeoutRef.current = null; }
      hideTimeoutRef.current = setTimeout(() => setPosition(null), 200);
    }
  }, [editor]);

  const handleMouseLeave = useCallback(() => {
    if (showTimeoutRef.current) { clearTimeout(showTimeoutRef.current); showTimeoutRef.current = null; }
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => setPosition(null), 200);
  }, []);

  useEffect(() => {
    if (!editor.view) return;
    const dom = editor.view.dom;
    dom.addEventListener("mousemove", handleMouseMove);
    dom.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      dom.removeEventListener("mousemove", handleMouseMove);
      dom.removeEventListener("mouseleave", handleMouseLeave);
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [editor, handleMouseMove, handleMouseLeave]);

  /** Find the nearest block boundary Y position for a given clientY */
  const findDropTarget = useCallback((clientY: number): { top: number; blockPos: number } | null => {
    if (!editor.view) return null;
    const view = editor.view;
    const doc = view.state.doc;
    let closestTop = 0;
    let closestBlockPos = 0;
    let closestDist = Infinity;
    let found = false;

    doc.forEach((node, offset) => {
      const dom = view.nodeDOM(offset);
      if (!dom || !(dom instanceof HTMLElement)) return;
      const rect = dom.getBoundingClientRect();

      // Check top edge
      const topDist = Math.abs(clientY - rect.top);
      if (topDist < closestDist) {
        closestTop = rect.top;
        closestBlockPos = offset;
        closestDist = topDist;
        found = true;
      }

      // Check bottom edge (insert after this block)
      const bottomDist = Math.abs(clientY - rect.bottom);
      if (bottomDist < closestDist) {
        closestTop = rect.bottom;
        closestBlockPos = offset + node.nodeSize;
        closestDist = bottomDist;
        found = true;
      }
    });

    return found ? { top: closestTop, blockPos: closestBlockPos } : null;
  }, [editor]);

  if (!position) return null;

  return (
    <>
      <div className="fixed flex items-center gap-0.5 opacity-0 hover:opacity-100 transition-opacity" style={{ top: `${position.top}px`, left: `${position.left}px` }}>
        <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-tertiary)", fontSize: "18px" }}
          onClick={() => {
            if (hoveredPos === null) return;
            editor.chain().focus().insertContentAt(hoveredPos, { type: "paragraph" }).run();
            setTimeout(() => {
              editor.chain().focus().setTextSelection(hoveredPos + 1).insertContent("/").run();
            }, 50);
          }}
          title="블록 추가">+</button>
        <button
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-notion-bg-hover cursor-grab active:cursor-grabbing"
          style={{ color: "var(--text-tertiary)", fontSize: "12px" }}
          draggable
          onDragStart={(e) => {
            if (hoveredPos === null) return;
            const node = editor.state.doc.nodeAt(hoveredPos);
            const blockId = node?.attrs?.blockId as string | undefined;
            if (blockId) {
              e.dataTransfer.setData("text/block-id", blockId);
              e.dataTransfer.setData("text/plain", node?.textContent ?? "");
            }
          }}
          onMouseDown={(e) => {
            if (hoveredPos === null || !editor.view) return;
            e.preventDefault();

            const startPos = hoveredPos;

            // Handle shift+click for range selection
            if (e.shiftKey) {
              const currentState = BLOCK_SELECTION_KEY.getState(editor.state);
              if (currentState?.anchorBlock !== null) {
                selectBlockRange(editor, currentState.anchorBlock, startPos);
              } else {
                selectBlock(editor, startPos);
              }
              return;
            }

            // Handle ctrl/cmd+click for toggle selection
            if (e.metaKey || e.ctrlKey) {
              toggleBlockInSelection(editor, startPos);
              return;
            }

            // Select the single block immediately
            selectBlock(editor, startPos);

            // Also set ProseMirror NodeSelection so native drag works
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

            let isDragging = false;
            let dropTargetPos: number | null = null;

            // Drag-to-select: track mouse movement
            const handleMouseMoveForDrag = (moveEvent: MouseEvent) => {
              isDragging = true;

              // Auto-scroll when near edges
              const editorRect = editor.view.dom.getBoundingClientRect();
              if (autoScrollRef.current) {
                clearInterval(autoScrollRef.current);
                autoScrollRef.current = null;
              }

              if (moveEvent.clientY < editorRect.top + 50) {
                const speed = Math.max(1, Math.round((50 - (moveEvent.clientY - editorRect.top)) / 5));
                autoScrollRef.current = setInterval(() => window.scrollBy(0, -speed), 16);
              } else if (moveEvent.clientY > editorRect.bottom - 50) {
                const speed = Math.max(1, Math.round((50 - (editorRect.bottom - moveEvent.clientY)) / 5));
                autoScrollRef.current = setInterval(() => window.scrollBy(0, speed), 16);
              }

              // Find nearest block boundary for drop indicator
              const target = findDropTarget(moveEvent.clientY);
              if (target) {
                dropTargetPos = target.blockPos;
                setDropIndicator({
                  top: target.top,
                  left: editorRect.left,
                  width: editorRect.width,
                });
              }

              // Also update block range selection visual
              const coords = editor.view.posAtCoords({
                left: moveEvent.clientX,
                top: moveEvent.clientY,
              });
              if (!coords) return;
              try {
                const resolved = editor.state.doc.resolve(coords.pos);
                const endBlockPos = resolved.before(1);
                selectBlockRange(editor, startPos, endBlockPos);
              } catch {
                // ignore resolve errors
              }
            };

            const handleMouseUpForDrag = () => {
              // Clear auto-scroll
              if (autoScrollRef.current) {
                clearInterval(autoScrollRef.current);
                autoScrollRef.current = null;
              }

              // Perform the actual block move if we were dragging
              if (isDragging && dropTargetPos !== null) {
                const targetPos = dropTargetPos;
                try {
                  const blockState = BLOCK_SELECTION_KEY.getState(editor.state);
                  const selectedPositions = blockState && blockState.selectedBlocks.length > 1
                    ? [...blockState.selectedBlocks].sort((a: number, b: number) => a - b)
                    : [startPos];

                  // Check if we're actually moving (not dropping in same place)
                  const isMoving = !selectedPositions.includes(targetPos) &&
                    !selectedPositions.some((p: number) => {
                      const n = editor.state.doc.nodeAt(p);
                      return n && targetPos > p && targetPos <= p + n.nodeSize;
                    });

                  if (isMoving) {
                    let tr = editor.state.tr;
                    // Collect nodes to move (in reverse order for safe deletion)
                    const nodes = selectedPositions.map((p: number) => ({
                      pos: p,
                      node: editor.state.doc.nodeAt(p),
                    })).filter((n: { pos: number; node: ReturnType<typeof editor.state.doc.nodeAt> }) => n.node !== null);

                    // Calculate total size of selected blocks before drop position
                    let sizeBeforeDrop = 0;
                    for (const { pos, node } of nodes) {
                      if (pos < targetPos) sizeBeforeDrop += node!.nodeSize;
                    }

                    // Delete from end to start
                    for (const { pos, node } of [...nodes].reverse()) {
                      tr = tr.delete(pos, pos + node!.nodeSize);
                    }

                    // Adjust drop position
                    let insertAt = targetPos - sizeBeforeDrop;
                    insertAt = Math.max(0, Math.min(insertAt, tr.doc.content.size));

                    // Insert all nodes at drop position
                    for (const { node } of nodes) {
                      tr = tr.insert(insertAt, node!);
                      insertAt += node!.nodeSize;
                    }

                    tr = tr.setMeta(BLOCK_SELECTION_KEY, { selectedBlocks: [], anchorBlock: null });
                    editor.view.dispatch(tr);
                  }
                } catch {
                  // ignore move errors
                }
              }

              setDropIndicator(null);
              document.removeEventListener("mousemove", handleMouseMoveForDrag);
              document.removeEventListener("mouseup", handleMouseUpForDrag);
            };

            document.addEventListener("mousemove", handleMouseMoveForDrag);
            document.addEventListener("mouseup", handleMouseUpForDrag);
          }}
          onClick={(e) => {
            if (hoveredPos === null) return;
            // Open menu on click (but not on shift-click)
            if (!e.shiftKey) {
              onMenuOpen(hoveredPos);
            }
          }}
          title="드래그하여 이동 / 클릭하여 메뉴"
        >
          ⋮⋮
        </button>
      </div>

      {/* Drop indicator line */}
      {dropIndicator && (
        <div
          className="fixed h-[2px] pointer-events-none"
          style={{
            top: `${dropIndicator.top}px`,
            left: `${dropIndicator.left}px`,
            width: `${dropIndicator.width}px`,
            backgroundColor: "#2383e2",
            zIndex: 1000,
          }}
        />
      )}
    </>
  );
}
