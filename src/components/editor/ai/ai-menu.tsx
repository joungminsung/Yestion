"use client";

import { useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { useAiStore } from "@/stores/ai";

type AiMenuItem = {
  label: string;
  action: string;
  icon: string;
};

const AI_MENU_ITEMS: AiMenuItem[] = [
  { label: "요약", action: "summarize", icon: "📝" },
  { label: "계속 쓰기", action: "continue", icon: "✏️" },
  { label: "길게 만들기", action: "makeLonger", icon: "📏" },
  { label: "짧게 만들기", action: "makeShorter", icon: "✂️" },
  { label: "문법 수정", action: "fixGrammar", icon: "✅" },
  { label: "번역 (한→영)", action: "translate_en", icon: "🌐" },
  { label: "번역 (영→한)", action: "translate_ko", icon: "🇰🇷" },
  { label: "전문적인 톤으로", action: "changeTone_professional", icon: "👔" },
  { label: "친근한 톤으로", action: "changeTone_casual", icon: "😊" },
  { label: "핵심 포인트 추출", action: "extractPoints", icon: "🎯" },
  { label: "할 일 목록으로 변환", action: "makeTodos", icon: "☑️" },
];

type Props = {
  editor: Editor;
  position: { top: number; left: number };
  onClose: () => void;
};

export function AiMenu({ editor, position, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const aiStore = useAiStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleAction = (action: string) => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");

    if (!selectedText) {
      onClose();
      return;
    }

    const coords = editor.view.coordsAtPos(from);
    aiStore.open(selectedText, { top: coords.top + 30, left: coords.left });
    onClose();

    // Trigger AI request immediately via custom event
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("ai-action", { detail: { action, context: selectedText } })
      );
    }, 50);
  };

  return (
    <div
      ref={menuRef}
      className="fixed rounded-lg overflow-hidden py-1"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: "var(--z-dropdown)",
        backgroundColor: "var(--bg-primary)",
        boxShadow: "var(--shadow-popup)",
        width: "220px",
        maxHeight: "400px",
        overflowY: "auto",
      }}
    >
      <div
        className="px-3 py-1.5"
        style={{
          fontSize: "11px",
          color: "var(--text-tertiary)",
          fontWeight: 500,
        }}
      >
        AI 작업
      </div>
      {AI_MENU_ITEMS.map((item) => (
        <button
          key={item.action}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-notion-bg-hover text-left transition-colors"
          style={{ color: "var(--text-primary)" }}
          onClick={() => handleAction(item.action)}
        >
          <span className="w-5 text-center" style={{ fontSize: "13px" }}>
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
