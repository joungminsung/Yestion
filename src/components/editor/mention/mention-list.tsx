"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { MENTION_KEY, type MentionState } from "../extensions/mention-ext";

export type MentionItem = {
  type: "user" | "page" | "date";
  id: string;
  label: string;
  icon?: string;
  category: string;
};

type MentionListProps = {
  editor: Editor;
  items: MentionItem[];
};

export function MentionList({ editor, items }: MentionListProps) {
  const [state, setState] = useState<MentionState>({
    active: false,
    query: "",
    from: 0,
    to: 0,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateState = () => {
      if (!editor.state) return;
      const pluginState = MENTION_KEY.getState(editor.state);
      if (pluginState) {
        setState(pluginState);
        if (pluginState.active) setSelectedIndex(0);
      }
    };
    editor.on("transaction", updateState);
    return () => {
      editor.off("transaction", updateState);
    };
  }, [editor]);

  const filtered = items.filter((item) => {
    if (!state.query) return true;
    const q = state.query.toLowerCase();
    return item.label.toLowerCase().includes(q);
  });

  const executeCommand = useCallback(
    (item: MentionItem) => {
      // Delete the @query text
      editor
        .chain()
        .focus()
        .deleteRange({ from: state.from, to: state.to })
        .run();

      // Insert mention node
      editor
        .chain()
        .focus()
        .insertContent({
          type: "mention",
          attrs: {
            type: item.type,
            id: item.id,
            label: item.label,
          },
        })
        .insertContent(" ")
        .run();

      // Close the suggestion
      if (!editor.view || !editor.state) return;
      editor.view.dispatch(
        editor.state.tr.setMeta(MENTION_KEY, {
          active: false,
          query: "",
          from: 0,
          to: 0,
        }),
      );
    },
    [editor, state],
  );

  useEffect(() => {
    if (!state.active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % Math.max(filtered.length, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (i) => (i - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1),
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) executeCommand(filtered[selectedIndex]);
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [state.active, filtered, selectedIndex, executeCommand]);

  if (!state.active || filtered.length === 0 || !editor.view) return null;

  const coords = editor.view.coordsAtPos(state.from);
  const categories = Array.from(new Set(filtered.map((i) => i.category)));

  // Viewport boundary check
  const menuHeight = 300;
  const menuWidth = 280;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  let menuTop = coords.bottom + 8;
  let menuLeft = coords.left;

  if (menuTop + menuHeight > viewportHeight - 20) {
    menuTop = coords.top - menuHeight - 8;
  }
  if (menuLeft + menuWidth > viewportWidth - 20) {
    menuLeft = viewportWidth - menuWidth - 20;
  }
  menuTop = Math.max(8, menuTop);
  menuLeft = Math.max(8, menuLeft);

  return (
    <div
      ref={menuRef}
      className="fixed rounded-lg overflow-hidden dropdown-enter"
      style={{
        top: `${menuTop}px`,
        left: `${menuLeft}px`,
        zIndex: "var(--z-dropdown)",
        backgroundColor: "var(--bg-primary)",
        boxShadow: "var(--shadow-popup)",
        width: "280px",
        maxHeight: "min(300px, calc(100vh - 100px))",
        overflowY: "auto",
      }}
    >
      {categories.map((category) => (
        <div key={category}>
          <div
            className="px-3 py-1.5"
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
            }}
          >
            {category}
          </div>
          {filtered
            .filter((item) => item.category === category)
            .map((item) => {
              const globalIndex = filtered.indexOf(item);
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm"
                  style={{
                    backgroundColor:
                      globalIndex === selectedIndex
                        ? "var(--bg-hover)"
                        : "transparent",
                    color: "var(--text-primary)",
                  }}
                  onClick={() => executeCommand(item)}
                  onMouseEnter={() => setSelectedIndex(globalIndex)}
                >
                  <span
                    className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 text-xs font-medium"
                    style={{
                      backgroundColor:
                        item.type === "user"
                          ? "#2383e2"
                          : item.type === "page"
                            ? "var(--bg-secondary)"
                            : "var(--color-orange-bg)",
                      color:
                        item.type === "user"
                          ? "white"
                          : "var(--text-primary)",
                    }}
                  >
                    {item.icon || item.label.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.label}</div>
                  </div>
                </button>
              );
            })}
        </div>
      ))}
    </div>
  );
}
