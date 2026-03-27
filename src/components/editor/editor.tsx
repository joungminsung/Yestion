"use client";

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ImageBlock } from "./extensions/image-block";
import { EmbedBlock } from "./extensions/embed-block";
import { BookmarkBlock } from "./extensions/bookmark-block";
import { VideoBlock } from "./extensions/video-block";
import { AudioBlock } from "./extensions/audio-block";
import { FileBlock } from "./extensions/file-block";
import "./media/image-block-styles.css";
import "./media/embed-block-styles.css";
import "./media/bookmark-block-styles.css";
import "./media/media-block-styles.css";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { common, createLowlight } from "lowlight";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { Doc as YDoc } from "yjs";
import { BlockId } from "./extensions/block-id";
import { ToggleBlock, DetailsSummary, DetailsContent } from "./extensions/toggle";
import { Callout } from "./extensions/callout";
import { Equation } from "./extensions/equation";
import { TableOfContents } from "./extensions/table-of-contents";
import { ColumnList, Column } from "./extensions/column-list";
import { SlashCommandExtension } from "./extensions/slash-command-ext";
import { BlockSelection } from "./extensions/block-selection";
import { SlashCommand } from "./slash-command/slash-command";
import { InlineToolbar } from "./inline-toolbar";
import { DragHandle } from "./drag-handle";
import { BlockMenu } from "./block-menu";
import { AiPrompt } from "./ai/ai-prompt";
import { useAiStore } from "@/stores/ai";
import "./utils/editor-styles.css";
import "./cursor-styles.css";

const lowlight = createLowlight(common);

type CollaborationConfig = {
  ydoc: YDoc;
  provider: HocuspocusProvider;
  user: { id: string; name: string; color: string };
};

type NotionEditorProps = {
  initialContent?: Record<string, unknown>;
  onUpdate?: (json: Record<string, unknown>) => void;
  editable?: boolean;
  collaboration?: CollaborationConfig;
};

export type NotionEditorHandle = { commands: { setContent: (content: unknown) => boolean } };

export const NotionEditor = forwardRef<
  NotionEditorHandle,
  NotionEditorProps
>(function NotionEditor({
  initialContent,
  onUpdate,
  editable = true,
  collaboration,
}, ref) {
  const [menuState, setMenuState] = useState<{pos: number; coords: {top: number; left: number}} | null>(null);
  const aiStore = useAiStore();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        horizontalRule: false,
        // C2: Disable StarterKit history when collaboration is active to avoid
        // conflicts with Yjs undo manager
        ...(collaboration ? { history: false } : {}),
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
      ImageBlock.configure({ allowBase64: true }),
      EmbedBlock,
      BookmarkBlock,
      VideoBlock,
      AudioBlock,
      FileBlock,
      HorizontalRule,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      ToggleBlock,
      DetailsSummary,
      DetailsContent,
      Callout,
      Equation,
      TableOfContents,
      ColumnList,
      Column,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      BlockId,
      BlockSelection,
      SlashCommandExtension,
      ...(collaboration ? [
        Collaboration.configure({ document: collaboration.ydoc }),
        CollaborationCursor.configure({
          provider: collaboration.provider,
          user: { name: collaboration.user.name, color: collaboration.user.color },
        }),
      ] : []),
    ],
    content: collaboration ? undefined : (initialContent || {
      type: "doc",
      content: [{ type: "paragraph" }],
    }),
    editable,
    onUpdate: collaboration ? undefined : ({ editor }) => {
      onUpdate?.(editor.getJSON() as Record<string, unknown>);
    },
    editorProps: {
      attributes: { class: "notion-editor" },
      handleKeyDown(_view, event) {
        // Tab: indent (sink list item or insert spaces in code block)
        if (event.key === "Tab" && !event.shiftKey) {
          if (editor?.isActive("listItem") || editor?.isActive("taskItem")) {
            event.preventDefault();
            const sunkList = editor!.chain().focus().sinkListItem("listItem").run();
            if (!sunkList) {
              editor!.chain().focus().sinkListItem("taskItem").run();
            }
            return true;
          }
          if (editor?.isActive("codeBlock")) {
            event.preventDefault();
            editor!.chain().focus().insertContent("  ").run();
            return true;
          }
          event.preventDefault();
          return true;
        }

        // Shift+Tab: outdent (lift list item)
        if (event.key === "Tab" && event.shiftKey) {
          if (editor?.isActive("listItem") || editor?.isActive("taskItem")) {
            event.preventDefault();
            const liftedList = editor!.chain().focus().liftListItem("listItem").run();
            if (!liftedList) {
              editor!.chain().focus().liftListItem("taskItem").run();
            }
            return true;
          }
          event.preventDefault();
          return true;
        }

        return false;
      },
    },
  });

  // Expose editor commands via ref for C3 block-to-Yjs hydration
  useImperativeHandle(ref, () => {
    if (!editor) return { commands: { setContent: () => false } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { commands: { setContent: (content: unknown) => editor.commands.setContent(content as any) } };
  }, [editor]);

  // Listen for AI open events from slash command
  useEffect(() => {
    const handleAiOpen = (e: Event) => {
      const { context, position } = (e as CustomEvent).detail;
      aiStore.open(context || "", position);
    };
    window.addEventListener("ai-open", handleAiOpen);
    return () => window.removeEventListener("ai-open", handleAiOpen);
  }, [aiStore]);

  const handleAiInsert = useCallback((text: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(text).run();
  }, [editor]);

  const handleAiReplace = useCallback((text: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from !== to) {
      editor.chain().focus().deleteRange({ from, to }).insertContent(text).run();
    } else {
      editor.chain().focus().insertContent(text).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="relative">
      <EditorContent editor={editor} />
      {editor.view && (
        <>
          <InlineToolbar editor={editor} />
          <SlashCommand editor={editor} />
          <DragHandle editor={editor} onMenuOpen={(pos) => {
            if (!editor.view) return;
            const coords = editor.view.coordsAtPos(pos);
            setMenuState({ pos, coords: { top: coords.top, left: coords.left - 4 } });
          }} />
        </>
      )}
      {menuState && <BlockMenu editor={editor} pos={menuState.pos} coords={menuState.coords} onClose={() => setMenuState(null)} />}
      {aiStore.isOpen && aiStore.position && (
        <div
          className="fixed"
          style={{
            top: `${aiStore.position.top}px`,
            left: `${aiStore.position.left}px`,
            zIndex: "var(--z-modal)",
          }}
        >
          <AiPrompt
            context={aiStore.context || undefined}
            onInsert={handleAiInsert}
            onReplace={handleAiReplace}
            onClose={aiStore.close}
          />
        </div>
      )}
    </div>
  );
});
