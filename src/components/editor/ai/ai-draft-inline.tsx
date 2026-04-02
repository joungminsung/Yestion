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

function markdownToHtml(md: string): string {
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
}

function simplePreviewHtml(md: string): string {
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:var(--bg-tertiary);padding:8px;border-radius:4px;font-size:12px;margin:4px 0"><code>$2</code></pre>');
  html = html.replace(/^### (.+)$/gm, '<div style="font-size:14px;font-weight:600;margin:6px 0 2px">$1</div>');
  html = html.replace(/^## (.+)$/gm, '<div style="font-size:15px;font-weight:700;margin:8px 0 2px">$1</div>');
  html = html.replace(/^- \[x\] (.+)$/gm, '<div style="margin:1px 0;padding-left:4px">✅ <s style="opacity:0.6">$1</s></div>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<div style="margin:1px 0;padding-left:4px">☐ $1</div>');
  html = html.replace(/^[-*] (.+)$/gm, '<div style="margin:1px 0;padding-left:12px">• $1</div>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<div style="margin:1px 0;padding-left:12px">$1. $2</div>');
  html = html.replace(/^&gt; (.+)$/gm, '<div style="border-left:3px solid var(--border-default);padding-left:8px;margin:4px 0;font-style:italic;color:var(--text-secondary)">$1</div>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-tertiary);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

export function AiDraftInline({ editor, context, insertPos, onDone }: Props) {
  const [prompt, setPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [phase, setPhase] = useState<"input" | "streaming" | "review">("input");
  const [previewHtml, setPreviewHtml] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fullTextRef = useRef("");
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Listen for ai-action events from AiMenu (text selection → action)
  useEffect(() => {
    const handler = (e: Event) => {
      const { action, context: ctx } = (e as CustomEvent).detail;
      if (action && ctx) {
        streamAi(action, ctx);
      }
    };
    window.addEventListener("ai-action", handler);
    return () => window.removeEventListener("ai-action", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  // Auto-scroll preview to bottom during streaming
  useEffect(() => {
    if (isStreaming && previewRef.current) {
      previewRef.current.scrollTop = previewRef.current.scrollHeight;
    }
  }, [previewHtml, isStreaming]);

  const streamAi = useCallback(async (action: string, userPrompt: string) => {
    setIsStreaming(true);
    setPhase("streaming");
    fullTextRef.current = "";
    setPreviewHtml("");
    abortRef.current = new AbortController();

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
            setPreviewHtml(simplePreviewHtml(fullTextRef.current));
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        fullTextRef.current = "AI 요청에 실패했습니다. 다시 시도해주세요.";
        setPreviewHtml("<p style='color:#e74c3c'>AI 요청에 실패했습니다.</p>");
      }
    }

    setIsStreaming(false);
    setPhase("review");
  }, [context]);

  const handleAccept = useCallback(() => {
    if (!fullTextRef.current) { onDone(); return; }
    const html = markdownToHtml(fullTextRef.current);
    editor.chain().focus().insertContentAt(insertPos, html).run();
    onDone();
  }, [editor, insertPos, onDone]);

  const handleReject = useCallback(() => {
    onDone();
  }, [onDone]);

  const handleRetry = useCallback(() => {
    fullTextRef.current = "";
    setPreviewHtml("");
    setPhase("input");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && prompt.trim()) {
      e.preventDefault();
      streamAi("write", prompt);
    }
    if (e.key === "Escape") {
      if (isStreaming && abortRef.current) {
        abortRef.current.abort();
        setIsStreaming(false);
        setPhase("review");
      } else if (phase === "input") {
        onDone();
      }
    }
  };

  const quickActions = [
    { label: "글쓰기", action: "write" },
    { label: "계속 쓰기", action: "continue" },
    { label: "요약", action: "summarize" },
    { label: "브레인스토밍", action: "brainstorm" },
    { label: "할 일 목록", action: "makeTodos" },
    { label: "번역 (영→한)", action: "translate_ko" },
  ];

  return (
    <div style={{ margin: "8px 0" }}>
      {/* Phase: Input */}
      {phase === "input" && (
        <>
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid #a855f730" }}
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
          <div className="flex flex-wrap gap-1.5 mt-2">
            {quickActions.map((qa) => (
              <button
                key={qa.action}
                onClick={() => streamAi(qa.action, prompt || context || "")}
                className="text-xs px-2.5 py-1 rounded-full transition-colors hover:opacity-80"
                style={{ backgroundColor: "#a855f715", color: "#a855f7", border: "1px solid #a855f730" }}
              >
                {qa.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Phase: Streaming / Review — show draft preview */}
      {(phase === "streaming" || phase === "review") && (
        <>
          <div
            ref={previewRef}
            className="rounded-r-lg text-sm overflow-y-auto"
            style={{
              borderLeft: "3px solid #a855f7",
              backgroundColor: "#a855f708",
              padding: "12px 16px",
              maxHeight: "400px",
              lineHeight: "1.6",
              color: "var(--text-primary)",
            }}
          >
            {previewHtml ? (
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <span className="inline-block w-2 h-4 animate-pulse" style={{ backgroundColor: "#a855f7" }} />
            )}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse" style={{ backgroundColor: "#a855f7" }} />
            )}
          </div>

          {/* Controls */}
          <div
            className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg"
            style={{ backgroundColor: "#a855f710", border: "1px solid #a855f730" }}
          >
            <Sparkles size={14} style={{ color: "#a855f7" }} />
            <span className="text-xs font-medium" style={{ color: "#a855f7" }}>
              {isStreaming ? "AI가 작성 중..." : "AI 초안"}
            </span>
            <div className="flex-1" />
            {isStreaming ? (
              <button
                onClick={() => { abortRef.current?.abort(); setIsStreaming(false); setPhase("review"); }}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded"
                style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
              >
                중지
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
