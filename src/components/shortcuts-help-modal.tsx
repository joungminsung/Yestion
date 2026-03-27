"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

const SHORTCUT_CATEGORIES = [
  {
    name: "텍스트 서식",
    shortcuts: [
      { keys: "⌘ + B", description: "볼드" },
      { keys: "⌘ + I", description: "이탤릭" },
      { keys: "⌘ + U", description: "밑줄" },
      { keys: "⌘ + Shift + S", description: "취소선" },
      { keys: "⌘ + E", description: "인라인 코드" },
      { keys: "⌘ + K", description: "링크 추가" },
      { keys: "⌘ + Shift + K", description: "링크 제거" },
      { keys: "⌘ + Shift + H", description: "하이라이트" },
    ],
  },
  {
    name: "블록 조작",
    shortcuts: [
      { keys: "Tab", description: "들여쓰기" },
      { keys: "Shift + Tab", description: "내어쓰기" },
      { keys: "⌘ + Shift + ↑", description: "블록 위로 이동" },
      { keys: "⌘ + Shift + ↓", description: "블록 아래로 이동" },
      { keys: "⌘ + D", description: "블록 복제" },
      { keys: "⌘ + Enter", description: "아래에 블록 삽입" },
      { keys: "Shift + Enter", description: "블록 내 줄바꿈" },
      { keys: "/", description: "슬래시 커맨드" },
      { keys: "@", description: "멘션" },
    ],
  },
  {
    name: "네비게이션",
    shortcuts: [
      { keys: "⌘ + K", description: "빠른 검색" },
      { keys: "⌘ + \\", description: "사이드바 토글" },
      { keys: "⌘ + F", description: "찾기" },
      { keys: "⌘ + H", description: "찾기 & 바꾸기" },
      { keys: "Alt + ←", description: "뒤로" },
      { keys: "Alt + →", description: "앞으로" },
    ],
  },
  {
    name: "기타",
    shortcuts: [
      { keys: "⌘ + /", description: "단축키 도움말" },
      { keys: "⌘ + Shift + D", description: "다크모드 토글" },
      { keys: "⌘ + Shift + F", description: "포커스 모드" },
      { keys: "⌘ + Shift + P", description: "빠른 액션" },
      { keys: "⌘ + Z", description: "실행 취소" },
      { keys: "⌘ + Shift + Z", description: "다시 실행" },
      { keys: "Esc", description: "메뉴 닫기 / 선택 해제" },
    ],
  },
];

export function ShortcutsHelpModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setSearch("");
      }
      if (e.key === "Escape" && isOpen) {
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the input is rendered
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = SHORTCUT_CATEGORIES.map((cat) => ({
    ...cat,
    shortcuts: cat.shortcuts.filter(
      (s) =>
        !search ||
        s.description.toLowerCase().includes(search.toLowerCase()) ||
        s.keys.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((cat) => cat.shortcuts.length > 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ zIndex: "var(--z-command-palette)", backgroundColor: "rgba(15, 15, 15, 0.6)" }}
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-[520px] rounded-lg overflow-hidden"
        style={{
          top: "max(10vh, 60px)",
          zIndex: "calc(var(--z-command-palette) + 1)",
          backgroundColor: "var(--bg-primary)",
          boxShadow: "var(--shadow-popup)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
            키보드 단축키
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border-default)" }}>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="단축키 검색..."
            className="w-full bg-transparent outline-none"
            style={{
              fontSize: "14px",
              color: "var(--text-primary)",
              fontFamily: "var(--notion-font-family)",
            }}
          />
        </div>

        {/* Shortcut List */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {filtered.length > 0 ? (
            filtered.map((category) => (
              <div key={category.name} className="mb-2">
                <div
                  className="px-5 py-2"
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-tertiary)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {category.name}
                </div>
                {category.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.keys + shortcut.description}
                    className="flex items-center justify-between px-5 py-1.5"
                  >
                    <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.split(" + ").map((key, i) => (
                        <span key={i}>
                          {i > 0 && (
                            <span
                              className="mx-0.5"
                              style={{ fontSize: "10px", color: "var(--text-tertiary)" }}
                            >
                              +
                            </span>
                          )}
                          <kbd
                            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded"
                            style={{
                              fontSize: "11px",
                              fontFamily: "var(--notion-font-family)",
                              backgroundColor: "var(--bg-secondary)",
                              color: "var(--text-secondary)",
                              border: "1px solid var(--border-default)",
                              minWidth: "22px",
                              fontWeight: 500,
                            }}
                          >
                            {key.trim()}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div
              className="px-5 py-6 text-center"
              style={{ color: "var(--text-tertiary)", fontSize: "13px" }}
            >
              일치하는 단축키가 없습니다
            </div>
          )}
        </div>
      </div>
    </>
  );
}
