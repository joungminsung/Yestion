"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import {
  selectBlock,
  selectBlockRange,
  BLOCK_SELECTION_KEY,
} from "./extensions/block-selection";

type DragHandleProps = { editor: Editor; onMenuOpen: (pos: number) => void };

export function DragHandle({ editor, onMenuOpen }: DragHandleProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [hoveredPos, setHoveredPos] = useState<number | null>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  if (!position) return null;

  return (
    <div className="fixed flex items-center gap-0.5 opacity-0 hover:opacity-100 transition-opacity" style={{ top: `${position.top}px`, left: `${position.left}px` }}>
      <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-notion-bg-hover"
        style={{ color: "var(--text-tertiary)", fontSize: "18px" }}
        onClick={() => { if (hoveredPos !== null) editor.chain().focus().insertContentAt(hoveredPos, { type: "paragraph" }).run(); }}
        title="블록 추가">+</button>
      <button
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-notion-bg-hover cursor-grab active:cursor-grabbing"
        style={{ color: "var(--text-tertiary)", fontSize: "12px" }}
        draggable
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

          // Drag-to-select: track mouse movement
          const handleMouseMoveForDrag = (moveEvent: MouseEvent) => {
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
  );
}
