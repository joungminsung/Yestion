"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { useAiStore } from "@/stores/ai";
import { Trash2, Copy, Type, Heading1, Heading2, List, ListOrdered, ListChecks, Sparkles } from "lucide-react";

type BlockMenuProps = { editor: Editor; pos: number; coords: { top: number; left: number }; onClose: () => void };

export function BlockMenu({ editor, pos, coords, onClose }: BlockMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const aiStore = useAiStore();

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
    </div>
  );
}
