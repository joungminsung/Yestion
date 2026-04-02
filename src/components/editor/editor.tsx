"use client";

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, lazy, Suspense } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { CodeBlockEnhanced } from "./extensions/code-block-enhanced";
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
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { common, createLowlight } from "lowlight";
import Collaboration from "@tiptap/extension-collaboration";
// CollaborationCursor removed — y-prosemirror cursor-plugin crashes when
// awareness.doc is undefined (e.g. Hocuspocus server not running).
// Cursor presence is handled via awareness state in collaborative-editor.tsx.
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { Doc as YDoc } from "yjs";
import { BlockId } from "./extensions/block-id";
import { ToggleBlock, DetailsSummary, DetailsContent } from "./extensions/toggle";
import { Callout } from "./extensions/callout";
import { Equation } from "./extensions/equation";
import { SyncedBlockNode } from "./extensions/synced-block";
import { LinkToPage } from "./extensions/link-to-page";
import { DatabaseBlock } from "./extensions/database-block";
import { TableOfContents } from "./extensions/table-of-contents";
import { ColumnList, Column } from "./extensions/column-list";
import { SlashCommandExtension } from "./extensions/slash-command-ext";
import { MentionNode } from "./extensions/mention-node";
import { MentionExtension } from "./extensions/mention-ext";
import { BlockSelection, BLOCK_SELECTION_KEY } from "./extensions/block-selection";
import { MicroInteractions } from "./extensions/micro-interactions";
import { LinkPreviewExtension, LinkPreviewPopup, useLinkPreview } from "./link-preview-popup";
import { MarkdownPaste } from "./extensions/markdown-paste";
import { ClipboardImage } from "./extensions/clipboard-image";
import { FileDrop } from "./extensions/file-drop";
import { useAiStore } from "@/stores/ai";
import type { MentionItem } from "./mention/mention-list";

const SlashCommand = lazy(() => import("./slash-command/slash-command").then(m => ({ default: m.SlashCommand })));
const MentionList = lazy(() => import("./mention/mention-list").then(m => ({ default: m.MentionList })));
const FindReplace = lazy(() => import("./find-replace").then(m => ({ default: m.FindReplace })));
const InlineToolbar = lazy(() => import("./inline-toolbar").then(m => ({ default: m.InlineToolbar })));
const DragHandle = lazy(() => import("./drag-handle").then(m => ({ default: m.DragHandle })));
const BlockMenu = lazy(() => import("./block-menu").then(m => ({ default: m.BlockMenu })));
const BlockContextMenu = lazy(() => import("./block-context-menu").then(m => ({ default: m.BlockContextMenu })));
const AiPrompt = lazy(() => import("./ai/ai-prompt").then(m => ({ default: m.AiPrompt })));
import { SelectionActionBar } from "./selection-action-bar";
import { EmptyPageGuide } from "./empty-page-guide";
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
  mentionItems?: MentionItem[];
  onTyping?: () => void;
  onAddComment?: (content: string, range: { from: number; to: number }) => void;
  onTurnIntoPage?: (blockText: string, from: number, to: number) => void;
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
  mentionItems = [],
  onTyping,
  onAddComment,
  onTurnIntoPage,
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
      CodeBlockEnhanced.configure({ lowlight }),
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
      SyncedBlockNode,
      LinkToPage,
      DatabaseBlock,
      TableOfContents,
      ColumnList,
      Column,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      BlockId,
      BlockSelection,
      MarkdownPaste,
      ClipboardImage,
      FileDrop,
      SlashCommandExtension,
      MentionNode,
      MentionExtension,
      MicroInteractions,
      LinkPreviewExtension,
      ...(collaboration ? [
        Collaboration.configure({ document: collaboration.ydoc }),
      ] : []),
    ],
    content: collaboration ? undefined : (initialContent || {
      type: "doc",
      content: [{ type: "paragraph" }],
    }),
    editable,
    onUpdate: collaboration ? () => {
      onTyping?.();
    } : ({ editor }) => {
      onUpdate?.(editor.getJSON() as Record<string, unknown>);
    },
    editorProps: {
      attributes: { class: "notion-editor", role: "textbox", "aria-multiline": "true", "aria-label": "페이지 에디터" },
      handleKeyDown(_view, event) {
        // Cmd+Shift+H: toggle highlight
        if (event.key === "h" && (event.metaKey || event.ctrlKey) && event.shiftKey) {
          event.preventDefault();
          editor!.chain().focus().toggleHighlight({ color: "var(--color-yellow-bg)" }).run();
          return true;
        }

        // Tab: indent
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

        // Shift+Tab: outdent
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

        // ESC hierarchy
        if (event.key === "Escape") {
          const blockState = BLOCK_SELECTION_KEY.getState(editor!.state);
          if (blockState && blockState.selectedBlocks.length > 0) {
            editor!.view.dispatch(
              editor!.state.tr.setMeta(BLOCK_SELECTION_KEY, {
                selectedBlocks: [],
                anchorBlock: null,
              })
            );
            return true;
          }
          editor!.commands.blur();
          return true;
        }

        return false;
      },
    },
  });

  useImperativeHandle(ref, () => {
    if (!editor) return { commands: { setContent: () => false } };
    return { commands: { setContent: (content: unknown) => editor.commands.setContent(content as Parameters<typeof editor.commands.setContent>[0]) } };
  }, [editor]);

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

  const linkPreview = useLinkPreview(editor);

  if (!editor) return null;

  return (
    <div className="relative">
      <Suspense fallback={null}>
        <FindReplace editor={editor} />
      </Suspense>
      <SelectionActionBar editor={editor} />
      <EditorContent editor={editor} />
      {editor && <EmptyPageGuide editor={editor} />}
      {editor.view && (
        <Suspense fallback={null}>
          <InlineToolbar editor={editor} onAddComment={onAddComment} />
          <SlashCommand editor={editor} />
          <MentionList editor={editor} items={mentionItems} />
          <BlockContextMenu editor={editor} onTurnIntoPage={onTurnIntoPage} onAddComment={onAddComment} />
          <DragHandle editor={editor} onMenuOpen={(pos) => {
            if (!editor.view) return;
            const coords = editor.view.coordsAtPos(pos);
            setMenuState({ pos, coords: { top: coords.top, left: coords.left - 4 } });
          }} />
        </Suspense>
      )}
      {menuState && (
        <Suspense fallback={null}>
          <BlockMenu editor={editor} pos={menuState.pos} coords={menuState.coords} onClose={() => setMenuState(null)} onTurnIntoPage={onTurnIntoPage} />
        </Suspense>
      )}
      {aiStore.isOpen && aiStore.position && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}
      {linkPreview.preview && (
        <LinkPreviewPopup
          data={linkPreview.preview.data}
          coords={linkPreview.preview.coords}
          onClose={linkPreview.handleClose}
          onOpen={linkPreview.handleOpen}
          onCopyLink={linkPreview.handleCopyLink}
          onRemoveLink={linkPreview.handleRemoveLink}
        />
      )}
    </div>
  );
});
