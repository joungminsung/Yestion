"use client";

import { useMemo } from "react";
import { CellRenderer } from "../cell-renderer";
import type { DatabaseData, RowData, ViewConfig } from "@/types/database";

type ListViewProps = {
  databaseId: string;
  properties: DatabaseData["properties"];
  rows: RowData[];
  viewConfig: ViewConfig;
  onAddRow: () => void;
  onUpdateRow: (rowId: string, propertyId: string, value: unknown) => void;
  onRowClick: (pageId: string) => void;
};

const MAX_VISIBLE_PROPERTIES = 3;

export function ListView({
  properties,
  rows,
  viewConfig,
  onAddRow,
  onRowClick,
}: ListViewProps) {
  // Visible properties excluding title, limited to 3
  const visibleProperties = useMemo(() => {
    const visible = viewConfig.visibleProperties
      ? properties.filter(
          (p) =>
            viewConfig.visibleProperties!.includes(p.id) &&
            p.type !== "title",
        )
      : properties.filter((p) => p.isVisible && p.type !== "title");

    return visible
      .sort((a, b) => a.position - b.position)
      .slice(0, MAX_VISIBLE_PROPERTIES);
  }, [properties, viewConfig.visibleProperties]);

  return (
    <div className="flex flex-col">
      {rows.map((row) => {
        const title = row.page?.title ?? "Untitled";
        const icon = row.page?.icon;

        return (
          <div
            key={row.id}
            className="group flex items-center justify-between border-b px-3 py-2 transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              borderColor: "var(--border-default)",
              cursor: "pointer",
              minHeight: 40,
            }}
            onClick={() => onRowClick(row.pageId)}
          >
            {/* Left: icon + title */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {icon && <span className="shrink-0 text-sm">{icon}</span>}
              <span
                className="truncate text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {title}
              </span>
            </div>

            {/* Right: property values */}
            {visibleProperties.length > 0 && (
              <div className="ml-4 flex shrink-0 items-center gap-4">
                {visibleProperties.map((prop) => {
                  const value = row.values[prop.id];
                  return (
                    <div
                      key={prop.id}
                      className="max-w-[160px] text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <CellRenderer
                        value={value}
                        type={prop.type}
                        config={prop.config}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* "+ New" button */}
      <button
        onClick={onAddRow}
        className="flex items-center gap-1 px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-hover)]"
        style={{ color: "var(--text-secondary)", minHeight: 40 }}
      >
        <span className="text-base leading-none">+</span>
        <span>New</span>
      </button>
    </div>
  );
}
