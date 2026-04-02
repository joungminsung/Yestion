"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, List, ListOrdered, ListChecks,
  Code, Quote, Highlighter, Link as LinkIcon, Undo2, Redo2,
  ChevronUp, ChevronDown, Type,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MobileToolbarProps = {
  editor: Editor;
};

type ToolGroup = "format" | "blocks" | "history";

const FORMAT_BUTTONS = [
  { icon: Bold, label: "Bold", action: (e: Editor) => e.chain().focus().toggleBold().run(), isActive: (e: Editor) => e.isActive("bold") },
  { icon: Italic, label: "Italic", action: (e: Editor) => e.chain().focus().toggleItalic().run(), isActive: (e: Editor) => e.isActive("italic") },
  { icon: UnderlineIcon, label: "Underline", action: (e: Editor) => e.chain().focus().toggleUnderline().run(), isActive: (e: Editor) => e.isActive("underline") },
  { icon: Strikethrough, label: "Strike", action: (e: Editor) => e.chain().focus().toggleStrike().run(), isActive: (e: Editor) => e.isActive("strike") },
  { icon: Highlighter, label: "Highlight", action: (e: Editor) => e.chain().focus().toggleHighlight({ color: "var(--color-yellow-bg)" }).run(), isActive: (e: Editor) => e.isActive("highlight") },
  { icon: Code, label: "Code", action: (e: Editor) => e.chain().focus().toggleCode().run(), isActive: (e: Editor) => e.isActive("code") },
  { icon: LinkIcon, label: "Link", action: (e: Editor) => {
    const url = prompt("URL");
    if (url) e.chain().focus().setLink({ href: url }).run();
  }, isActive: (e: Editor) => e.isActive("link") },
];

const BLOCK_BUTTONS = [
  { icon: Type, label: "Text", action: (e: Editor) => e.chain().focus().setParagraph().run(), isActive: (e: Editor) => e.isActive("paragraph") },
  { icon: Heading1, label: "H1", action: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run(), isActive: (e: Editor) => e.isActive("heading", { level: 1 }) },
  { icon: Heading2, label: "H2", action: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run(), isActive: (e: Editor) => e.isActive("heading", { level: 2 }) },
  { icon: List, label: "Bullet", action: (e: Editor) => e.chain().focus().toggleBulletList().run(), isActive: (e: Editor) => e.isActive("bulletList") },
  { icon: ListOrdered, label: "Number", action: (e: Editor) => e.chain().focus().toggleOrderedList().run(), isActive: (e: Editor) => e.isActive("orderedList") },
  { icon: ListChecks, label: "Todo", action: (e: Editor) => e.chain().focus().toggleTaskList().run(), isActive: (e: Editor) => e.isActive("taskList") },
  { icon: Quote, label: "Quote", action: (e: Editor) => e.chain().focus().toggleBlockquote().run(), isActive: (e: Editor) => e.isActive("blockquote") },
];

export function MobileToolbar({ editor }: MobileToolbarProps) {
  const [activeGroup, setActiveGroup] = useState<ToolGroup>("format");
  const [expanded, setExpanded] = useState(false);

  if (!editor.isFocused && !expanded) return null;

  const buttons = activeGroup === "format"
    ? FORMAT_BUTTONS
    : activeGroup === "blocks"
      ? BLOCK_BUTTONS
      : [];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 border-t safe-area-pb"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
        zIndex: "var(--z-dropdown)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Tool group tabs */}
      <div className="flex items-center border-b" style={{ borderColor: "var(--border-divider)" }}>
        {(["format", "blocks", "history"] as const).map((group) => (
          <button
            key={group}
            onClick={() => setActiveGroup(group)}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors",
              activeGroup === group
                ? "text-[#2383e2] border-b-2 border-[#2383e2]"
                : "text-[var(--text-tertiary)]"
            )}
          >
            {group === "format" ? "\uC11C\uC2DD" : group === "blocks" ? "\uBE14\uB85D" : "\uAE30\uB85D"}
          </button>
        ))}
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-2"
          style={{ color: "var(--text-tertiary)" }}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {/* Buttons row */}
      <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto">
        {activeGroup === "history" ? (
          <>
            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="p-2.5 rounded-md hover:bg-notion-bg-hover disabled:opacity-30"
              style={{ color: "var(--text-primary)" }}
            >
              <Undo2 size={18} />
            </button>
            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="p-2.5 rounded-md hover:bg-notion-bg-hover disabled:opacity-30"
              style={{ color: "var(--text-primary)" }}
            >
              <Redo2 size={18} />
            </button>
          </>
        ) : (
          buttons.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.label}
                onClick={() => btn.action(editor)}
                className={cn(
                  "p-2.5 rounded-md transition-colors shrink-0",
                  btn.isActive(editor)
                    ? "bg-[#2383e2]/10"
                    : "hover:bg-notion-bg-hover"
                )}
                style={{
                  color: btn.isActive(editor) ? "#2383e2" : "var(--text-primary)",
                }}
                title={btn.label}
              >
                <Icon size={18} />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
