"use client";

import { useState, useEffect } from "react";
import { CellEditor } from "./cell-editor";
import { CellRenderer } from "./cell-renderer";
import type { DatabaseData } from "@/types/database";

type Props = {
  rowId: string;
  pageId: string;
  databaseId?: string;
  properties: DatabaseData["properties"];
  values: Record<string, unknown>;
  onClose: () => void;
  onUpdateRow: (rowId: string, propertyId: string, value: unknown) => void;
  onOpenFullPage: (pageId: string) => void;
};

export function RowPeekPanel(props: Props) {
  const { rowId, pageId, properties, values, onClose, onUpdateRow, onOpenFullPage } = props;
  const [editingProp, setEditingProp] = useState<string | null>(null);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const titleProp = properties.find((p) => p.type === "title");
  const titleValue = titleProp ? String(values[titleProp.id] || "제목 없음") : "제목 없음";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 w-[480px] z-50 flex flex-col modal-content-enter"
        style={{
          backgroundColor: "var(--bg-primary)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.1)",
          borderLeft: "1px solid var(--border-default)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <button
            onClick={() => onOpenFullPage(pageId)}
            className="text-sm hover:underline"
            style={{ color: "var(--color-blue)" }}
          >
            전체 페이지로 열기 ↗
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-tertiary)" }}
          >
            ✕
          </button>
        </div>

        {/* Properties */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <h3
            className="text-lg font-semibold mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            {titleValue}
          </h3>

          <div className="space-y-3">
            {properties
              .filter((p) => p.type !== "title")
              .map((prop) => (
                <div key={prop.id} className="flex items-start gap-3">
                  <div
                    className="w-32 flex-shrink-0 text-sm pt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {prop.name}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingProp === prop.id ? (
                      <CellEditor
                        value={values[prop.id]}
                        type={prop.type}
                        config={prop.config}
                        onChange={(val) => {
                          onUpdateRow(rowId, prop.id, val);
                          setEditingProp(null);
                        }}
                        onClose={() => setEditingProp(null)}
                      />
                    ) : (
                      <div
                        onClick={() => setEditingProp(prop.id)}
                        className="cursor-pointer px-1 py-0.5 rounded hover:bg-[var(--bg-hover)] min-h-[28px]"
                      >
                        <CellRenderer
                          value={values[prop.id]}
                          type={prop.type}
                          config={prop.config}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}
