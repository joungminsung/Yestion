"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { useAiStore } from "@/stores/ai";
import {
  Trash2,
  Copy,
  Scissors,
  Clipboard,
  ClipboardPaste,
  Link,
  Palette,
  List,
  ListChecks,
  Quote,
  FileText,
  MessageSquare,
  Sparkles,
  MoveUp,
  MoveDown,
  ChevronRight,
  Heading1,
  Heading2,
} from "lucide-react";

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

type ContextMenuProps = {
  editor: Editor;
  onTurnIntoPage?: (blockText: string, from: number, to: number) => void;
  onAddComment?: (content: string, range: { from: number; to: number }) => void;
};

type MenuItem = {
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  divider?: boolean;
  submenu?: boolean;
};

export function BlockContextMenu({ editor, onTurnIntoPage, onAddComment }: ContextMenuProps) {
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [showColorSubmenu, setShowColorSubmenu] = useState(false);
  const aiStore = useAiStore();

  const handleContextMenu = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      setPosition({ top: event.clientY, left: event.clientX });
      setShowColorSubmenu(false);

      // Resolve the block at mouse position and select it if no existing selection
      try {
        const pos = editor.view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        if (pos) {
          const { from, to } = editor.state.selection;
          // Only set cursor if nothing is selected
          if (from === to) {
            editor.chain().focus().setTextSelection(pos.pos).run();
          }
        }
      } catch {
        // ignore
      }
    },
    [editor]
  );

  useEffect(() => {
    if (!editor.view) return;
    const dom = editor.view.dom;
    dom.addEventListener("contextmenu", handleContextMenu);
    return () => dom.removeEventListener("contextmenu", handleContextMenu);
  }, [editor, handleContextMenu]);

  // Close on click outside or ESC
  useEffect(() => {
    if (!position) return;
    const handleClose = () => setPosition(null);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPosition(null);
    };
    document.addEventListener("mousedown", handleClose);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [position]);

  if (!position) return null;

  const items: MenuItem[] = [
    {
      label: "삭제",
      icon: <Trash2 size={14} />,
      shortcut: "Del",
      action: () => {
        editor.chain().focus().deleteSelection().run();
        setPosition(null);
      },
    },
    {
      label: "복제",
      icon: <Copy size={14} />,
      shortcut: "\u2318D",
      action: () => {
        const { from, to } = editor.state.selection;
        const slice = editor.state.doc.slice(from, to);
        editor
          .chain()
          .focus()
          .insertContentAt(to, slice.content.toJSON())
          .run();
        setPosition(null);
      },
    },
    {
      label: "잘라내기",
      icon: <Scissors size={14} />,
      shortcut: "\u2318X",
      action: () => {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to);
        navigator.clipboard.writeText(text).catch(() => {});
        editor.chain().focus().deleteSelection().run();
        setPosition(null);
      },
    },
    {
      label: "복사",
      icon: <Clipboard size={14} />,
      shortcut: "\u2318C",
      action: () => {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to);
        navigator.clipboard.writeText(text).catch(() => {});
        setPosition(null);
      },
    },
    {
      label: "붙여넣기",
      icon: <ClipboardPaste size={14} />,
      shortcut: "\u2318V",
      action: () => {
        navigator.clipboard.readText().then((text) => {
          if (text) editor.chain().focus().insertContent(text).run();
        }).catch(() => {});
        setPosition(null);
      },
    },
    {
      label: "링크 복사",
      icon: <Link size={14} />,
      action: () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).catch(() => {});
        setPosition(null);
      },
    },
    { label: "", icon: "", action: () => {}, divider: true },
    {
      label: "색상",
      icon: <Palette size={14} />,
      action: () => {
        setShowColorSubmenu((prev) => !prev);
      },
      submenu: true,
    },
    { label: "", icon: "", action: () => {}, divider: true },
    {
      label: "텍스트로 변환",
      icon: "Aa",
      action: () => {
        editor.chain().focus().setParagraph().run();
        setPosition(null);
      },
    },
    {
      label: "제목 1로 변환",
      icon: <Heading1 size={14} />,
      action: () => {
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        setPosition(null);
      },
    },
    {
      label: "제목 2로 변환",
      icon: <Heading2 size={14} />,
      action: () => {
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        setPosition(null);
      },
    },
    {
      label: "글머리 기호",
      icon: <List size={14} />,
      action: () => {
        editor.chain().focus().toggleBulletList().run();
        setPosition(null);
      },
    },
    {
      label: "번호 목록",
      icon: "1.",
      action: () => {
        editor.chain().focus().toggleOrderedList().run();
        setPosition(null);
      },
    },
    {
      label: "할 일",
      icon: <ListChecks size={14} />,
      action: () => {
        editor.chain().focus().toggleTaskList().run();
        setPosition(null);
      },
    },
    {
      label: "인용으로 변환",
      icon: <Quote size={14} />,
      action: () => {
        editor.chain().focus().toggleBlockquote().run();
        setPosition(null);
      },
    },
    {
      label: "코드로 변환",
      icon: "<>",
      action: () => {
        editor.chain().focus().toggleCodeBlock().run();
        setPosition(null);
      },
    },
    { label: "", icon: "", action: () => {}, divider: true },
    {
      label: "페이지로 변환",
      icon: <FileText size={14} />,
      action: () => {
        if (!onTurnIntoPage) { setPosition(null); return; }
        const { from } = editor.state.selection;
        const $from = editor.state.doc.resolve(from);
        const blockStart = $from.before(1);
        const node = editor.state.doc.nodeAt(blockStart);
        if (node) {
          onTurnIntoPage(node.textContent, blockStart, blockStart + node.nodeSize);
        }
        setPosition(null);
      },
    },
    {
      label: "댓글 추가",
      icon: <MessageSquare size={14} />,
      action: () => {
        const { from, to } = editor.state.selection;
        if (onAddComment && from !== to) {
          editor.state.doc.textBetween(from, to); // get selected text for context
          const comment = window.prompt("댓글 작성:");
          if (comment) {
            onAddComment(comment, { from, to });
          }
        }
        setPosition(null);
      },
    },
    {
      label: "AI에게 요청",
      icon: <Sparkles size={14} />,
      action: () => {
        const { from } = editor.state.selection;
        const $from = editor.state.doc.resolve(from);
        const blockStart = $from.before(1);
        const node = editor.state.doc.nodeAt(blockStart);
        const blockText = node ? node.textContent : "";
        aiStore.open(blockText, { top: position.top, left: position.left + 220 });
        setPosition(null);
      },
    },
    { label: "", icon: "", action: () => {}, divider: true },
    {
      label: "위로 이동",
      icon: <MoveUp size={14} />,
      shortcut: "\u2318\u21E7\u2191",
      action: () => {
        try {
          const { from } = editor.state.selection;
          const $from = editor.state.doc.resolve(from);
          const blockPos = $from.before(1);
          if (blockPos > 0) {
            const $block = editor.state.doc.resolve(blockPos);
            const prevBlockPos = $block.before(1);
            if (prevBlockPos >= 0) {
              const node = editor.state.doc.nodeAt(blockPos);
              if (node) {
                const tr = editor.state.tr;
                tr.delete(blockPos, blockPos + node.nodeSize);
                tr.insert(prevBlockPos, node);
                editor.view.dispatch(tr);
              }
            }
          }
        } catch {
          // ignore
        }
        setPosition(null);
      },
    },
    {
      label: "아래로 이동",
      icon: <MoveDown size={14} />,
      shortcut: "\u2318\u21E7\u2193",
      action: () => {
        try {
          const { from } = editor.state.selection;
          const $from = editor.state.doc.resolve(from);
          const blockPos = $from.before(1);
          const node = editor.state.doc.nodeAt(blockPos);
          if (node) {
            const afterBlock = blockPos + node.nodeSize;
            const nextNode = editor.state.doc.nodeAt(afterBlock);
            if (nextNode) {
              const tr = editor.state.tr;
              tr.delete(blockPos, blockPos + node.nodeSize);
              const newPos = blockPos + nextNode.nodeSize;
              tr.insert(
                Math.min(newPos, tr.doc.content.size),
                node
              );
              editor.view.dispatch(tr);
            }
          }
        } catch {
          // ignore
        }
        setPosition(null);
      },
    },
  ];

  // Viewport boundary check
  let menuTop = position.top;
  let menuLeft = position.left;
  const menuHeight = items.length * 32;
  if (menuTop + menuHeight > window.innerHeight - 20)
    menuTop = window.innerHeight - menuHeight - 20;
  if (menuLeft + 220 > window.innerWidth - 20)
    menuLeft = window.innerWidth - 220 - 20;

  return (
    <div
      className="fixed rounded-lg overflow-visible py-1 dropdown-enter"
      style={{
        top: menuTop,
        left: menuLeft,
        zIndex: "var(--z-dropdown)",
        backgroundColor: "var(--bg-primary)",
        boxShadow: "var(--shadow-popup)",
        width: "220px",
        maxHeight: "80vh",
        overflowY: "auto",
      }}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div
            key={i}
            className="mx-2 my-1"
            style={{
              height: "1px",
              backgroundColor: "var(--border-divider)",
            }}
          />
        ) : (
          <button
            key={`${item.label}-${i}`}
            className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-notion-bg-hover text-left"
            style={{ color: "var(--text-primary)" }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={item.action}
          >
            <span className="flex items-center gap-2">
              <span className="w-5 text-center" style={{ fontSize: "13px" }}>
                {item.icon}
              </span>
              {item.label}
            </span>
            {item.shortcut && (
              <span
                className="text-xs"
                style={{ color: "var(--text-tertiary)" }}
              >
                {item.shortcut}
              </span>
            )}
            {item.submenu && (
              <span
                className="text-xs"
                style={{ color: "var(--text-tertiary)" }}
              >
                <ChevronRight size={12} />
              </span>
            )}
          </button>
        )
      )}
      {showColorSubmenu && (
        <div
          className="absolute rounded-lg py-2 px-2"
          style={{
            top: 0,
            left: "100%",
            marginLeft: 4,
            backgroundColor: "var(--bg-primary)",
            boxShadow: "var(--shadow-popup)",
            width: "220px",
            zIndex: 1,
          }}
          onMouseDown={(e) => e.stopPropagation()}
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
                  setPosition(null);
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
                  setPosition(null);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
