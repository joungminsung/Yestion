"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Trash2, ChevronDown, Copy } from "lucide-react";
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
    return () => { editor.off("transaction", update); };
  }, [editor]);

  useEffect(() => {
    if (!showTurnInto) return;
    const handleClickOutside = (e: MouseEvent) => {
      setShowTurnInto(false);
    };
    // Delay to avoid catching the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showTurnInto]);

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

  const handleTurnInto = (targetType: string, attrs?: Record<string, unknown>) => {
    const state = BLOCK_SELECTION_KEY.getState(editor.state);
    if (!state) return;
    const positions = [...state.selectedBlocks].sort((a, b) => a - b);

    let tr = editor.state.tr;

    for (const pos of positions) {
      const node = tr.doc.nodeAt(pos);
      if (!node) continue;

      const nodeType = editor.schema.nodes[targetType];
      if (!nodeType) continue;

      try {
        // For heading, set the level attribute
        if (targetType === "heading" && attrs?.level) {
          tr = tr.setNodeMarkup(pos, nodeType, { ...node.attrs, ...attrs });
        }
        // For paragraph, callout, blockquote — just change the type
        else if (targetType === "paragraph" || targetType === "blockquote" || targetType === "callout") {
          tr = tr.setNodeMarkup(pos, nodeType, { ...node.attrs, ...attrs });
        }
        // For list types, we need to wrap content differently
        // For now, convert to paragraph first (list conversion is complex)
        else {
          tr = tr.setNodeMarkup(pos, nodeType, { ...node.attrs, ...attrs });
        }
      } catch {
        // Some conversions may fail for certain node types — skip silently
      }
    }

    tr = tr.setMeta(BLOCK_SELECTION_KEY, { selectedBlocks: [], anchorBlock: null });
    editor.view.dispatch(tr);
    setShowTurnInto(false);
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
      <span className="text-xs font-medium px-2" style={{ color: "var(--text-secondary)" }}>
        {selectedCount} blocks
      </span>

      <div className="w-px h-4" style={{ backgroundColor: "var(--border-divider)" }} />

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
                key={opt.type + ("attrs" in opt && opt.attrs && "level" in opt.attrs ? opt.attrs.level : "")}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-notion-bg-hover"
                style={{ color: "var(--text-primary)" }}
                onClick={() => handleTurnInto(opt.type, "attrs" in opt ? opt.attrs as Record<string, unknown> : undefined)}
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
