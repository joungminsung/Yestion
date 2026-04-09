"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles } from "lucide-react";
import {
  streamAiResponse,
  type AiAction,
  type AiStreamStatus,
} from "@/lib/ai-stream";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function simpleMarkdownToHtml(md: string): string {
  // Escape HTML entities first to prevent XSS, then apply markdown transforms
  let html = escapeHtml(md);
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
  const [streamStatus, setStreamStatus] = useState<AiStreamStatus | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<AiAction>("write");
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
      setStreamError(null);
      setLastAction(actionType);
      setStreamStatus({
        type: "status",
        phase: "preparing",
        progress: 5,
        message: "요청을 준비하고 있습니다.",
      });

      abortRef.current = new AbortController();

      try {
        await streamAiResponse({
          prompt: finalPrompt || "위 내용을 처리해주세요.",
          context,
          action: actionType,
          signal: abortRef.current.signal,
          onStatus: setStreamStatus,
          onText: (_text, fullText) => {
            setResponse(fullText);
          },
          onError: (message) => {
            setStreamError(message);
            setStreamStatus({
              type: "status",
              phase: "finalizing",
              progress: 100,
              message,
            });
          },
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setStreamStatus({
            type: "status",
            phase: "finalizing",
            progress: 100,
            message:
              response.trim().length > 0
                ? "생성을 중지했습니다. 현재까지 작성된 결과를 검토할 수 있습니다."
                : "생성을 중지했습니다.",
          });
        } else if (!streamError) {
          const message = "AI 요청에 실패했습니다. 다시 시도해주세요.";
          setStreamError(message);
          setStreamStatus({
            type: "status",
            phase: "finalizing",
            progress: 100,
            message,
          });
        }
      }
      setIsStreaming(false);
    },
    [prompt, context, response, streamError]
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
        setStreamStatus({
          type: "status",
          phase: "finalizing",
          progress: 100,
          message: "생성을 중지했습니다.",
        });
      } else {
        onClose();
      }
    }
  };

  const handleRetry = () => {
    handleSubmit(lastAction);
  };

  const statusProgress =
    typeof streamStatus?.progress === "number"
      ? Math.max(0, Math.min(100, streamStatus.progress))
      : null;

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
        <>
          <div
            className="mx-3 mb-2 rounded-lg border px-3 py-2.5"
            style={{
              borderColor: streamError ? "rgba(224, 62, 62, 0.2)" : "var(--border-default)",
              backgroundColor: streamError ? "rgba(224, 62, 62, 0.05)" : "var(--bg-secondary)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  {streamError
                    ? "AI 생성 중 문제가 발생했습니다"
                    : isStreaming
                      ? "AI 처리 진행 상황"
                      : "AI 응답 준비 완료"}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {streamError
                    ? streamError
                    : streamStatus?.message ??
                      (response
                        ? "생성된 내용을 검토하고 삽입하거나 대체할 수 있습니다."
                        : "응답을 준비하고 있습니다.")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {statusProgress !== null ? `${Math.round(statusProgress)}%` : isStreaming ? "진행 중" : "완료"}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {isStreaming ? "실시간 생성" : response ? `${response.length}자 생성` : "대기 중"}
                </p>
              </div>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--bg-tertiary)" }}
            >
              <div
                className={isStreaming && statusProgress === null ? "h-full animate-pulse rounded-full" : "h-full rounded-full"}
                style={{
                  width: `${statusProgress ?? 36}%`,
                  backgroundColor: streamError ? "#e03e3e" : "#a855f7",
                }}
              />
            </div>
          </div>

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
              ? { __html: simpleMarkdownToHtml(response) + (isStreaming ? '<span class="inline-block w-1.5 h-4 ml-0.5 animate-pulse" style="background:#a855f7"></span>' : "") }
              : undefined
          }
        >
          {!response && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span
                className="inline-block w-2 h-4 animate-pulse"
                style={{ backgroundColor: streamError ? "#e03e3e" : "#a855f7" }}
              />
              {streamError
                ? "실패 원인을 확인한 뒤 다시 시도해주세요."
                : streamStatus?.message ?? "AI가 응답을 준비하고 있습니다."}
            </div>
          )}
          </div>
        </>
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
              setStreamError(null);
              setStreamStatus(null);
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
