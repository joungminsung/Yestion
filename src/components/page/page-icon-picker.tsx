"use client";

import { useEffect, useRef } from "react";

const EMOJI_LIST = [
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃",
  "😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙",
  "😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔",
  "😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔",
  "😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵",
  "🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐","😕",
  "📄","📝","📚","📖","📕","📗","📘","📙","📓","📒",
  "💡","🔥","⭐","🎯","🚀","💎","🔑","🔒","🔔","📌",
];

type PageIconPickerProps = {
  currentIcon: string | null;
  onSelect: (icon: string | null) => void;
  onClose: () => void;
};

export function PageIconPicker({ currentIcon, onSelect, onClose }: PageIconPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 rounded-lg p-3"
      style={{
        backgroundColor: "var(--bg-primary)",
        boxShadow: "var(--shadow-popup)",
        border: "1px solid var(--border-default)",
        width: "320px",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          아이콘
        </span>
        {currentIcon && (
          <button
            onClick={() => { onSelect(null); onClose(); }}
            className="text-xs px-2 py-0.5 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-secondary)" }}
          >
            제거
          </button>
        )}
      </div>
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: "repeat(10, 1fr)" }}
      >
        {EMOJI_LIST.map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="flex items-center justify-center rounded hover:bg-notion-bg-hover cursor-pointer"
            style={{
              width: "28px",
              height: "28px",
              fontSize: "18px",
              backgroundColor: emoji === currentIcon ? "var(--bg-active)" : undefined,
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
