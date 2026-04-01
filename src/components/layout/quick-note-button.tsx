"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { Plus, X } from "lucide-react";

export function QuickNoteButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string | undefined;
  const popupRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  const createPage = trpc.page.create.useMutation({
    onSuccess: (newPage) => {
      utils.page.list.invalidate();
      if (workspaceId) {
        router.push(`/${workspaceId}/${newPage.id}`);
      }
      setText("");
      setIsOpen(false);
    },
  });

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setText("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setText("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleSave = () => {
    if (!workspaceId || !text.trim()) return;
    // Use the first line as the title, or the whole text if single line
    const lines = text.trim().split("\n");
    const title = lines[0] || "빠른 메모";
    createPage.mutate({ workspaceId, title });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  if (!workspaceId) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 flex items-center justify-center rounded-full shadow-lg hover:scale-105 transition-transform"
        style={{
          width: "48px",
          height: "48px",
          backgroundColor: "#2383e2",
          color: "white",
          zIndex: 150,
        }}
        aria-label="빠른 메모"
      >
        {isOpen ? <X size={22} /> : <Plus size={22} />}
      </button>

      {/* Popup editor */}
      {isOpen && (
        <div
          ref={popupRef}
          className="fixed bottom-20 right-6 rounded-lg overflow-hidden dropdown-enter"
          style={{
            width: "320px",
            zIndex: 151,
            backgroundColor: "var(--bg-primary)",
            boxShadow: "var(--shadow-popup)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div
            className="px-3 py-2 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border-divider)" }}
          >
            <span
              className="font-medium"
              style={{ fontSize: "13px", color: "var(--text-primary)" }}
            >
              빠른 메모
            </span>
          </div>
          <div className="p-3">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메모를 입력하세요... (Enter로 저장)"
              className="w-full bg-transparent outline-none resize-none"
              style={{
                fontSize: "13px",
                color: "var(--text-primary)",
                minHeight: "80px",
                maxHeight: "200px",
              }}
              rows={3}
            />
          </div>
          <div
            className="flex items-center justify-end gap-2 px-3 py-2"
            style={{ borderTop: "1px solid var(--border-divider)" }}
          >
            <button
              onClick={() => {
                setIsOpen(false);
                setText("");
              }}
              className="px-3 py-1 rounded text-sm hover:bg-notion-bg-hover"
              style={{ color: "var(--text-secondary)" }}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={!text.trim() || createPage.isPending}
              className="px-3 py-1 rounded text-sm text-white disabled:opacity-40"
              style={{ backgroundColor: "#2383e2" }}
            >
              저장
            </button>
          </div>
        </div>
      )}
    </>
  );
}
