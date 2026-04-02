"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { AiMenu } from "./ai/ai-menu";
import { Link as LinkIcon, Sparkles, AlignLeft, AlignCenter, AlignRight, Highlighter, MessageSquarePlus } from "lucide-react";

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

export function InlineToolbar({ editor, onAddComment }: { editor: Editor; onAddComment?: (content: string, range: { from: number; to: number }) => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  // Single active panel — only one can be open at a time
  type PanelType = null | "colors" | "align" | "ai" | "link" | "comment" | "highlight";
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [commentRange, setCommentRange] = useState<{ from: number; to: number } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [suggestingMode, setSuggestingMode] = useState(false);

  const togglePanel = useCallback((panel: PanelType) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  // Derived booleans for backward compat in JSX
  const showColors = activePanel === "colors";
  const showAlign = activePanel === "align";
  const showAiMenu = activePanel === "ai";
  const showLinkInput = activePanel === "link";
  const showCommentInput = activePanel === "comment";

  const updatePosition = useCallback(() => {
    if (!editor.view || !editor.state) { setIsVisible(false); return; }
    const { from, to } = editor.state.selection;
    if (from === to) {
      setIsVisible(false);
      setActivePanel(null);
      return;
    }
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    setPosition({
      top: start.top - 48,
      left: (start.left + end.left) / 2,
    });
    setIsVisible(true);
  }, [editor]);

  useEffect(() => {
    editor.on("selectionUpdate", updatePosition);
    return () => {
      editor.off("selectionUpdate", updatePosition);
    };
  }, [editor, updatePosition]);

  const SHORTCUT_HINTS: Record<string, string> = {
    Bold: "\u2318B",
    Italic: "\u2318I",
    Underline: "\u2318U",
    Strikethrough: "\u2318\u21E7S",
    Code: "\u2318E",
    Link: "\u2318K",
    Highlight: "\u2318\u21E7H",
  };

  const buttons: { label: string; icon: ReactNode; action: () => void; isActive: () => boolean }[] = [
    {
      label: "Bold",
      icon: "B",
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive("bold"),
    },
    {
      label: "Italic",
      icon: "I",
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive("italic"),
    },
    {
      label: "Underline",
      icon: "U",
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: () => editor.isActive("underline"),
    },
    {
      label: "Strikethrough",
      icon: "S",
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: () => editor.isActive("strike"),
    },
    {
      label: "Highlight",
      icon: <Highlighter size={14} />,
      action: () => togglePanel("highlight"),
      isActive: () => editor.isActive("highlight") || activePanel === "highlight",
    },
    {
      label: "Code",
      icon: "<>",
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: () => editor.isActive("code"),
    },
    {
      label: "Link",
      icon: <LinkIcon size={14} />,
      action: () => {
        if (editor.isActive("link")) {
          editor.chain().focus().unsetLink().run();
          setActivePanel(null);
        } else {
          togglePanel("link");
          const attrs = editor.getAttributes("link");
          setLinkUrl(attrs.href || "");
        }
      },
      isActive: () => editor.isActive("link") || showLinkInput,
    },
    {
      label: "Color",
      icon: "A",
      action: () => togglePanel("colors"),
      isActive: () => showColors,
    },
    {
      label: "Align",
      icon: <AlignLeft size={14} />,
      action: () => togglePanel("align"),
      isActive: () => showAlign,
    },
    {
      label: "Suggest",
      icon: <MessageSquarePlus size={14} />,
      action: () => {
        setSuggestingMode(!suggestingMode);
      },
      isActive: () => suggestingMode,
    },
    {
      label: "Comment",
      icon: "\uD83D\uDCAC",
      action: () => {
        const { from, to } = editor.state.selection;
        setCommentRange({ from, to });
        togglePanel("comment");
      },
      isActive: () => showCommentInput,
    },
    {
      label: "AI",
      icon: <Sparkles size={14} />,
      action: () => togglePanel("ai"),
      isActive: () => showAiMenu,
    },
  ];

  if (!isVisible) return null;

  return (
    <div
      className="fixed flex flex-col items-start rounded-lg overflow-visible"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%)",
        zIndex: "var(--z-dropdown)",
      }}
    >
      <div
        className="flex items-center rounded-lg overflow-hidden"
        style={{
          backgroundColor: "var(--bg-primary)",
          boxShadow: "var(--shadow-popup)",
        }}
      >
        {buttons.map((btn) => (
          <button
            key={btn.label}
            onClick={btn.action}
            className={cn(
              "px-3 py-2 text-sm font-medium hover:bg-notion-bg-hover transition-colors",
            )}
            style={{
              color: btn.isActive() ? "#2383e2" : "var(--text-primary)",
              fontWeight: btn.label === "Bold" ? 700 : undefined,
              fontStyle: btn.label === "Italic" ? "italic" : undefined,
              textDecoration:
                btn.label === "Underline"
                  ? "underline"
                  : btn.label === "Strikethrough"
                    ? "line-through"
                    : undefined,
              ...(btn.label === "Color"
                ? {
                    borderBottom: "2px solid currentColor",
                    paddingBottom: "6px",
                  }
                : {}),
            }}
            title={`${btn.label}${SHORTCUT_HINTS[btn.label] ? ` (${SHORTCUT_HINTS[btn.label]})` : ""}`}
          >
            {btn.icon}
          </button>
        ))}
      </div>
      {showAiMenu && (
        <AiMenu
          editor={editor}
          position={{ top: position.top + 44, left: position.left }}
          onClose={() => setActivePanel(null)}
        />
      )}
      {showColors && (
        <div
          className="absolute top-full left-0 mt-1 p-2 rounded-lg"
          style={{
            backgroundColor: "var(--bg-primary)",
            boxShadow: "var(--shadow-popup)",
            width: "220px",
            zIndex: 1,
          }}
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
                  setActivePanel(null);
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
                  setActivePanel(null);
                }}
              />
            ))}
          </div>
        </div>
      )}
      {showAlign && (
        <div
          className="absolute top-full left-0 mt-1 p-2 rounded-lg"
          style={{
            backgroundColor: "var(--bg-primary)",
            boxShadow: "var(--shadow-popup)",
            width: "160px",
            zIndex: 1,
          }}
        >
          <div
            className="mb-2"
            style={{
              fontSize: "11px",
              color: "var(--text-tertiary)",
              fontWeight: 500,
            }}
          >
            텍스트 정렬
          </div>
          {([
            { label: "왼쪽", value: "left", icon: <AlignLeft size={14} /> },
            { label: "가운데", value: "center", icon: <AlignCenter size={14} /> },
            { label: "오른쪽", value: "right", icon: <AlignRight size={14} /> },
          ] as const).map((align) => (
            <button
              key={align.value}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-notion-bg-hover"
              style={{
                color: editor.isActive({ textAlign: align.value }) ? "#2383e2" : "var(--text-primary)",
              }}
              onClick={() => {
                editor.chain().focus().setTextAlign(align.value).run();
                setActivePanel(null);
              }}
            >
              {align.icon}
              {align.label}
            </button>
          ))}
        </div>
      )}
      {showLinkInput && (
        <div
          className="absolute top-full left-0 mt-1 p-2 rounded-lg flex items-center gap-2"
          style={{
            backgroundColor: "var(--bg-primary)",
            boxShadow: "var(--shadow-popup)",
            width: "320px",
            zIndex: 1,
          }}
        >
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="URL을 입력하세요"
            className="flex-1 px-2 py-1.5 text-sm border rounded outline-none"
            style={{
              borderColor: "var(--border-default)",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && linkUrl.trim()) {
                editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
                setActivePanel(null);
                setLinkUrl("");
              }
              if (e.key === "Escape") {
                setActivePanel(null);
                setLinkUrl("");
              }
            }}
          />
          <button
            onClick={() => {
              if (linkUrl.trim()) {
                editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
              }
              setActivePanel(null);
              setLinkUrl("");
            }}
            className="px-3 py-1.5 text-sm rounded text-white"
            style={{ backgroundColor: "#2383e2" }}
          >
            확인
          </button>
          {editor.isActive("link") && (
            <button
              onClick={() => {
                editor.chain().focus().unsetLink().run();
                setActivePanel(null);
                setLinkUrl("");
              }}
              className="px-2 py-1.5 text-sm rounded hover:bg-notion-bg-hover"
              style={{ color: "var(--color-red)" }}
            >
              제거
            </button>
          )}
        </div>
      )}
      {showCommentInput && commentRange && (
        <div
          className="absolute top-full left-0 mt-2 p-3 rounded-lg"
          style={{
            backgroundColor: "var(--bg-primary)",
            boxShadow: "var(--shadow-popup)",
            width: "280px",
            zIndex: 1,
          }}
        >
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="댓글 작성..."
            className="w-full rounded px-2 py-1.5 text-sm border resize-none"
            rows={3}
            style={{
              borderColor: "var(--border-default)",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
            }}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => { setActivePanel(null); setCommentText(""); }}
              className="px-3 py-1 text-sm rounded hover:bg-notion-bg-hover"
              style={{ color: "var(--text-secondary)" }}
            >
              취소
            </button>
            <button
              onClick={async () => {
                if (onAddComment) onAddComment(commentText, commentRange);
                setActivePanel(null);
                setCommentText("");
              }}
              className="px-3 py-1 text-sm rounded text-white"
              style={{ backgroundColor: "#2383e2" }}
              disabled={!commentText.trim()}
            >
              댓글
            </button>
          </div>
        </div>
      )}
      {activePanel === "highlight" && (
        <div
          className="absolute top-full left-0 mt-1 p-2 rounded-lg"
          style={{
            backgroundColor: "var(--bg-primary)",
            boxShadow: "var(--shadow-popup)",
            width: "240px",
            zIndex: 1,
          }}
        >
          <div
            className="mb-2"
            style={{
              fontSize: "11px",
              color: "var(--text-tertiary)",
              fontWeight: 500,
            }}
          >
            하이라이트 색상
          </div>
          <div className="flex flex-wrap gap-1">
            {BG_COLORS.filter((c) => c.value !== "default").map((c) => (
              <button
                key={c.value}
                className="w-7 h-7 rounded-md border hover:ring-2 ring-[#2383e2] flex items-center justify-center transition-all"
                style={{
                  backgroundColor: c.css,
                  borderColor: "var(--border-default)",
                }}
                title={c.name}
                onClick={() => {
                  editor.chain().focus().setHighlight({ color: c.css }).run();
                  setActivePanel(null);
                }}
              >
                {editor.isActive("highlight", { color: c.css }) && (
                  <span style={{ fontSize: "12px" }}>&#10003;</span>
                )}
              </button>
            ))}
          </div>
          <button
            className="w-full mt-2 px-2 py-1.5 text-sm rounded hover:bg-notion-bg-hover text-left"
            style={{ color: "var(--text-secondary)" }}
            onClick={() => {
              editor.chain().focus().unsetHighlight().run();
              setActivePanel(null);
            }}
          >
            하이라이트 제거
          </button>
          <div
            className="mt-2 pt-2 text-[10px]"
            style={{
              borderTop: "1px solid var(--border-default)",
              color: "var(--text-tertiary)",
            }}
          >
            단축키: {"\u2318\u21E7H"}
          </div>
        </div>
      )}
    </div>
  );
}
