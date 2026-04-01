"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { useAiStore } from "@/stores/ai";
import { Trash2, Copy, Type, Heading1, Heading2, List, ListOrdered, ListChecks, Sparkles, FileText, Quote, Code, Palette, Link as LinkIcon, Indent, Outdent } from "lucide-react";

type BlockMenuProps = { editor: Editor; pos: number; coords: { top: number; left: number }; onClose: () => void; onTurnIntoPage?: (blockText: string, from: number, to: number) => void };

export function BlockMenu({ editor, pos, coords, onClose, onTurnIntoPage }: BlockMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const aiStore = useAiStore();
  const [showColors, setShowColors] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const actions: { label: string; icon: ReactNode; action: () => void }[] = [
    { label: "삭제", icon: <Trash2 size={14} />, action: () => { const node = editor.state.doc.nodeAt(pos); if (node) editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run(); onClose(); } },
    { label: "복제", icon: <Copy size={14} />, action: () => { const node = editor.state.doc.nodeAt(pos); if (node) editor.chain().focus().insertContentAt(pos + node.nodeSize, node.toJSON()).run(); onClose(); } },
    { label: "텍스트로 변환", icon: <Type size={14} />, action: () => { editor.chain().focus().setTextSelection(pos + 1).setNode("paragraph").run(); onClose(); } },
    { label: "제목 1로 변환", icon: <Heading1 size={14} />, action: () => { editor.chain().focus().setTextSelection(pos + 1).toggleHeading({ level: 1 }).run(); onClose(); } },
    { label: "제목 2로 변환", icon: <Heading2 size={14} />, action: () => { editor.chain().focus().setTextSelection(pos + 1).toggleHeading({ level: 2 }).run(); onClose(); } },
    { label: "글머리 기호 목록", icon: <List size={14} />, action: () => { editor.chain().focus().setTextSelection(pos + 1).toggleBulletList().run(); onClose(); } },
    { label: "번호 목록", icon: <ListOrdered size={14} />, action: () => { editor.chain().focus().setTextSelection(pos + 1).toggleOrderedList().run(); onClose(); } },
    { label: "할 일", icon: <ListChecks size={14} />, action: () => { editor.chain().focus().setTextSelection(pos + 1).toggleTaskList().run(); onClose(); } },
    { label: "인용으로 변환", icon: <Quote size={14} />, action: () => { editor.chain().focus().setTextSelection(pos + 1).toggleBlockquote().run(); onClose(); } },
    { label: "코드로 변환", icon: <Code size={14} />, action: () => { editor.chain().focus().setTextSelection(pos + 1).toggleCodeBlock().run(); onClose(); } },
    { label: "들여쓰기", icon: <Indent size={14} />, action: () => {
      editor.chain().focus().setTextSelection(pos + 1).run();
      const sunkList = editor.chain().focus().sinkListItem("listItem").run();
      if (!sunkList) editor.chain().focus().sinkListItem("taskItem").run();
      onClose();
    } },
    { label: "내어쓰기", icon: <Outdent size={14} />, action: () => {
      editor.chain().focus().setTextSelection(pos + 1).run();
      const liftedList = editor.chain().focus().liftListItem("listItem").run();
      if (!liftedList) editor.chain().focus().liftListItem("taskItem").run();
      onClose();
    } },
    { label: "색상", icon: <Palette size={14} />, action: () => setShowColors(prev => !prev) },
    { label: "블록 링크 복사", icon: <LinkIcon size={14} />, action: () => {
      const node = editor.state.doc.nodeAt(pos);
      const blockId = node?.attrs?.blockId;
      const url = blockId ? `${window.location.href}#block-${blockId}` : window.location.href;
      navigator.clipboard.writeText(url).catch(() => {});
      onClose();
    } },
    { label: "페이지로 변환", icon: <FileText size={14} />, action: () => {
      const node = editor.state.doc.nodeAt(pos);
      if (!node) return;
      const blockText = node.textContent;
      if (onTurnIntoPage) onTurnIntoPage(blockText, pos, pos + node.nodeSize);
      onClose();
    } },
    { label: "AI에게 요청", icon: <Sparkles size={14} />, action: () => {
      const node = editor.state.doc.nodeAt(pos);
      const blockText = node ? node.textContent : "";
      aiStore.open(blockText, { top: coords.top, left: coords.left + 270 });
      onClose();
    } },
  ];

  return (
    <div ref={menuRef} className="fixed rounded-lg overflow-hidden py-1 dropdown-enter" style={{
      top: `${coords.top}px`, left: `${coords.left}px`,
      zIndex: "var(--z-dropdown)", backgroundColor: "var(--bg-primary)",
      boxShadow: "var(--shadow-popup)", width: "260px", maxHeight: "400px", overflowY: "auto",
    }}>
      {actions.map((a) => (
        <button key={a.label} className="w-full flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-notion-bg-hover text-left"
          style={{ color: "var(--text-primary)" }} onClick={a.action}>
          <span className="w-5 flex items-center justify-center" style={{ color: "var(--text-secondary)" }}>{a.icon}</span>
          {a.label}
        </button>
      ))}
      {showColors && (
        <div className="border-t px-2 py-2" style={{ borderColor: "var(--border-divider)" }}>
          <div className="text-[11px] mb-1.5" style={{ color: "var(--text-tertiary)", fontWeight: 500 }}>
            텍스트 색상
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {[
              { name: "기본", css: "var(--text-primary)", value: "default" },
              { name: "회색", css: "var(--color-gray)", value: "gray" },
              { name: "갈색", css: "var(--color-brown)", value: "brown" },
              { name: "주황", css: "var(--color-orange)", value: "orange" },
              { name: "파랑", css: "var(--color-blue)", value: "blue" },
              { name: "빨강", css: "var(--color-red)", value: "red" },
            ].map((c) => (
              <button key={c.value} className="w-5 h-5 rounded flex items-center justify-center text-xs hover:ring-2 ring-[#2383e2]"
                style={{ color: c.css }} title={c.name}
                onClick={() => {
                  const node = editor.state.doc.nodeAt(pos);
                  if (!node) return;
                  editor.chain().focus().setTextSelection({ from: pos + 1, to: pos + node.nodeSize - 1 })
                    [c.value === "default" ? "unsetColor" : "setColor"](c.value === "default" ? undefined as any : c.css).run();
                  onClose();
                }}
              >A</button>
            ))}
          </div>
          <div className="text-[11px] mb-1.5" style={{ color: "var(--text-tertiary)", fontWeight: 500 }}>
            배경 색상
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              { name: "기본", css: "transparent", value: "default" },
              { name: "회색", css: "var(--color-gray-bg)", value: "gray" },
              { name: "노랑", css: "var(--color-yellow-bg)", value: "yellow" },
              { name: "초록", css: "var(--color-green-bg)", value: "green" },
              { name: "파랑", css: "var(--color-blue-bg)", value: "blue" },
              { name: "빨강", css: "var(--color-red-bg)", value: "red" },
            ].map((c) => (
              <button key={c.value} className="w-5 h-5 rounded border hover:ring-2 ring-[#2383e2]"
                style={{ backgroundColor: c.css, borderColor: "var(--border-default)" }} title={c.name}
                onClick={() => {
                  const node = editor.state.doc.nodeAt(pos);
                  if (!node) return;
                  editor.chain().focus().setTextSelection({ from: pos + 1, to: pos + node.nodeSize - 1 })
                    [c.value === "default" ? "unsetHighlight" : "setHighlight"](c.value === "default" ? undefined as any : { color: c.css }).run();
                  onClose();
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
