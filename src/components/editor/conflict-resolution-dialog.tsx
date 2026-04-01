"use client";

import { useState, useCallback } from "react";

export type ConflictVersion = {
  label: string;
  content: string;
  timestamp: Date;
};

type ConflictResolutionDialogProps = {
  localVersion: ConflictVersion;
  serverVersion: ConflictVersion;
  onResolve: (resolution: "local" | "server" | "merge", mergedContent?: string) => void;
  onClose: () => void;
};

function DiffLine({ line, type }: { line: string; type: "added" | "removed" | "unchanged" }) {
  const bgColor =
    type === "added"
      ? "rgba(46, 160, 67, 0.1)"
      : type === "removed"
        ? "rgba(248, 81, 73, 0.1)"
        : "transparent";
  const textColor =
    type === "added"
      ? "#2ea043"
      : type === "removed"
        ? "#f85149"
        : "var(--text-primary)";
  const prefix = type === "added" ? "+" : type === "removed" ? "-" : " ";

  return (
    <div
      className="px-3 py-0.5 font-mono text-xs"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <span className="select-none mr-2 opacity-60">{prefix}</span>
      {line}
    </div>
  );
}

function computeSimpleDiff(local: string, server: string): { line: string; type: "added" | "removed" | "unchanged" }[] {
  const localLines = local.split("\n");
  const serverLines = server.split("\n");
  const result: { line: string; type: "added" | "removed" | "unchanged" }[] = [];

  const maxLen = Math.max(localLines.length, serverLines.length);
  for (let i = 0; i < maxLen; i++) {
    const l = localLines[i];
    const s = serverLines[i];
    if (l === s) {
      result.push({ line: l ?? "", type: "unchanged" });
    } else {
      if (l !== undefined) result.push({ line: l, type: "removed" });
      if (s !== undefined) result.push({ line: s, type: "added" });
    }
  }

  return result;
}

export function ConflictResolutionDialog({
  localVersion,
  serverVersion,
  onResolve,
  onClose,
}: ConflictResolutionDialogProps) {
  const [activeTab, setActiveTab] = useState<"side-by-side" | "diff">("side-by-side");
  const [mergeContent, setMergeContent] = useState(localVersion.content);
  const [showMergeEditor, setShowMergeEditor] = useState(false);

  const diffLines = computeSimpleDiff(localVersion.content, serverVersion.content);

  const handleMerge = useCallback(() => {
    if (!showMergeEditor) {
      // Combine both versions as starting point for merge
      setMergeContent(
        `${localVersion.content}\n\n--- 서버 버전 ---\n\n${serverVersion.content}`
      );
      setShowMergeEditor(true);
    } else {
      onResolve("merge", mergeContent);
    }
  }, [showMergeEditor, localVersion.content, serverVersion.content, mergeContent, onResolve]);

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center modal-backdrop-enter" style={{ zIndex: "var(--z-modal, 100)" }}>
      <div className="fixed inset-0" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-4xl mx-4 rounded-xl overflow-hidden modal-content-enter"
        style={{
          backgroundColor: "var(--bg-primary)",
          boxShadow: "var(--shadow-popup)",
          border: "1px solid var(--border-default)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border-divider)" }}
        >
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              버전 충돌 감지
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              오프라인 편집 내용이 서버 버전과 충돌합니다. 해결 방법을 선택하세요.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex px-5 pt-3 gap-4" style={{ borderBottom: "1px solid var(--border-divider)" }}>
          <button
            onClick={() => setActiveTab("side-by-side")}
            className="pb-2 text-sm font-medium"
            style={{
              color: activeTab === "side-by-side" ? "#2383e2" : "var(--text-secondary)",
              borderBottom: activeTab === "side-by-side" ? "2px solid #2383e2" : "2px solid transparent",
            }}
          >
            나란히 보기
          </button>
          <button
            onClick={() => setActiveTab("diff")}
            className="pb-2 text-sm font-medium"
            style={{
              color: activeTab === "diff" ? "#2383e2" : "var(--text-secondary)",
              borderBottom: activeTab === "diff" ? "2px solid #2383e2" : "2px solid transparent",
            }}
          >
            차이점 보기
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {showMergeEditor ? (
            <div>
              <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>
                병합할 내용을 편집하세요:
              </p>
              <textarea
                value={mergeContent}
                onChange={(e) => setMergeContent(e.target.value)}
                className="w-full rounded-lg p-3 font-mono text-sm resize-none"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                  minHeight: "300px",
                }}
              />
            </div>
          ) : activeTab === "side-by-side" ? (
            <div className="grid grid-cols-2 gap-4">
              {/* Local version */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    내 버전
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {formatTime(localVersion.timestamp)}
                  </span>
                </div>
                <div
                  className="rounded-lg p-3 text-sm font-mono whitespace-pre-wrap overflow-auto"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid rgba(248, 81, 73, 0.3)",
                    maxHeight: "400px",
                  }}
                >
                  {localVersion.content || "(빈 내용)"}
                </div>
              </div>

              {/* Server version */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    서버 버전
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {formatTime(serverVersion.timestamp)}
                  </span>
                </div>
                <div
                  className="rounded-lg p-3 text-sm font-mono whitespace-pre-wrap overflow-auto"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid rgba(46, 160, 67, 0.3)",
                    maxHeight: "400px",
                  }}
                >
                  {serverVersion.content || "(빈 내용)"}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="rounded-lg overflow-hidden"
              style={{
                border: "1px solid var(--border-default)",
                maxHeight: "400px",
                overflowY: "auto",
              }}
            >
              <div
                className="px-3 py-2 text-xs font-medium"
                style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
              >
                변경 사항 (빨강: 내 버전, 초록: 서버 버전)
              </div>
              {diffLines.map((line, i) => (
                <DiffLine key={i} line={line.line} type={line.type} />
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-4"
          style={{ borderTop: "1px solid var(--border-divider)" }}
        >
          <button
            onClick={() => onResolve("local")}
            className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
          >
            내 버전 유지
          </button>
          <button
            onClick={() => onResolve("server")}
            className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
          >
            서버 버전 사용
          </button>
          <button
            onClick={handleMerge}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#2383e2" }}
          >
            {showMergeEditor ? "병합 적용" : "병합"}
          </button>
        </div>
      </div>
    </div>
  );
}
