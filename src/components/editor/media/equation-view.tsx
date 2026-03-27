"use client";

import { useState, useEffect, useRef } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

export function EquationView({ node, updateAttributes, selected }: NodeViewProps) {
  const [isEditing, setIsEditing] = useState(!node.attrs.expression);
  const [input, setInput] = useState(node.attrs.expression || "");
  const [rendered, setRendered] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Render KaTeX
  useEffect(() => {
    if (!input) {
      setRendered("");
      setError("");
      return;
    }
    import("katex").then((katex) => {
      try {
        const html = katex.default.renderToString(input, {
          throwOnError: false,
          displayMode: true,
        });
        setRendered(html);
        setError("");
      } catch (e) {
        setError(String(e));
      }
    });
  }, [input]);

  return (
    <NodeViewWrapper
      className={`notion-equation ${selected ? "ProseMirror-selectednode" : ""}`}
    >
      {isEditing ? (
        <div
          className="p-3 rounded"
          style={{ backgroundColor: "var(--bg-secondary)" }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="LaTeX 수식 입력... (예: E = mc^2)"
            className="w-full bg-transparent outline-none font-mono text-sm resize-none"
            style={{ color: "var(--text-primary)", minHeight: "40px" }}
            autoFocus
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                updateAttributes({ expression: input });
                setIsEditing(false);
              }
              if (e.key === "Escape") {
                setInput(node.attrs.expression || "");
                setIsEditing(false);
              }
            }}
          />
          {/* Live preview */}
          {rendered && !error && (
            <div
              className="mt-2 pt-2 text-center"
              style={{ borderTop: "1px solid var(--border-default)" }}
              dangerouslySetInnerHTML={{ __html: rendered }}
            />
          )}
          {error && (
            <div className="mt-1 text-xs" style={{ color: "var(--color-red)" }}>
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => {
                setInput(node.attrs.expression || "");
                setIsEditing(false);
              }}
              className="px-2 py-1 text-xs rounded"
              style={{ color: "var(--text-secondary)" }}
            >
              취소
            </button>
            <button
              onClick={() => {
                updateAttributes({ expression: input });
                setIsEditing(false);
              }}
              className="px-2 py-1 text-xs rounded text-white"
              style={{ backgroundColor: "#2383e2" }}
            >
              완료
            </button>
          </div>
        </div>
      ) : (
        <div
          className="p-3 text-center cursor-pointer"
          onClick={() => setIsEditing(true)}
          style={{ minHeight: "40px" }}
        >
          {rendered ? (
            <div dangerouslySetInnerHTML={{ __html: rendered }} />
          ) : (
            <span style={{ color: "var(--text-placeholder)" }}>
              수식을 입력하려면 클릭하세요
            </span>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}
