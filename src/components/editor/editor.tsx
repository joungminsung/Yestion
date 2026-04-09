"use client";

import { useState, useEffect, forwardRef, useImperativeHandle, lazy, Suspense } from "react";
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
import { SuggestionMark } from "./extensions/suggestion-mark";
import { CommentMark } from "./extensions/comment-mark";
import { LinkToPage } from "./extensions/link-to-page";
import { DatabaseBlock } from "./extensions/database-block";
import { LinkedDatabaseBlock } from "./extensions/linked-database-block";
import { TableOfContents } from "./extensions/table-of-contents";
import { ColumnList, Column } from "./extensions/column-list";
import { SlashCommandExtension } from "./extensions/slash-command-ext";
import { MentionNode } from "./extensions/mention-node";
import { MentionExtension } from "./extensions/mention-ext";
import { BlockSelection, BLOCK_SELECTION_KEY } from "./extensions/block-selection";
import { MicroInteractions } from "./extensions/micro-interactions";
import { FocusMode } from "./extensions/focus-mode";
import { ToggleHeading } from "./extensions/toggle-heading";
import { LinkPreviewExtension, LinkPreviewPopup, useLinkPreview } from "./link-preview-popup";
import { MarkdownPaste } from "./extensions/markdown-paste";
import { ClipboardImage } from "./extensions/clipboard-image";
import { FileDrop } from "./extensions/file-drop";
import { TouchDragHandle } from "./extensions/touch-drag-handle";
import { useAiStore } from "@/stores/ai";
import type { MentionItem } from "./mention/mention-list";
import { useDevice } from "@/components/providers/responsive-provider";

const MobileToolbar = lazy(() => import("./mobile-toolbar").then(m => ({ default: m.MobileToolbar })));
const SlashCommand = lazy(() => import("./slash-command/slash-command").then(m => ({ default: m.SlashCommand })));
const MentionList = lazy(() => import("./mention/mention-list").then(m => ({ default: m.MentionList })));
const FindReplace = lazy(() => import("./find-replace").then(m => ({ default: m.FindReplace })));
const InlineToolbar = lazy(() => import("./inline-toolbar").then(m => ({ default: m.InlineToolbar })));
const DragHandle = lazy(() => import("./drag-handle").then(m => ({ default: m.DragHandle })));
const BlockMenu = lazy(() => import("./block-menu").then(m => ({ default: m.BlockMenu })));
const BlockContextMenu = lazy(() => import("./block-context-menu").then(m => ({ default: m.BlockContextMenu })));
const AiDraftInline = lazy(() => import("./ai/ai-draft-inline").then(m => ({ default: m.AiDraftInline })));
const TableControls = lazy(() => import("./media/table-controls").then(m => ({ default: m.TableControls })));
const CommentPopover = lazy(() => import("./comment-popover").then(m => ({ default: m.CommentPopover })));
const SuggestionPanel = lazy(() => import("./suggestion-panel").then(m => ({ default: m.SuggestionPanel })));
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
  pageId?: string;
  currentUser?: { id: string; name: string };
  initialContent?: Record<string, unknown>;
  onUpdate?: (json: Record<string, unknown>) => void;
  editable?: boolean;
  collaboration?: CollaborationConfig;
  mentionItems?: MentionItem[];
  onTyping?: () => void;
  onTurnIntoPage?: (blockText: string, from: number, to: number) => void;
};

type SetContentCommandOptions = {
  emitUpdate?: boolean;
};

export type NotionEditorHandle = {
  commands: {
    setContent: (content: unknown, options?: SetContentCommandOptions) => boolean;
  };
};

export const NotionEditor = forwardRef<
  NotionEditorHandle,
  NotionEditorProps
