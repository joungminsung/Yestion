"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Sparkles, Check, X, RotateCcw } from "lucide-react";
import type { Editor } from "@tiptap/react";
import {
  streamAiResponse,
  type AiAction,
  type AiStreamStatus,
} from "@/lib/ai-stream";
import { markdownToBlocks } from "@/lib/markdown-import";

type Props = {
  editor: Editor;
  context?: string;
  insertPos: number;
  onDone: () => void;
};

type QuickAction = {
  label: string;
  hint: string;
  action: AiAction;
};

const QUICK_ACTIONS: QuickAction[] = [
  { label: "글쓰기", hint: "새 초안을 바로 만듭니다", action: "write" },
  { label: "계속 쓰기", hint: "이어지는 문단을 붙입니다", action: "continue" },
  { label: "요약", hint: "핵심만 짧게 정리합니다", action: "summarize" },
  { label: "브레인스토밍", hint: "아이디어 후보를 넓힙니다", action: "brainstorm" },
  { label: "할 일 목록", hint: "실행 항목으로 바꿉니다", action: "makeTodos" },
  { label: "번역", hint: "영문을 자연스럽게 한국어로", action: "translate_ko" },
] as const;

function simplePreviewHtml(md: string): string {
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:rgba(15,23,42,0.06);padding:10px 12px;border-radius:12px;font-size:12px;margin:8px 0;overflow-x:auto"><code>$2</code></pre>');
  html = html.replace(/^### (.+)$/gm, '<div style="font-size:14px;font-weight:700;margin:8px 0 4px;color:var(--text-primary)">$1</div>');
  html = html.replace(/^## (.+)$/gm, '<div style="font-size:15px;font-weight:700;margin:10px 0 4px;color:var(--text-primary)">$1</div>');
  html = html.replace(/^- \[x\] (.+)$/gm, '<div style="margin:3px 0;padding-left:4px">✅ <s style="opacity:0.6">$1</s></div>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<div style="margin:3px 0;padding-left:4px">☐ $1</div>');
  html = html.replace(/^[-*] (.+)$/gm, '<div style="margin:3px 0;padding-left:14px">• $1</div>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<div style="margin:3px 0;padding-left:14px">$1. $2</div>');
  html = html.replace(/^&gt; (.+)$/gm, '<div style="border-left:3px solid rgba(35,131,226,0.35);padding-left:10px;margin:6px 0;color:var(--text-secondary);font-style:italic">$1</div>');
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(15,23,42,0.06);padding:1px 5px;border-radius:5px;font-size:12px">$1</code>');
  html = html.replace(/\n/g, "<br>");
  return html;
}

function compactContextText(text: string, limit = 220) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 1)}…`;
}

function normalizeAiMarkdownForEditor(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function AiDraftInline({ editor, context, insertPos, onDone }: Props) {
  const [prompt, setPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [phase, setPhase] = useState<"input" | "streaming" | "review">("input");
  const [previewHtml, setPreviewHtml] = useState("");
  const [streamStatus, setStreamStatus] = useState<AiStreamStatus | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<AiAction>("write");
  const [lastPrompt, setLastPrompt] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fullTextRef = useRef("");
  const previewRef = useRef<HTMLDivElement>(null);

  const contextPreview = useMemo(() => compactContextText(context ?? ""), [context]);
  const hasContext = contextPreview.length > 0;
  const canStart = prompt.trim().length > 0 || hasContext;

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (isStreaming && previewRef.current) {
      previewRef.current.scrollTop = previewRef.current.scrollHeight;
    }
  }, [previewHtml, isStreaming]);

  const streamAi = useCallback(async (action: AiAction, userPrompt: string) => {
    setIsStreaming(true);
    setPhase("streaming");
    fullTextRef.current = "";
    setPreviewHtml("");
    setStreamError(null);
    setLastAction(action);
    setLastPrompt(userPrompt);
    setStreamStatus({
      type: "status",
      phase: "preparing",
      progress: 5,
      message: "요청을 준비하고 있습니다.",
    });
    abortRef.current = new AbortController();

    try {
      await streamAiResponse({
        prompt: userPrompt || "위 내용을 처리해주세요.",
        context,
        action,
        signal: abortRef.current.signal,
        onStatus: setStreamStatus,
        onText: (_text, fullText) => {
          fullTextRef.current = fullText;
          setPreviewHtml(simplePreviewHtml(fullText));
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
            fullTextRef.current.trim().length > 0
              ? "생성을 중지했습니다. 현재까지 작성된 초안만 검토할 수 있습니다."
              : "생성을 중지했습니다.",
        });
      } else if (!streamError) {
        fullTextRef.current = "AI 요청에 실패했습니다. 다시 시도해주세요.";
        setPreviewHtml("<p style='color:#b42318'>AI 요청에 실패했습니다. 잠시 후 다시 시도해주세요.</p>");
        setStreamError("AI 요청에 실패했습니다. 다시 시도해주세요.");
        setStreamStatus({
          type: "status",
          phase: "finalizing",
          progress: 100,
          message: "AI 요청에 실패했습니다. 다시 시도해주세요.",
        });
      }
    }

    setIsStreaming(false);
    setPhase("review");
  }, [context, streamError]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { action, context: ctx } = (e as CustomEvent).detail;
      if (action && ctx) {
        void streamAi(action as AiAction, ctx);
      }
    };
    window.addEventListener("ai-action", handler);
    return () => window.removeEventListener("ai-action", handler);
  }, [streamAi]);

  const handleAccept = useCallback(() => {
    if (!fullTextRef.current) {
      onDone();
      return;
    }
    const normalized = normalizeAiMarkdownForEditor(fullTextRef.current);
    const blocks = markdownToBlocks(normalized);
    if (blocks.length > 0) {
      editor.chain().focus().insertContentAt(insertPos, blocks).run();
    }
    onDone();
  }, [editor, insertPos, onDone]);

  const handleReject = useCallback(() => {
    onDone();
  }, [onDone]);

  const handleRetry = useCallback(() => {
    const retryPrompt = lastPrompt || prompt.trim() || context || "";
    if (!retryPrompt) {
      fullTextRef.current = "";
      setPreviewHtml("");
      setPhase("input");
      setTimeout(() => inputRef.current?.focus(), 80);
      return;
    }

    void streamAi(lastAction, retryPrompt);
  }, [context, lastAction, lastPrompt, prompt, streamAi]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && canStart) {
      e.preventDefault();
      void streamAi("write", prompt.trim() || context || "");
    }
    if (e.key === "Escape") {
      if (isStreaming && abortRef.current) {
        abortRef.current.abort();
        setIsStreaming(false);
        setPhase("review");
        setStreamStatus({
          type: "status",
          phase: "finalizing",
          progress: 100,
          message: "생성을 중지했습니다.",
        });
      } else if (phase === "input") {
        onDone();
      }
    }
  };

  return (
    <section
      className="my-3 overflow-hidden rounded-xl border"
      style={{
        borderColor: "var(--border-default)",
        backgroundColor: "var(--bg-primary)",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        className="flex items-start gap-3 border-b px-4 py-3"
        style={{
          borderColor: "var(--border-default)",
          backgroundColor: "var(--bg-primary)",
        }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg border"
          style={{
            borderColor: "var(--border-default)",
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-secondary)",
          }}
        >
          <Sparkles size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            AI 글쓰기
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            {phase === "input"
              ? "문서 흐름 안에서 초안을 만들고 바로 반영할 수 있습니다."
              : isStreaming
                ? "선택한 문맥과 요청을 바탕으로 초안을 작성하고 있습니다."
              : "생성된 초안을 검토한 뒤 문서에 반영하세요."}
          </p>
        </div>
        <div
          className="hidden rounded-full px-2 py-1 text-[11px] sm:block"
          style={{
            backgroundColor: "var(--bg-secondary)",
            color: streamError ? "#e03e3e" : isStreaming ? "#2383e2" : "var(--text-tertiary)",
            border: "1px solid var(--border-default)",
          }}
        >
          {streamError ? "오류 확인" : isStreaming ? "작성 중" : phase === "review" ? "검토 단계" : "초안 준비"}
        </div>
        <button
          onClick={handleReject}
          className="rounded-lg px-2 py-1 text-xs"
          style={{ color: "var(--text-tertiary)", backgroundColor: "transparent" }}
        >
          닫기
        </button>
      </div>

      {hasContext && (
        <div className="px-4 pt-4">
          <div
            className="rounded-lg border px-3 py-3"
            style={{
              borderColor: "var(--border-default)",
              backgroundColor: "var(--bg-secondary)",
            }}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                선택한 문맥
              </span>
              <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {contextPreview.length}자 참고 중
              </span>
            </div>
            <p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              {contextPreview}
            </p>
          </div>
        </div>
      )}

      {phase === "input" && (
        <div className="px-4 pb-4 pt-4">
          <div
            className="rounded-lg border p-3"
            style={{
              borderColor: "var(--border-default)",
              backgroundColor: "var(--bg-primary)",
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                AI에게 요청
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                `Enter` 전송 · `Shift+Enter` 줄바꿈
              </p>
            </div>
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasContext
                ? "예: 더 간결한 보고 문체로 정리하고, 핵심만 앞에 배치해줘"
                : "예: 주간 회의 공지 초안을 전문적이지만 딱딱하지 않게 작성해줘"}
              className="min-h-[96px] w-full resize-none bg-transparent text-sm leading-6 outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          </div>

          <div className="mt-3">
            <p className="mb-2 text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>
              빠른 작업
            </p>
            <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.action}
                onClick={() => void streamAi(qa.action, prompt.trim() || context || "")}
                className="rounded-lg border px-3 py-2 text-left transition-colors hover:bg-notion-bg-hover"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor: "var(--bg-secondary)",
                }}
              >
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {qa.label}
                </div>
                <p className="mt-0.5 text-[11px] leading-5" style={{ color: "var(--text-tertiary)" }}>
                  {qa.hint}
                </p>
              </button>
            ))}
          </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => void streamAi("write", prompt.trim() || context || "")}
              disabled={!canStart}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
              style={{ backgroundColor: "#2383e2" }}
            >
              <Sparkles size={14} />
              초안 만들기
            </button>
            <button
              onClick={handleReject}
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {(phase === "streaming" || phase === "review") && (
        <div className="px-4 pb-4 pt-4">
          <div
            className="mb-3 rounded-lg border px-3 py-2.5"
            style={{
              borderColor: streamError ? "rgba(224, 62, 62, 0.2)" : "var(--border-default)",
              backgroundColor: streamError ? "rgba(224, 62, 62, 0.05)" : "var(--bg-secondary)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  {streamError
                    ? "AI 초안 생성 중 문제가 발생했습니다"
                    : isStreaming
                      ? "AI 초안을 작성하고 있습니다"
                      : "AI 초안 검토 준비 완료"}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {streamError
                    ? streamError
                    : streamStatus?.message ??
                      (fullTextRef.current
                        ? "생성된 초안을 검토한 뒤 문서에 반영할 수 있습니다."
                        : "초안을 준비하고 있습니다.")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {typeof streamStatus?.progress === "number"
                    ? `${Math.round(Math.max(0, Math.min(100, streamStatus.progress)))}%`
                    : isStreaming
                      ? "진행 중"
                      : "완료"}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {fullTextRef.current ? `${fullTextRef.current.length}자 초안` : "문맥 준비 중"}
                </p>
              </div>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--bg-tertiary)" }}
            >
              <div
                className={
                  isStreaming && typeof streamStatus?.progress !== "number"
                    ? "h-full animate-pulse rounded-full"
                    : "h-full rounded-full"
                }
                style={{
                  width: `${Math.max(0, Math.min(100, streamStatus?.progress ?? 36))}%`,
                  backgroundColor: streamError ? "#e03e3e" : "#2383e2",
                }}
              />
            </div>
          </div>

          <div
            className="overflow-hidden rounded-lg border"
            style={{
              borderColor: "var(--border-default)",
              backgroundColor: "var(--bg-primary)",
            }}
          >
            <div
              className="flex items-center justify-between gap-2 border-b px-3 py-2"
              style={{
                borderColor: "var(--border-default)",
                backgroundColor: "var(--bg-secondary)",
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} style={{ color: "var(--text-secondary)" }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  생성된 초안
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {isStreaming ? "실시간 생성 중" : `${fullTextRef.current.length}자 초안`}
                </span>
                {isStreaming && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: "#2383e2" }}>
                    <span className="inline-block h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: "#2383e2" }} />
                    작성 중
                  </span>
                )}
              </div>
            </div>

            <div
              ref={previewRef}
              className="max-h-[380px] overflow-y-auto px-4 py-4 text-sm"
              style={{ lineHeight: 1.8, color: "var(--text-primary)" }}
            >
              {previewHtml ? (
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-tertiary)" }}>
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full animate-pulse"
                    style={{ backgroundColor: streamError ? "#e03e3e" : "#2383e2" }}
                  />
                  {streamError
                    ? "실패 원인을 확인한 뒤 다시 생성해보세요."
                    : streamStatus?.message ?? "초안 뼈대를 만들고 있습니다."}
                </div>
              )}
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm" style={{ backgroundColor: "#2383e2" }} />
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isStreaming ? (
              <button
                onClick={() => {
                  abortRef.current?.abort();
                  setIsStreaming(false);
                  setPhase("review");
                }}
                className="rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-default)",
                }}
              >
                생성 중지
              </button>
            ) : (
              <>
                <button
                  onClick={handleAccept}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: "#2383e2" }}
                >
                  <Check size={14} />
                  문서에 반영
                </button>
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <RotateCcw size={14} />
                  다시 생성
                </button>
                <button
                  onClick={handleReject}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <X size={14} />
                  닫기
                </button>
              </>
            )}
            <div className="ml-auto hidden items-center gap-1 text-xs sm:flex" style={{ color: "var(--text-tertiary)" }}>
              {hasContext ? <span>선택한 문맥을 참고해 작성합니다.</span> : <span>빈 문단에서 새 초안을 작성합니다.</span>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
