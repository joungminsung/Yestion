"use client";

import { useEffect, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";

type DragHandleProps = { editor: Editor; onMenuOpen: (pos: number) => void };

export function DragHandle({ editor, onMenuOpen }: DragHandleProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [hoveredPos, setHoveredPos] = useState<number | null>(null);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    const view = editor.view;
    const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (!pos) { setPosition(null); return; }
    try {
      const node = view.state.doc.resolve(pos.pos);
      const blockPos = node.before(1);
      const coords = view.coordsAtPos(blockPos);
      const editorRect = view.dom.getBoundingClientRect();
      setPosition({ top: coords.top, left: editorRect.left - 48 });
      setHoveredPos(blockPos);
    } catch { setPosition(null); }
  }, [editor]);

  useEffect(() => {
    const dom = editor.view.dom;
    dom.addEventListener("mousemove", handleMouseMove);
    return () => dom.removeEventListener("mousemove", handleMouseMove);
  }, [editor, handleMouseMove]);

  if (!position) return null;

  return (
    <div className="fixed flex items-center gap-0.5 opacity-0 hover:opacity-100 transition-opacity" style={{ top: `${position.top}px`, left: `${position.left}px` }}>
      <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-notion-bg-hover"
        style={{ color: "var(--text-tertiary)", fontSize: "18px" }}
        onClick={() => { if (hoveredPos !== null) editor.chain().focus().insertContentAt(hoveredPos, { type: "paragraph" }).run(); }}
        title="블록 추가">+</button>
      <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-notion-bg-hover cursor-grab"
        style={{ color: "var(--text-tertiary)", fontSize: "12px" }}
        onClick={() => { if (hoveredPos !== null) onMenuOpen(hoveredPos); }}
        title="드래그하여 이동">⋮⋮</button>
    </div>
  );
}
