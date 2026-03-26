"use client";

import { useEffect, useRef } from "react";
import { useCommandPaletteStore } from "@/stores/command-palette";

export function CommandPalette() {
  const { isOpen, query, close, setQuery } = useCommandPaletteStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: "var(--z-command-palette)", backgroundColor: "rgba(15, 15, 15, 0.6)" }}
        onClick={close}
      />
      <div
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-[620px] rounded-lg overflow-hidden"
        style={{
          top: "max(12vh, 80px)",
          zIndex: "calc(var(--z-command-palette) + 1)",
          backgroundColor: "var(--bg-primary)",
          boxShadow: "var(--shadow-popup)",
        }}
      >
        <div className="flex items-center px-4 py-3 border-b" style={{ borderColor: "var(--border-default)" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>
            <path d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" fill="currentColor" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색..."
            className="flex-1 ml-3 bg-transparent outline-none"
            style={{ fontSize: "16px", color: "var(--text-primary)", fontFamily: "var(--notion-font-family)" }}
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-1" style={{ fontSize: "14px" }}>
          <div className="px-4 py-2" style={{ fontSize: "12px", color: "var(--text-tertiary)", fontWeight: 500 }}>
            최근 방문
          </div>
          <div className="px-4 py-3 text-center" style={{ color: "var(--text-tertiary)" }}>
            결과가 없습니다
          </div>
        </div>
      </div>
    </>
  );
}
