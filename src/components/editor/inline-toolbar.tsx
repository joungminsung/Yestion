"use client";

import { useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { AiMenu } from "./ai/ai-menu";

const TEXT_COLORS = [
  { name: "기본", value: "default", css: "var(--text-primary)" },
  { name: "회색", value: "gray", css: "var(--color-gray)" },
  { name: "갈색", value: "brown", css: "var(--color-brown)" },
  { name: "주황", value: "orange", css: "var(--color-orange)" },
  { name: "노랑", value: "yellow", css: "var(--color-yellow)" },
  { name: "초록", value: "green", css: "var(--color-green)" },
  { name: "파랑", value: "blue", css: "var(--color-blue)" },
  { name: "보라", value: "purple", css: "var(--color-purple)" },
  { name: "분홍", value: "pink", css: "var(--color-pink)" },
  { name: "빨강", value: "red", css: "var(--color-red)" },
];

const BG_COLORS = [
  { name: "기본", value: "default", css: "transparent" },
  { name: "회색", value: "gray", css: "var(--color-gray-bg)" },
  { name: "갈색", value: "brown", css: "var(--color-brown-bg)" },
  { name: "주황", value: "orange", css: "var(--color-orange-bg)" },
  { name: "노랑", value: "yellow", css: "var(--color-yellow-bg)" },
  { name: "초록", value: "green", css: "var(--color-green-bg)" },
  { name: "파랑", value: "blue", css: "var(--color-blue-bg)" },
  { name: "보라", value: "purple", css: "var(--color-purple-bg)" },
  { name: "분홍", value: "pink", css: "var(--color-pink-bg)" },
  { name: "빨강", value: "red", css: "var(--color-red-bg)" },
];

export function InlineToolbar({ editor }: { editor: Editor }) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showColors, setShowColors] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);

  const updatePosition = useCallback(() => {
    if (!editor.view || !editor.state) { setIsVisible(false); return; }
    const { from, to } = editor.state.selection;
    if (from === to) {
      setIsVisible(false);
      setShowColors(false);
      setShowAiMenu(false);
      return;
    }
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    setPosition({
      top: start.top - 48,
      left: (start.left + end.left) / 2,
    });
    setIsVisible(true);
  }, [editor]);

  useEffect(() => {
    editor.on("selectionUpdate", updatePosition);
    return () => {
      editor.off("selectionUpdate", updatePosition);
    };
  }, [editor, updatePosition]);

  const buttons = [
    {
      label: "Bold",
      icon: "B",
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive("bold"),
    },
    {
      label: "Italic",
      icon: "I",
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive("italic"),
    },
    {
      label: "Underline",
      icon: "U",
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: () => editor.isActive("underline"),
    },
    {
      label: "Strikethrough",
      icon: "S",
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: () => editor.isActive("strike"),
    },
    {
      label: "Code",
      icon: "<>",
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: () => editor.isActive("code"),
    },
    {
      label: "Link",
      icon: "\uD83D\uDD17",
      action: () => {
        const url = window.prompt("URL:");
        if (url) editor.chain().focus().setLink({ href: url }).run();
        else editor.chain().focus().unsetLink().run();
      },
      isActive: () => editor.isActive("link"),
    },
    {
      label: "Color",
      icon: "A",
      action: () => { setShowColors((prev) => !prev); setShowAiMenu(false); },
      isActive: () => showColors,
    },
    {
      label: "AI",
      icon: "✨",
      action: () => { setShowAiMenu((prev) => !prev); setShowColors(false); },
      isActive: () => showAiMenu,
    },
  ];

  if (!isVisible) return null;

  return (
    <div
      className="fixed flex flex-col items-start rounded-lg overflow-visible"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%)",
        zIndex: "var(--z-dropdown)",
      }}
    >
      <div
        className="flex items-center rounded-lg overflow-hidden"
        style={{
          backgroundColor: "var(--bg-primary)",
          boxShadow: "var(--shadow-popup)",
        }}
      >
        {buttons.map((btn) => (
          <button
            key={btn.label}
            onClick={btn.action}
            className={cn(
              "px-3 py-2 text-sm font-medium hover:bg-notion-bg-hover transition-colors",
            )}
            style={{
              color: btn.isActive() ? "#2383e2" : "var(--text-primary)",
              fontWeight: btn.label === "Bold" ? 700 : undefined,
              fontStyle: btn.label === "Italic" ? "italic" : undefined,
              textDecoration:
                btn.label === "Underline"
                  ? "underline"
                  : btn.label === "Strikethrough"
                    ? "line-through"
                    : undefined,
              ...(btn.label === "Color"
                ? {
                    borderBottom: "2px solid currentColor",
                    paddingBottom: "6px",
                  }
                : {}),
            }}
            title={btn.label}
          >
            {btn.icon}
          </button>
        ))}
      </div>
      {showAiMenu && (
        <AiMenu
          editor={editor}
          position={{ top: position.top + 44, left: position.left }}
          onClose={() => setShowAiMenu(false)}
        />
      )}
      {showColors && (
        <div
          className="absolute top-full left-0 mt-1 p-2 rounded-lg"
          style={{
            backgroundColor: "var(--bg-primary)",
            boxShadow: "var(--shadow-popup)",
            width: "220px",
            zIndex: 1,
          }}
        >
          <div
            className="mb-2"
            style={{
              fontSize: "11px",
              color: "var(--text-tertiary)",
              fontWeight: 500,
            }}
          >
            텍스트 색상
          </div>
          <div className="flex flex-wrap gap-1 mb-3">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.value}
                className="w-6 h-6 rounded flex items-center justify-center text-sm hover:ring-2 ring-[#2383e2]"
                style={{ color: c.css }}
                title={c.name}
                onClick={() => {
                  if (c.value === "default")
                    editor.chain().focus().unsetColor().run();
                  else editor.chain().focus().setColor(c.css).run();
                  setShowColors(false);
                }}
              >
                A
              </button>
            ))}
          </div>
          <div
            className="mb-2"
            style={{
              fontSize: "11px",
              color: "var(--text-tertiary)",
              fontWeight: 500,
            }}
          >
            배경 색상
          </div>
          <div className="flex flex-wrap gap-1">
            {BG_COLORS.map((c) => (
              <button
                key={c.value}
                className="w-6 h-6 rounded border hover:ring-2 ring-[#2383e2]"
                style={{
                  backgroundColor: c.css,
                  borderColor: "var(--border-default)",
                }}
                title={c.name}
                onClick={() => {
                  if (c.value === "default")
                    editor.chain().focus().unsetHighlight().run();
                  else
                    editor.chain().focus().setHighlight({ color: c.css }).run();
                  setShowColors(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
