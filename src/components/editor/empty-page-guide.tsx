"use client";

import { useState, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { FileText, ListChecks, Calendar, LayoutTemplate } from "lucide-react";

type Props = {
  editor: Editor;
  onOpenTemplates?: () => void;
};

const QUICK_TEMPLATES = [
  { icon: <FileText size={20} />, label: "Notes", type: "notes" },
  { icon: <ListChecks size={20} />, label: "Todo", type: "todo" },
  { icon: <Calendar size={20} />, label: "Plan", type: "plan" },
] as const;

export function EmptyPageGuide({ editor, onOpenTemplates }: Props) {
  const [visible, setVisible] = useState(true);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    const checkContent = () => {
      const doc = editor.state.doc;
      // Page is "empty" if it has only one empty paragraph (or is completely empty)
      const isEmpty = doc.childCount === 0 ||
        (doc.childCount === 1 && doc.firstChild?.isTextblock && doc.firstChild.content.size === 0);

      if (isEmpty && !hasShown) {
        setVisible(true);
        setHasShown(true);
      } else if (!isEmpty) {
        setVisible(false);
      }
    };

    checkContent();
    editor.on("update", checkContent);
    return () => { editor.off("update", checkContent); };
  }, [editor, hasShown]);

  if (!visible) return null;

  const insertTemplate = (type: string) => {
    setVisible(false);

    if (type === "notes") {
      editor.chain().focus()
        .insertContent([
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Notes" }] },
          { type: "paragraph" },
        ])
        .run();
    } else if (type === "todo") {
      editor.chain().focus()
        .insertContent([
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Today" }] },
          { type: "taskList", content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
          ]},
        ])
        .run();
    } else if (type === "plan") {
      editor.chain().focus()
        .insertContent([
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Goals" }] },
          { type: "bulletList", content: [
            { type: "listItem", content: [{ type: "paragraph" }] },
          ]},
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Tasks" }] },
          { type: "taskList", content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
          ]},
        ])
        .run();
    }
  };

  return (
    <div
      className="flex flex-col items-center gap-4 py-8 select-none transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
        Press <kbd className="px-1.5 py-0.5 rounded text-xs border" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-secondary)" }}>Enter</kbd> to start writing, or pick a template
      </p>

      <div className="flex items-center gap-3">
        {QUICK_TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.type}
            onClick={() => insertTemplate(tmpl.type)}
            className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg border hover:bg-notion-bg-hover transition-colors"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            {tmpl.icon}
            <span className="text-xs">{tmpl.label}</span>
          </button>
        ))}

        {onOpenTemplates && (
          <button
            onClick={() => { setVisible(false); onOpenTemplates(); }}
            className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg border hover:bg-notion-bg-hover transition-colors"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            <LayoutTemplate size={20} />
            <span className="text-xs">Templates</span>
          </button>
        )}
      </div>

      <p className="text-xs" style={{ color: "var(--text-placeholder)" }}>
        Or type <kbd className="px-1 py-0.5 rounded text-xs border" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-secondary)" }}>/</kbd> for commands
      </p>
    </div>
  );
}
