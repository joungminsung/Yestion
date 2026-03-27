"use client";

import { useEffect, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";

type ContextMenuProps = { editor: Editor };

type MenuItem = {
  label: string;
  icon: string;
  shortcut?: string;
  action: () => void;
  divider?: boolean;
};

export function BlockContextMenu({ editor }: ContextMenuProps) {
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const handleContextMenu = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      setPosition({ top: event.clientY, left: event.clientX });

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
      icon: "\u{1F5D1}",
      shortcut: "Del",
      action: () => {
        editor.chain().focus().deleteSelection().run();
        setPosition(null);
      },
    },
    {
      label: "복제",
      icon: "\u{1F4CB}",
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
      icon: "\u2702\uFE0F",
      shortcut: "\u2318X",
      action: () => {
        document.execCommand("cut");
        setPosition(null);
      },
    },
    {
      label: "복사",
      icon: "\u{1F4C4}",
      shortcut: "\u2318C",
      action: () => {
        document.execCommand("copy");
        setPosition(null);
      },
    },
    {
      label: "붙여넣기",
      icon: "\u{1F4CB}",
      shortcut: "\u2318V",
      action: () => {
        document.execCommand("paste");
        setPosition(null);
      },
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
      icon: "H1",
      action: () => {
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        setPosition(null);
      },
    },
    {
      label: "제목 2로 변환",
      icon: "H2",
      action: () => {
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        setPosition(null);
      },
    },
    {
      label: "글머리 기호",
      icon: "\u2022",
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
      icon: "\u2611",
      action: () => {
        editor.chain().focus().toggleTaskList().run();
        setPosition(null);
      },
    },
    { label: "", icon: "", action: () => {}, divider: true },
    {
      label: "위로 이동",
      icon: "\u2191",
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
      icon: "\u2193",
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
      className="fixed rounded-lg overflow-hidden py-1 dropdown-enter"
      style={{
        top: menuTop,
        left: menuLeft,
        zIndex: "var(--z-dropdown)",
        backgroundColor: "var(--bg-primary)",
        boxShadow: "var(--shadow-popup)",
        width: "220px",
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
            key={item.label}
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
          </button>
        )
      )}
    </div>
  );
}
