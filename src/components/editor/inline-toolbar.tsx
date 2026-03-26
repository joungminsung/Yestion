"use client";

import { useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";

export function InlineToolbar({ editor }: { editor: Editor }) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const { from, to } = editor.state.selection;
    if (from === to) {
      setIsVisible(false);
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
  ];

  if (!isVisible) return null;

  return (
    <div
      className="fixed flex items-center rounded-lg overflow-hidden"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%)",
        zIndex: "var(--z-dropdown)",
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
          }}
          title={btn.label}
        >
          {btn.icon}
        </button>
      ))}
    </div>
  );
}
