"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { common, createLowlight } from "lowlight";
import { BlockId } from "./extensions/block-id";
import { SlashCommandExtension } from "./extensions/slash-command-ext";
import { SlashCommand } from "./slash-command/slash-command";
import { InlineToolbar } from "./inline-toolbar";
import { DragHandle } from "./drag-handle";
import { BlockMenu } from "./block-menu";
import "./utils/editor-styles.css";

const lowlight = createLowlight(common);

type NotionEditorProps = {
  initialContent?: Record<string, unknown>;
  onUpdate?: (json: Record<string, unknown>) => void;
  editable?: boolean;
};

export function NotionEditor({
  initialContent,
  onUpdate,
  editable = true,
}: NotionEditorProps) {
  const [menuState, setMenuState] = useState<{pos: number; coords: {top: number; left: number}} | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            const level = node.attrs.level;
            return level === 1
              ? "제목 1"
              : level === 2
                ? "제목 2"
                : "제목 3";
          }
          return "'/'를 입력하여 명령어 사용";
        },
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Image.configure({ allowBase64: true }),
      HorizontalRule,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      BlockId,
      SlashCommandExtension,
    ],
    content: initialContent || {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
    editable,
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getJSON() as Record<string, unknown>);
    },
    editorProps: {
      attributes: { class: "notion-editor" },
    },
  });

  if (!editor) return null;

  return (
    <div className="relative">
      <EditorContent editor={editor} />
      <InlineToolbar editor={editor} />
      <SlashCommand editor={editor} />
      <DragHandle editor={editor} onMenuOpen={(pos) => {
        const coords = editor.view.coordsAtPos(pos);
        setMenuState({ pos, coords: { top: coords.top, left: coords.left - 4 } });
      }} />
      {menuState && <BlockMenu editor={editor} pos={menuState.pos} coords={menuState.coords} onClose={() => setMenuState(null)} />}
    </div>
  );
}