>(function NotionEditor({
  pageId,
  currentUser,
  initialContent,
  onUpdate,
  editable = true,
  collaboration,
  mentionItems = [],
  onTyping,
  onTurnIntoPage,
}, ref) {
  const [menuState, setMenuState] = useState<{pos: number; coords: {top: number; left: number}} | null>(null);
  const [showSuggestionPanel, setShowSuggestionPanel] = useState(false);
  const [suggestionModeEnabled, setSuggestionModeEnabled] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [activeCommentPopover, setActiveCommentPopover] = useState<{
    commentId: string | null;
    position: { top: number; left: number };
    textRange: { from: number; to: number } | null;
  } | null>(null);
  const aiStore = useAiStore();
  const { isMobile } = useDevice();
  const effectiveUser = currentUser ?? collaboration?.user;

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
      ToggleHeading,
      Equation,
      SyncedBlockNode,
      SuggestionMark.configure({
        currentUser: effectiveUser
          ? { id: effectiveUser.id, name: effectiveUser.name }
          : undefined,
      }),
      CommentMark,
      LinkToPage,
      DatabaseBlock,
      LinkedDatabaseBlock,
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
      FocusMode,
      LinkPreviewExtension,
      ...(typeof window !== "undefined" && "ontouchstart" in window ? [TouchDragHandle] : []),
      ...(collaboration ? [
        Collaboration.configure({ document: collaboration.ydoc }),
      ] : []),
    ],
    content: collaboration ? undefined : (initialContent || {
      type: "doc",
      content: [{ type: "paragraph" }],
    }),
    editable,
    onUpdate: ({ editor, transaction }) => {
      if (!transaction.docChanged) {
        return;
      }

      if (collaboration) {
        onTyping?.();

        // Ignore remote Yjs sync transactions and only mirror local edits to block storage.
        if (transaction.getMeta("y-sync$")) {
          return;
        }
      }

      onUpdate?.(editor.getJSON() as Record<string, unknown>);
    },
    editorProps: {
      attributes: { class: "notion-editor", role: "textbox", "aria-multiline": "true", "aria-label": "페이지 에디터" },
      handleClick(_view, _pos, event) {
        const target = event.target as HTMLElement | null;
        const commentElement = target?.closest?.("[data-comment-id]") as HTMLElement | null;
        const commentId = commentElement?.dataset.commentId;

        if (commentId && pageId && effectiveUser) {
          setActiveCommentPopover({
            commentId,
            position: { top: event.clientY + 12, left: event.clientX + 12 },
            textRange: null,
          });
          return true;
        }

        return false;
      },
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
    return {
      commands: {
        setContent: (content: unknown, options?: SetContentCommandOptions) =>
          editor.commands.setContent(
            content as Parameters<typeof editor.commands.setContent>[0],
            options as Parameters<typeof editor.commands.setContent>[1],
          ),
      },
    };
  }, [editor]);

  useEffect(() => {
    const handleAiOpen = (e: Event) => {
      const { context, position } = (e as CustomEvent).detail;
      aiStore.open(context || "", position);
    };
    window.addEventListener("ai-open", handleAiOpen);
    return () => window.removeEventListener("ai-open", handleAiOpen);
  }, [aiStore]);

  const linkPreview = useLinkPreview(editor);

  useEffect(() => {
    if (!editor) return;

    const countSuggestions = () => {
      let count = 0;
      editor.state.doc.descendants((node) => {
        if (node.marks.some((mark) => mark.type.name === "suggestion")) {
          count += 1;
        }
      });
      setSuggestionCount(count);
      setSuggestionModeEnabled(
        Boolean((editor.storage as { suggestion?: { enabled?: boolean } }).suggestion?.enabled)
      );
    };

    countSuggestions();
    editor.on("update", countSuggestions);
    editor.on("selectionUpdate", countSuggestions);
    return () => {
      editor.off("update", countSuggestions);
      editor.off("selectionUpdate", countSuggestions);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="relative">
      <Suspense fallback={null}>
        <FindReplace editor={editor} />
      </Suspense>
      <SelectionActionBar editor={editor} />
      <EditorContent editor={editor} />
      {editor.isActive("table") && (
        <Suspense fallback={null}>
          <TableControls editor={editor} />
        </Suspense>
      )}
      {editor && <EmptyPageGuide editor={editor} />}
      {!isMobile && editor.view && (
        <Suspense fallback={null}>
          <InlineToolbar
            editor={editor}
            onRequestComment={(range, popupPosition) => {
              if (!pageId || !effectiveUser) return;
              setActiveCommentPopover({
                commentId: null,
                position: popupPosition,
                textRange: range,
              });
            }}
            onSuggestionModeChange={setSuggestionModeEnabled}
          />
          <DragHandle editor={editor} onMenuOpen={(pos) => {
            if (!editor.view) return;
            const coords = editor.view.coordsAtPos(pos);
            setMenuState({ pos, coords: { top: coords.top, left: coords.left - 4 } });
          }} />
        </Suspense>
      )}
      {editor.view && (
        <Suspense fallback={null}>
          <SlashCommand editor={editor} />
          <MentionList editor={editor} items={mentionItems} />
          <BlockContextMenu
            editor={editor}
            onTurnIntoPage={onTurnIntoPage}
            onAddComment={(_content, range) => {
              if (!pageId || !effectiveUser || !editor.view) return;
              const coords = editor.view.coordsAtPos(range.to);
              setActiveCommentPopover({
                commentId: null,
                position: { top: coords.bottom + 8, left: coords.left },
                textRange: range,
              });
            }}
          />
        </Suspense>
      )}
      {isMobile && editor && (
        <Suspense fallback={null}>
          <MobileToolbar editor={editor} />
        </Suspense>
      )}
      {menuState && (
        <Suspense fallback={null}>
          <BlockMenu editor={editor} pos={menuState.pos} coords={menuState.coords} onClose={() => setMenuState(null)} onTurnIntoPage={onTurnIntoPage} />
        </Suspense>
      )}
      {aiStore.isOpen && editor && (
        <Suspense fallback={null}>
          <AiDraftInline
            editor={editor}
            context={aiStore.context || undefined}
            insertPos={editor.state.selection.to}
            onDone={aiStore.close}
          />
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
      {(showSuggestionPanel || suggestionModeEnabled || suggestionCount > 0) && (
        <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2">
          <button
            onClick={() => setShowSuggestionPanel((prev) => !prev)}
            className="rounded-full px-3 py-2 text-xs font-medium"
            style={{
              backgroundColor: suggestionModeEnabled ? "#2383e2" : "var(--bg-primary)",
              color: suggestionModeEnabled ? "white" : "var(--text-primary)",
              boxShadow: "var(--shadow-popup)",
              border: suggestionModeEnabled ? "none" : "1px solid var(--border-default)",
            }}
          >
            {suggestionModeEnabled
              ? `Suggesting on${suggestionCount > 0 ? ` · ${suggestionCount}` : ""}`
              : `Review suggestions${suggestionCount > 0 ? ` · ${suggestionCount}` : ""}`}
          </button>
        </div>
      )}
      {showSuggestionPanel && (
        <Suspense fallback={null}>
          <SuggestionPanel editor={editor} onClose={() => setShowSuggestionPanel(false)} />
        </Suspense>
      )}
      {activeCommentPopover && pageId && effectiveUser && (
        <Suspense fallback={null}>
          <CommentPopover
            pageId={pageId}
            commentId={activeCommentPopover.commentId}
            currentUserId={effectiveUser.id}
            editor={editor}
            position={activeCommentPopover.position}
            textRange={activeCommentPopover.textRange}
            onClose={() => setActiveCommentPopover(null)}
          />
        </Suspense>
      )}
    </div>
  );
});
