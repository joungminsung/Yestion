"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles } from "lucide-react";

function simpleMarkdownToHtml(md: string): string {
  let html = md;
  // Code blocks first (before other transforms)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:var(--bg-tertiary);padding:8px;border-radius:4px;overflow-x:auto;font-size:12px;margin:4px 0"><code>$2</code></pre>');
  // Headings
  html = html.replace(/^### (.+)$/gm, '<div style="font-size:14px;font-weight:600;margin:8px 0 4px">$1</div>');
  html = html.replace(/^## (.+)$/gm, '<div style="font-size:15px;font-weight:700;margin:10px 0 4px">$1</div>');
  html = html.replace(/^# (.+)$/gm, '<div style="font-size:16px;font-weight:700;margin:10px 0 4px">$1</div>');
  // Checklists
  html = html.replace(/^- \[x\] (.+)$/gm, '<div style="margin:2px 0;padding-left:4px">✅ <s style="opacity:0.6">$1</s></div>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<div style="margin:2px 0;padding-left:4px">☐ $1</div>');
  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<div style="margin:1px 0;padding-left:12px">• $1</div>');
  // Ordered lists
  html = html.replace(/^(\d+)\. (.+)$/gm, '<div style="margin:1px 0;padding-left:12px">$1. $2</div>');
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<div style="border-left:3px solid var(--border-default);padding-left:8px;margin:4px 0;color:var(--text-secondary);font-style:italic">$1</div>');
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border-default);margin:8px 0">');
  // Bold & italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-tertiary);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>');
  // Line breaks
  html = html.replace(/\n/g, '<br>');
  return html;
}

type AiAction =
  | "write"
  | "summarize"
  | "brainstorm"
  | "continue"
  | "makeLonger"
  | "makeShorter"
  | "fixGrammar"
  | "translate_en"
  | "translate_ko"
  | "changeTone_professional"
  | "changeTone_casual"
  | "extractPoints"
  | "makeTodos";

type Props = {
  context?: string;
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
  onClose: () => void;
};

const QUICK_ACTIONS: { label: string; action: AiAction }[] = [
  { label: "글쓰기", action: "write" },
  { label: "요약", action: "summarize" },
  { label: "브레인스토밍", action: "brainstorm" },
  { label: "계속 쓰기", action: "continue" },
  { label: "번역 (영→한)", action: "translate_ko" },
  { label: "번역 (한→영)", action: "translate_en" },
];

export function AiPrompt({ context, onInsert, onReplace, onClose }: Props) {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasResponse, setHasResponse] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (actionType: AiAction, customPrompt?: string) => {
      const finalPrompt = customPrompt || prompt;
      if (!finalPrompt && !context) return;

      setIsStreaming(true);
      setResponse("");
      setHasResponse(true);

      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: finalPrompt || "위 내용을 처리해주세요.",
            context,
            action: actionType,
          }),
          signal: abortRef.current.signal,
        });

        const reader = res.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        let fullText = "";

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
              fullText += text;
              setResponse(fullText);
            } catch {
              // skip malformed chunks
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResponse("AI 요청에 실패했습니다. 다시 시도해주세요.");
        }
      }
      setIsStreaming(false);
    },
    [prompt, context]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit("write");
    }
    if (e.key === "Escape") {
      if (isStreaming && abortRef.current) {
        abortRef.current.abort();
        setIsStreaming(false);
      } else {
        onClose();
      }
    }
  };

  const handleRetry = () => {
    handleSubmit("write");
  };

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        backgroundColor: "var(--bg-primary)",
        boxShadow: "var(--shadow-popup)",
        width: "420px",
        maxHeight: "500px",
      }}
    >
      {/* Input area */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} style={{ color: "#a855f7" }} />
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="AI에게 요청하세요..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text-primary)" }}
            disabled={isStreaming}
          />
          {isStreaming && (
            <button
              onClick={() => abortRef.current?.abort()}
              className="text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-secondary)",
              }}
            >
              중지
            </button>
          )}
        </div>

        {/* Quick actions */}
        {!hasResponse && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.action}
                onClick={() => handleSubmit(qa.action, prompt || context || "")}
                className="text-xs px-2.5 py-1 rounded-full transition-colors"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "var(--bg-tertiary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "var(--bg-secondary)")
                }
              >
                {qa.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Response area — render markdown preview */}
      {hasResponse && (
        <div
          className="mx-3 mb-2 p-3 rounded text-sm overflow-y-auto ai-response-preview"
          style={{
            borderLeft: "3px solid #a855f7",
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-primary)",
            maxHeight: "300px",
            lineHeight: "1.6",
          }}
          dangerouslySetInnerHTML={
            response
              ? { __html: simpleMarkdownToHtml(response) + (isStreaming ? '<span class="inline-block w-1.5 h-4 ml-0.5 animate-pulse" style="background:#a855f7"></span>' : '') }
              : undefined
          }
        >
          {!response && (
            <span
              className="inline-block w-2 h-4 animate-pulse"
              style={{ backgroundColor: "#a855f7" }}
            />
          )}
        </div>
      )}

      {/* Action buttons after response */}
      {hasResponse && !isStreaming && response && (
        <div
          className="flex items-center gap-2 px-3 pb-3"
          style={{ borderTop: "none" }}
        >
          <button
            onClick={() => {
              onInsert(response);
              onClose();
            }}
            className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
            style={{
              backgroundColor: "#a855f7",
              color: "white",
            }}
          >
            삽입
          </button>
          {context && (
            <button
              onClick={() => {
                onReplace(response);
                onClose();
              }}
              className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
              style={{
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
              }}
            >
              대체
            </button>
          )}
          <button
            onClick={handleRetry}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-secondary)",
            }}
          >
            다시 시도
          </button>
          <button
            onClick={() => {
              setResponse("");
              setHasResponse(false);
            }}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-secondary)",
            }}
          >
            폐기
          </button>
        </div>
      )}
    </div>
  );
}
