"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Check, X, User } from "lucide-react";

type SuggestionRange = {
  from: number;
  to: number;
};

type Suggestion = {
  id: string;
  authorId: string;
  authorName: string;
  action: "insert" | "delete" | "replace";
  text: string;
  originalText: string | null;
  createdAt: string;
  from: number;
  to: number;
  ranges: SuggestionRange[];
};

function collectSuggestions(editor: Editor): Suggestion[] {
  const suggestions = new Map<string, Suggestion>();

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || node.textContent.length === 0) return;

    node.marks.forEach((mark) => {
      if (mark.type.name !== "suggestion") return;

      const suggestionId = String(mark.attrs.suggestionId ?? `sug-${pos}`);
      const range = { from: pos, to: pos + node.nodeSize };
      const existing = suggestions.get(suggestionId);

      if (existing) {
        existing.text += node.textContent;
        existing.from = Math.min(existing.from, range.from);
        existing.to = Math.max(existing.to, range.to);
        existing.ranges.push(range);
        if (!existing.originalText && mark.attrs.originalText) {
          existing.originalText = mark.attrs.originalText;
        }
        return;
      }

      suggestions.set(suggestionId, {
        id: suggestionId,
        authorId: mark.attrs.authorId,
        authorName: mark.attrs.authorName || "Unknown",
        action: mark.attrs.action,
        text: node.textContent,
        originalText: mark.attrs.originalText,
        createdAt: mark.attrs.createdAt,
        from: range.from,
        to: range.to,
        ranges: [range],
      });
    });
  });

  return Array.from(suggestions.values())
    .map((suggestion) => ({
      ...suggestion,
      ranges: suggestion.ranges.sort((left, right) => left.from - right.from),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function SuggestionPanel({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => collectSuggestions(editor));

  useEffect(() => {
    const syncSuggestions = () => {
      setSuggestions(collectSuggestions(editor));
    };

    syncSuggestions();
    editor.on("update", syncSuggestions);
    return () => {
      editor.off("update", syncSuggestions);
    };
  }, [editor]);

  useEffect(() => {
    if (expandedId && !suggestions.some((suggestion) => suggestion.id === expandedId)) {
      setExpandedId(null);
    }
  }, [expandedId, suggestions]);

  const runSuggestionCommand = (
    suggestion: Suggestion,
    command: "acceptSuggestion" | "rejectSuggestion",
  ) => {
    const ranges = [...suggestion.ranges].sort((left, right) => right.from - left.from);

    for (const range of ranges) {
      editor.chain().focus().setTextSelection(range)[command]().run();
    }
  };

  const handleAccept = (suggestion: Suggestion) => {
    runSuggestionCommand(suggestion, "acceptSuggestion");
  };

  const handleReject = (suggestion: Suggestion) => {
    runSuggestionCommand(suggestion, "rejectSuggestion");
  };

  const handleAcceptAll = () => {
    // Accept from end to start to preserve positions
    const sorted = [...suggestions].sort((a, b) => b.from - a.from);
    for (const sug of sorted) {
      handleAccept(sug);
    }
  };

  const handleRejectAll = () => {
    const sorted = [...suggestions].sort((a, b) => b.from - a.from);
    for (const sug of sorted) {
      handleReject(sug);
    }
  };

  const actionLabel = (action: string) => {
    switch (action) {
      case "insert": return "Added";
      case "delete": return "Deleted";
      case "replace": return "Replaced";
      default: return action;
    }
  };

  const actionColor = (action: string) => {
    switch (action) {
      case "insert": return "#00b450";
      case "delete": return "#eb5757";
      case "replace": return "#ffb400";
      default: return "var(--text-primary)";
    }
  };

  return (
    <div
      className="fixed right-0 top-0 bottom-0 w-[320px] z-40 flex flex-col border-l"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border-divider)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Suggestions ({suggestions.length})
        </h3>
        <div className="flex items-center gap-1">
          {suggestions.length > 0 && (
            <>
              <button
                onClick={handleAcceptAll}
                className="text-xs px-2 py-1 rounded hover:bg-notion-bg-hover"
                style={{ color: "#00b450" }}
              >
                Accept all
              </button>
              <button
                onClick={handleRejectAll}
                className="text-xs px-2 py-1 rounded hover:bg-notion-bg-hover"
                style={{ color: "#eb5757" }}
              >
                Reject all
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {suggestions.length === 0 ? (
          <div
            className="text-center py-12 text-sm"
            style={{ color: "var(--text-tertiary)" }}
          >
            No suggestions
          </div>
        ) : (
          suggestions.map((sug) => (
            <div
              key={sug.id}
              className="px-4 py-3 border-b cursor-pointer hover:bg-notion-bg-hover"
              style={{ borderColor: "var(--border-divider)" }}
              onClick={() => {
                const focusRange = sug.ranges[0] ?? { from: sug.from, to: sug.to };
                editor.chain().focus().setTextSelection(focusRange).run();
                setExpandedId(expandedId === sug.id ? null : sug.id);
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <User size={12} style={{ color: "var(--text-tertiary)" }} />
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {sug.authorName}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${actionColor(sug.action)}20`, color: actionColor(sug.action) }}
                  >
                    {actionLabel(sug.action)}
                  </span>
                </div>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {new Date(sug.createdAt).toLocaleTimeString()}
                </span>
              </div>

              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {sug.action === "delete" ? (
                  <span style={{ textDecoration: "line-through", color: "#eb5757" }}>
                    {sug.text.slice(0, 80)}{sug.text.length > 80 ? "..." : ""}
                  </span>
                ) : (
                  <span style={{ color: "#00b450" }}>
                    {sug.text.slice(0, 80)}{sug.text.length > 80 ? "..." : ""}
                  </span>
                )}
              </div>

              {expandedId === sug.id && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAccept(sug); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-notion-bg-hover"
                    style={{ color: "#00b450" }}
                  >
                    <Check size={12} /> Accept
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReject(sug); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-notion-bg-hover"
                    style={{ color: "#eb5757" }}
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
