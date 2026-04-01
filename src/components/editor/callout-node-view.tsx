"use client";

import { useState, useRef, useEffect } from "react";
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";

const EMOJI_OPTIONS = [
  "\u{1F4A1}", "\u26A0\uFE0F", "\u{1F4DD}", "\u2705", "\u274C",
  "\u{1F4CC}", "\u{1F525}", "\u{1F4AC}", "\u{1F4CE}", "\u2139\uFE0F",
  "\u{1F680}", "\u{1F3AF}", "\u{1F4A1}", "\u{1F50D}", "\u{1F4E2}",
  "\u2B50", "\u{1F6A8}", "\u{1F512}", "\u{1F4C1}", "\u2764\uFE0F",
];

export function CalloutNodeView({ node, updateAttributes }: NodeViewProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const icon = (node.attrs.icon as string) || "\u{1F4A1}";

  useEffect(() => {
    if (!showPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as HTMLElement)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPicker]);

  return (
    <NodeViewWrapper
      data-type="callout"
      className="notion-callout"
    >
      <div className="relative" contentEditable={false}>
        <button
          className="notion-callout-icon cursor-pointer hover:bg-notion-bg-hover rounded p-0.5"
          onClick={() => setShowPicker((prev) => !prev)}
          type="button"
          aria-label="Change callout icon"
        >
          {icon}
        </button>
        {showPicker && (
          <div
            ref={pickerRef}
            className="absolute top-full left-0 mt-1 rounded-lg p-2 grid grid-cols-5 gap-1"
            style={{
              zIndex: "var(--z-dropdown, 50)",
              backgroundColor: "var(--bg-primary, #fff)",
              boxShadow: "var(--shadow-popup, 0 2px 8px rgba(0,0,0,0.15))",
              width: "180px",
            }}
          >
            {EMOJI_OPTIONS.map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-notion-bg-hover text-lg"
                onClick={() => {
                  updateAttributes({ icon: emoji });
                  setShowPicker(false);
                }}
                type="button"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
      <NodeViewContent className="notion-callout-content" />
    </NodeViewWrapper>
  );
}
