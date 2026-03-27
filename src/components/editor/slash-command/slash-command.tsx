"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import {
  SLASH_COMMAND_KEY,
  type SlashCommandState,
} from "../extensions/slash-command-ext";
import { SLASH_ITEMS, type SlashItem } from "./slash-items";

export function SlashCommand({ editor }: { editor: Editor }) {
  const [state, setState] = useState<SlashCommandState>({
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
      const pluginState = SLASH_COMMAND_KEY.getState(editor.state);
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

  const filtered = SLASH_ITEMS.filter((item) => {
    if (!state.query) return true;
    const q = state.query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });

  const executeCommand = useCallback(
    (item: SlashItem) => {
      editor
        .chain()
        .focus()
        .deleteRange({ from: state.from, to: state.to })
        .run();
      item.command(editor);
      if (!editor.view || !editor.state) return;
      editor.view.dispatch(
        editor.state.tr.setMeta(SLASH_COMMAND_KEY, {
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
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
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
  const menuHeight = 400;
  const menuWidth = 320;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  let menuTop = coords.bottom + 8;
  let menuLeft = coords.left;

  // Flip to above if near bottom
  if (menuTop + menuHeight > viewportHeight - 20) {
    menuTop = coords.top - menuHeight - 8;
  }

  // Shift left if near right edge
  if (menuLeft + menuWidth > viewportWidth - 20) {
    menuLeft = viewportWidth - menuWidth - 20;
  }

  // Ensure not negative
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
        width: "320px",
        maxHeight: "min(400px, calc(100vh - 100px))",
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
                  key={item.title}
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
                    className="w-10 h-10 flex items-center justify-center rounded border flex-shrink-0"
                    style={{
                      borderColor: "var(--border-default)",
                      backgroundColor: "var(--bg-primary)",
                      fontSize: "16px",
                    }}
                  >
                    {item.icon}
                  </span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.title}</div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      ))}
    </div>
  );
}
