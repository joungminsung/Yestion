"use client";

import { useRef, useEffect, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { useAiStore } from "@/stores/ai";
import {
  Sparkles,
  FileText, Pencil, Ruler, Scissors, CheckCircle,
  Globe, Languages, Briefcase, SmilePlus, Target, ListChecks,
} from "lucide-react";

type AiMenuItem = {
  label: string;
  action: string;
  icon: ReactNode;
};

const AI_MENU_ITEMS: AiMenuItem[] = [
  { label: "요약", action: "summarize", icon: <FileText size={14} /> },
  { label: "계속 쓰기", action: "continue", icon: <Pencil size={14} /> },
  { label: "길게 만들기", action: "makeLonger", icon: <Ruler size={14} /> },
  { label: "짧게 만들기", action: "makeShorter", icon: <Scissors size={14} /> },
  { label: "문법 수정", action: "fixGrammar", icon: <CheckCircle size={14} /> },
  { label: "번역 (한→영)", action: "translate_en", icon: <Globe size={14} /> },
  { label: "번역 (영→한)", action: "translate_ko", icon: <Languages size={14} /> },
  { label: "전문적인 톤으로", action: "changeTone_professional", icon: <Briefcase size={14} /> },
  { label: "친근한 톤으로", action: "changeTone_casual", icon: <SmilePlus size={14} /> },
  { label: "핵심 포인트 추출", action: "extractPoints", icon: <Target size={14} /> },
  { label: "할 일 목록으로 변환", action: "makeTodos", icon: <ListChecks size={14} /> },
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

    // Open the inline AI draft with context + auto-trigger action
    aiStore.open(selectedText, { top: 0, left: 0 });
    onClose();

    // Dispatch action event for AiDraftInline to auto-start
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("ai-action", { detail: { action, context: selectedText } })
      );
    }, 50);
  };

  return (
    <div
      ref={menuRef}
      className="fixed overflow-hidden rounded-xl border py-1"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: "var(--z-dropdown)",
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
        boxShadow: "0 14px 28px rgba(15, 23, 42, 0.10)",
        width: "232px",
        maxHeight: "400px",
        overflowY: "auto",
      }}
    >
      <div
        className="border-b px-3 py-2"
        style={{
          borderColor: "var(--border-default)",
          backgroundColor: "var(--bg-primary)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md border"
            style={{
              borderColor: "var(--border-default)",
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-secondary)",
            }}
          >
            <Sparkles size={13} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              AI 편집
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              선택한 문장을 바로 다듬습니다
            </p>
          </div>
        </div>
      </div>
      {AI_MENU_ITEMS.map((item) => (
        <button
          key={item.action}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-notion-bg-hover"
          style={{ color: "var(--text-primary)" }}
          onClick={() => handleAction(item.action)}
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-md border"
            style={{
              color: "var(--text-secondary)",
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border-default)",
            }}
          >
            {item.icon}
          </span>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
