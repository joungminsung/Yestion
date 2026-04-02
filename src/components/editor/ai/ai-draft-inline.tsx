"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles, Check, X, RotateCcw, Loader2 } from "lucide-react";
import type { Editor } from "@tiptap/react";

type Props = {
  editor: Editor;
  context?: string;
  insertPos: number;
  onDone: () => void;
};

/**
 * AI Draft Inline — streams AI response directly into the editor
 * as "draft" content with a purple left border, then shows accept/reject bar.
 */
export function AiDraftInline({ editor, context, insertPos, onDone }: Props) {
  const [prompt, setPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [draftRange, setDraftRange] = useState<{ from: number; to: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fullTextRef = useRef("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const markdownToHtml = useCallback((md: string): string => {
    let html = md;
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>");
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/^- \[x\] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>$1</p></li></ul>');
    html = html.replace(/^- \[ \] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>$1</p></li></ul>');
    html = html.replace(/^[-*] (.+)$/gm, "<li><p>$1</p></li>");
    html = html.replace(/(<li><p>.*<\/p><\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
    html = html.replace(/^\d+\. (.+)$/gm, "<li><p>$1</p></li>");
    html = html.replace(/^> (.+)$/gm, "<blockquote><p>$1</p></blockquote>");
    html = html.replace(/^---$/gm, "<hr>");
    html = html.replace(/^(?!<[a-z])(.+)$/gm, "<p>$1</p>");
    html = html.replace(/<p><\/p>/g, "");
    return html;
  }, []);

  const streamToEditor = useCallback(async (action: string, userPrompt: string) => {
    setIsStreaming(true);
    setHasStarted(true);
    fullTextRef.current = "";
    abortRef.current = new AbortController();

    // Insert a draft wrapper div at current position
    const startPos = insertPos;
    editor.chain().focus().insertContentAt(startPos, '<div class="ai-draft-block"></div>').run();

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userPrompt || "위 내용을 처리해주세요.",
          context,
          action,
        }),
        signal: abortRef.current.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const { text } = JSON.parse(data);
            fullTextRef.current += text;
          } catch {
            // skip
          }
        }

        // Re-render the draft block with current accumulated text
        const html = markdownToHtml(fullTextRef.current);
        const draftEl = editor.view.dom.querySelector(".ai-draft-block");
        if (draftEl) {
          draftEl.innerHTML = html;
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const draftEl = editor.view.dom.querySelector(".ai-draft-block");
        if (draftEl) {
          draftEl.innerHTML = "<p>AI 요청에 실패했습니다.</p>";
        }
      }
    }

    // Calculate draft range for accept/reject
    const draftEl = editor.view.dom.querySelector(".ai-draft-block");
    if (draftEl) {
      const pos = editor.view.posAtDOM(draftEl, 0);
      setDraftRange({ from: Math.max(0, pos - 1), to: pos + draftEl.textContent!.length + 1 });
    }
    setIsStreaming(false);
  }, [editor, insertPos, context, markdownToHtml]);

  const handleAccept = useCallback(() => {
    // Replace the draft wrapper div with its parsed content as real editor nodes
    const html = markdownToHtml(fullTextRef.current);

    // Remove draft div
    const draftEl = editor.view.dom.querySelector(".ai-draft-block");
    if (draftEl) {
      const pos = editor.view.posAtDOM(draftEl, 0);
      // Delete the draft wrapper
      try {
        const resolvedPos = editor.state.doc.resolve(pos);
        const node = resolvedPos.parent;
        const start = resolvedPos.before(resolvedPos.depth);
        const end = start + node.nodeSize;
        editor.chain().focus().deleteRange({ from: start, to: end }).insertContentAt(start, html).run();
      } catch {
        // Fallback: just remove the class
        draftEl.classList.remove("ai-draft-block");
      }
    }
    onDone();
  }, [editor, markdownToHtml, onDone]);

  const handleReject = useCallback(() => {
    // Remove the draft block entirely
    const draftEl = editor.view.dom.querySelector(".ai-draft-block");
    if (draftEl) {
      try {
        const pos = editor.view.posAtDOM(draftEl, 0);
        const resolvedPos = editor.state.doc.resolve(pos);
        const node = resolvedPos.parent;
        const start = resolvedPos.before(resolvedPos.depth);
        const end = start + node.nodeSize;
        editor.chain().focus().deleteRange({ from: start, to: end }).run();
      } catch {
        draftEl.remove();
      }
    }
    onDone();
  }, [editor, onDone]);

  const handleRetry = useCallback(() => {
    handleReject();
    fullTextRef.current = "";
    setHasStarted(false);
    setDraftRange(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [handleReject]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && prompt.trim()) {
      e.preventDefault();
      streamToEditor("write", prompt);
    }
    if (e.key === "Escape") {
      if (isStreaming && abortRef.current) {
        abortRef.current.abort();
        setIsStreaming(false);
      } else if (!hasStarted) {
        onDone();
      }
    }
  };

  // Quick actions
  const quickActions = [
    { label: "글쓰기", action: "write" },
    { label: "계속 쓰기", action: "continue" },
    { label: "요약", action: "summarize" },
    { label: "브레인스토밍", action: "brainstorm" },
    { label: "할 일 목록", action: "makeTodos" },
    { label: "번역 (영→한)", action: "translate_ko" },
  ];

  return (
    <div className="ai-draft-controls" style={{ margin: "8px 0" }}>
      {/* Input bar — before streaming */}
      {!hasStarted && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid #a855f730",
          }}
        >
          <Sparkles size={16} style={{ color: "#a855f7", flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="AI에게 요청하세요... (Enter로 전송)"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
      )}

      {/* Quick action chips — before streaming */}
      {!hasStarted && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {quickActions.map((qa) => (
            <button
              key={qa.action}
              onClick={() => streamToEditor(qa.action, prompt || context || "")}
              className="text-xs px-2.5 py-1 rounded-full transition-colors hover:opacity-80"
              style={{ backgroundColor: "#a855f715", color: "#a855f7", border: "1px solid #a855f730" }}
            >
              {qa.label}
            </button>
          ))}
        </div>
      )}

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: "#a855f7" }}>
          <Loader2 size={12} className="animate-spin" />
          <span>AI가 작성 중...</span>
          <button
            onClick={() => abortRef.current?.abort()}
            className="ml-auto px-2 py-0.5 rounded text-xs hover:opacity-80"
            style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
          >
            중지
          </button>
        </div>
      )}

      {/* Accept / Reject bar — after streaming */}
      {hasStarted && !isStreaming && (
        <div
          className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg"
          style={{
            backgroundColor: "#a855f710",
            border: "1px solid #a855f730",
          }}
        >
          <Sparkles size={14} style={{ color: "#a855f7" }} />
          <span className="text-xs" style={{ color: "#a855f7" }}>AI 초안</span>
          <div className="flex-1" />
          <button
            onClick={handleAccept}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium text-white"
            style={{ backgroundColor: "#a855f7" }}
          >
            <Check size={12} />
            수락
          </button>
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded"
            style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
          >
            <RotateCcw size={12} />
            다시
          </button>
          <button
            onClick={handleReject}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded"
            style={{ backgroundColor: "var(--bg-secondary)", color: "#e74c3c" }}
          >
            <X size={12} />
            거절
          </button>
        </div>
      )}
    </div>
  );
}
