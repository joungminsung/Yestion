"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";

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
  }, [isOpen]);

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
    // Replace from end to start to preserve positions
    [...matches].reverse().forEach(match => {
      editor.chain().focus()
        .setTextSelection(match)
        .insertContent(replacement)
        .run();
    });
    findMatches();
  };

  const clearHighlights = () => { setMatches([]); };

  if (!isOpen) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center gap-2 px-4 py-2 border-b"
      style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)" }}>
      <div className="flex items-center gap-2 flex-1">
        <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="찾기..." className="px-2 py-1 rounded text-sm border outline-none"
          style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", width: "200px" }}
          onKeyDown={e => {
            if (e.key === "Enter") goToMatch((currentIndex + 1) % matches.length);
            if (e.key === "Enter" && e.shiftKey) goToMatch((currentIndex - 1 + matches.length) % matches.length);
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
        <button onClick={() => goToMatch((currentIndex - 1 + matches.length) % matches.length)} className="px-1 rounded hover:bg-notion-bg-hover">&#8593;</button>
        <button onClick={() => goToMatch((currentIndex + 1) % matches.length)} className="px-1 rounded hover:bg-notion-bg-hover">&#8595;</button>
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
