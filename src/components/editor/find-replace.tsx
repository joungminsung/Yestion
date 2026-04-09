"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const findPluginKey = new PluginKey("findHighlight");

type Props = { editor: Editor };

export function FindReplace({ editor }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matches, setMatches] = useState<{ from: number; to: number }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const findPluginRef = useRef<Plugin | null>(null);

  // Register the find highlight plugin
  useEffect(() => {
    if (!editor) return;

    const plugin = new Plugin({
      key: findPluginKey,
      state: {
        init() {
          return { matches: [] as { from: number; to: number }[], currentIndex: -1 };
        },
        apply(tr, prev) {
          const meta = tr.getMeta(findPluginKey);
          if (meta) return meta;
          if (tr.docChanged) return { matches: [], currentIndex: -1 };
          return prev;
        },
      },
      props: {
        decorations(state) {
          const pluginState = findPluginKey.getState(state);
          if (!pluginState || pluginState.matches.length === 0) return DecorationSet.empty;
          const decos = pluginState.matches.map((m: { from: number; to: number }, i: number) =>
            Decoration.inline(m.from, m.to, {
              class: i === pluginState.currentIndex ? "notion-find-current" : "notion-find-match",
            })
          );
          return DecorationSet.create(state.doc, decos);
        },
      },
    });

    findPluginRef.current = plugin;
    editor.registerPlugin(plugin);
    return () => {
      editor.unregisterPlugin(findPluginKey);
      findPluginRef.current = null;
    };
  }, [editor]);

  // Update decorations when matches or currentIndex change
  useEffect(() => {
    if (!editor || !findPluginRef.current) return;
    const tr = editor.state.tr.setMeta(findPluginKey, { matches, currentIndex });
    editor.view.dispatch(tr);
  }, [matches, currentIndex, editor]);

  const clearHighlights = useCallback(() => {
    setMatches([]);
    if (editor && findPluginRef.current) {
      const tr = editor.state.tr.setMeta(findPluginKey, { matches: [], currentIndex: -1 });
      editor.view.dispatch(tr);
    }
  }, [editor]);

  // Cmd+F to open, Cmd+H to open with replace
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setIsOpen(true);
        setShowReplace(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "h") {
        e.preventDefault();
        setIsOpen(true);
        setShowReplace(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setQuery("");
        clearHighlights();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, clearHighlights]);

  // Find matches when query changes
  const findMatches = useCallback(() => {
    if (!query || !editor.state) { setMatches([]); return; }
    const results: { from: number; to: number }[] = [];
    const searchText = caseSensitive ? query : query.toLowerCase();
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText) return;
      const text = caseSensitive ? node.text! : node.text!.toLowerCase();
      let index = text.indexOf(searchText);
      while (index !== -1) {
        results.push({ from: pos + index, to: pos + index + query.length });
        index = text.indexOf(searchText, index + 1);
      }
    });
    setMatches(results);
    setCurrentIndex(results.length > 0 ? 0 : -1);
  }, [query, editor, caseSensitive]);

  useEffect(() => { findMatches(); }, [findMatches]);

  const goToMatch = (index: number) => {
    if (matches[index]) {
      editor.chain().focus().setTextSelection(matches[index]).run();
      setCurrentIndex(index);
      // Scroll into view
      const coords = editor.view.coordsAtPos(matches[index].from);
      const el = document.elementFromPoint(coords.left, coords.top);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const replaceOne = () => {
    if (matches[currentIndex]) {
      editor.chain().focus()
        .setTextSelection(matches[currentIndex])
        .insertContent(replacement)
        .run();
      findMatches();
    }
  };

  const replaceAll = () => {
    if (matches.length === 0) return;
    // Build a single transaction that replaces all matches from end to start
    // to preserve positions within one dispatch
    const { tr } = editor.state;
    [...matches].reverse().forEach(match => {
      tr.replaceWith(match.from, match.to, editor.state.schema.text(replacement));
    });
    editor.view.dispatch(tr);
    findMatches();
  };

  if (!isOpen) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center gap-2 px-4 py-2 border-b"
      style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)" }}>
      <div className="flex items-center gap-2 flex-1">
        <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="찾기..." className="px-2 py-1 rounded text-sm border outline-none"
          style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", width: "200px" }}
          onKeyDown={e => {
            if (e.key === "Enter" && matches.length > 0) {
              if (e.shiftKey) {
                goToMatch((currentIndex - 1 + matches.length) % matches.length);
              } else {
                goToMatch((currentIndex + 1) % matches.length);
              }
            }
          }}
        />
        {showReplace && (
          <input type="text" value={replacement} onChange={e => setReplacement(e.target.value)}
            placeholder="바꾸기..." className="px-2 py-1 rounded text-sm border outline-none"
            style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", width: "200px" }}
          />
        )}
      </div>
      <div className="flex items-center gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
        <span>{matches.length > 0 ? `${currentIndex + 1}/${matches.length}` : "0/0"}</span>
        <button onClick={() => matches.length > 0 && goToMatch((currentIndex - 1 + matches.length) % matches.length)} className="px-1 rounded hover:bg-notion-bg-hover">&#8593;</button>
        <button onClick={() => matches.length > 0 && goToMatch((currentIndex + 1) % matches.length)} className="px-1 rounded hover:bg-notion-bg-hover">&#8595;</button>
        <button onClick={() => setCaseSensitive(!caseSensitive)} className={`px-1 rounded ${caseSensitive ? "bg-notion-bg-active" : "hover:bg-notion-bg-hover"}`}>Aa</button>
        {showReplace && (
          <>
            <button onClick={replaceOne} className="px-2 py-0.5 rounded hover:bg-notion-bg-hover">바꾸기</button>
            <button onClick={replaceAll} className="px-2 py-0.5 rounded hover:bg-notion-bg-hover">모두</button>
          </>
        )}
        {!showReplace && <button onClick={() => setShowReplace(true)} className="px-1 rounded hover:bg-notion-bg-hover text-xs">바꾸기</button>}
        <button onClick={() => { setIsOpen(false); setQuery(""); clearHighlights(); }} className="px-1 rounded hover:bg-notion-bg-hover">&#10005;</button>
      </div>
    </div>
  );
}
