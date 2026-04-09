"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, FileText, Loader2 } from "lucide-react";
import { trpc } from "@/server/trpc/client";

type RelationCellEditorProps = {
  databaseId: string; // target database ID
  workspaceId: string;
  value: string[]; // array of related row IDs
  onChange: (value: string[]) => void;
  onClose: () => void;
};

export function RelationCellEditor({
  databaseId,
  workspaceId,
  value,
  onChange,
  onClose,
}: RelationCellEditorProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Search rows in target database
  const { data: searchResults, isLoading } = trpc.database.searchRelationRows.useQuery(
    { databaseId, query: debouncedQuery },
    { enabled: !!databaseId },
  );

  // Fetch currently related rows
  const { data: relatedRows } = trpc.database.getRelatedRows.useQuery(
    { rowIds: value, workspaceId },
    { enabled: value.length > 0 },
  );

  const handleAdd = useCallback(
    (rowId: string) => {
      if (!value.includes(rowId)) {
        onChange([...value, rowId]);
      }
    },
    [value, onChange],
  );

  const handleRemove = useCallback(
    (rowId: string) => {
      onChange(value.filter((id) => id !== rowId));
    },
    [value, onChange],
  );

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 w-[300px] rounded-lg overflow-hidden"
      style={{
        backgroundColor: "var(--bg-primary)",
        boxShadow: "var(--shadow-popup)",
        border: "1px solid var(--border-default)",
      }}
    >
      {/* Selected items */}
      {relatedRows && relatedRows.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pt-3 pb-1">
          {relatedRows.map((row) => (
            <span
              key={row.rowId}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
              }}
            >
              {row.icon || <FileText size={10} />}
              <span className="max-w-[120px] truncate">{row.title}</span>
              <button
                onClick={() => handleRemove(row.rowId)}
                className="p-0.5 rounded hover:bg-notion-bg-hover"
                style={{ color: "var(--text-tertiary)" }}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--border-divider)" }}>
        <Search size={14} style={{ color: "var(--text-tertiary)" }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search rows..."
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: "var(--text-primary)" }}
        />
      </div>

      {/* Results */}
      <div className="max-h-[200px] overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
          </div>
        )}

        {searchResults?.map((row) => {
          const isSelected = value.includes(row.rowId);
          return (
            <button
              key={row.rowId}
              onClick={() => (isSelected ? handleRemove(row.rowId) : handleAdd(row.rowId))}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-notion-bg-hover text-left"
              style={{
                color: "var(--text-primary)",
                backgroundColor: isSelected ? "var(--bg-secondary)" : "transparent",
              }}
            >
              <span className="flex-shrink-0">
                {row.icon || <FileText size={14} style={{ color: "var(--text-tertiary)" }} />}
              </span>
              <span className="truncate flex-1">{row.title}</span>
              {isSelected && (
                <span className="text-xs" style={{ color: "#2383e2" }}>Selected</span>
              )}
            </button>
          );
        })}

        {searchResults?.length === 0 && !isLoading && (
          <div className="text-center py-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
            No rows found
          </div>
        )}
      </div>
    </div>
  );
}
