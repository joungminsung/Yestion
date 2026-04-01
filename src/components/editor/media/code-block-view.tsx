"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";

const LINE_FOLD_THRESHOLD = 20;

export function CodeBlockView({ node, updateAttributes, extension }: NodeViewProps) {
  const language = (node.attrs.language as string) || "";
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [isFolded, setIsFolded] = useState(false);
  const [copyLabel, setCopyLabel] = useState("복사");
  const codeRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(0);

  // Count lines
  useEffect(() => {
    const text = node.textContent || "";
    const count = text.split("\n").length;
    setLineCount(count);
  }, [node.textContent]);

  const handleCopy = useCallback(() => {
    const text = node.textContent || "";
    navigator.clipboard.writeText(text).then(() => {
      setCopyLabel("복사됨!");
      setTimeout(() => setCopyLabel("복사"), 1500);
    }).catch(() => {});
  }, [node]);

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateAttributes({ language: e.target.value });
    },
    [updateAttributes]
  );

  const languages = extension.options.lowlight
    ? (extension.options.lowlight.listLanguages?.() as string[] || [])
    : [];

  return (
    <NodeViewWrapper className="notion-code-block-wrapper" style={{ position: "relative", margin: "4px 0" }}>
      {/* Toolbar */}
      <div
        className="notion-code-toolbar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 12px",
          fontSize: "12px",
          color: "var(--text-secondary)",
          background: "var(--bg-secondary)",
          borderRadius: "4px 4px 0 0",
          borderBottom: "1px solid var(--border-divider)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={language}
            onChange={handleLanguageChange}
            contentEditable={false}
            style={{
              background: "transparent",
              border: "1px solid var(--border-default)",
              borderRadius: 4,
              padding: "2px 6px",
              fontSize: 11,
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <option value="">자동 감지</option>
            {languages.map((lang: string) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowLineNumbers((prev) => !prev)}
            contentEditable={false}
            style={{
              background: showLineNumbers ? "var(--bg-active)" : "transparent",
              border: "1px solid var(--border-default)",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 11,
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
            title="줄 번호 토글"
          >
            #
          </button>
        </div>
        <button
          onClick={handleCopy}
          contentEditable={false}
          style={{
            background: "transparent",
            border: "1px solid var(--border-default)",
            borderRadius: 4,
            padding: "2px 10px",
            fontSize: 11,
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
          title="코드 복사"
        >
          {copyLabel}
        </button>
      </div>
      {/* Code content */}
      <pre
        style={{
          background: "var(--bg-secondary)",
          borderRadius: "0 0 4px 4px",
          padding: "12px 16px",
          margin: 0,
          fontFamily: "var(--notion-font-mono)",
          fontSize: 14,
          lineHeight: 1.5,
          overflowX: "auto",
          maxHeight: isFolded ? `${LINE_FOLD_THRESHOLD * 1.5 * 14 + 24}px` : undefined,
          overflow: isFolded ? "hidden" : undefined,
          position: "relative",
          counterReset: showLineNumbers ? "line" : undefined,
        }}
      >
        <code
          ref={codeRef}
          className={showLineNumbers ? "code-with-line-numbers" : ""}
        >
          <NodeViewContent as="div" />
        </code>
      </pre>
      {/* Fold toggle */}
      {lineCount > LINE_FOLD_THRESHOLD && (
        <button
          onClick={() => setIsFolded((prev) => !prev)}
          contentEditable={false}
          style={{
            display: "block",
            width: "100%",
            padding: "4px 0",
            fontSize: 12,
            color: "var(--text-secondary)",
            background: "var(--bg-secondary)",
            border: "none",
            borderTop: "1px solid var(--border-divider)",
            borderRadius: "0 0 4px 4px",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          {isFolded ? `더 보기 (${lineCount}줄)` : "접기"}
        </button>
      )}
    </NodeViewWrapper>
  );
}
