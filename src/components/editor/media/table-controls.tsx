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
            zIndex: "var(--z-dropdown)" as unknown as number,
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
