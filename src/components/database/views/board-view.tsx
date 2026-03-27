"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { CellRenderer } from "../cell-renderer";
import type { DatabaseData, RowData, ViewConfig, SelectOption } from "@/types/database";

type BoardViewProps = {
  databaseId: string;
  properties: DatabaseData["properties"];
  rows: RowData[];
  viewConfig: ViewConfig;
  onAddRow: (defaultValues?: Record<string, unknown>) => void;
  onUpdateRow: (rowId: string, propertyId: string, value: unknown) => void;
  onRowClick: (pageId: string) => void;
};

const NO_VALUE_KEY = "__no_value__";
const MAX_VISIBLE_PROPERTIES = 3;

const COLOR_DOT_MAP: Record<string, string> = {
  default: "#91918e",
  gray: "#91918e",
  brown: "#64473a",
  orange: "#d9730d",
  yellow: "#cb912f",
  green: "#448361",
  blue: "#2383e2",
  purple: "#9065b0",
  pink: "#c14c8a",
  red: "#d44c47",
};

export function BoardView({
  properties,
  rows,
  viewConfig,
  onAddRow,
  onUpdateRow,
  onRowClick,
}: BoardViewProps) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const draggedRowId = useRef<string | null>(null);

  // Identify the groupBy property
  const groupByProperty = useMemo(() => {
    if (!viewConfig.boardGroupBy) {
      // Default: first select or status property
      return properties.find(
        (p) => p.type === "select" || p.type === "status",
      );
    }
    return properties.find((p) => p.id === viewConfig.boardGroupBy);
  }, [properties, viewConfig.boardGroupBy]);

  // Options for the groupBy property
  const options: SelectOption[] = useMemo(() => {
    return groupByProperty?.config.options ?? [];
  }, [groupByProperty]);

  // Visible card properties (excluding title and groupBy)
  const cardProperties = useMemo(() => {
    const exclude = new Set<string>();
    if (groupByProperty) exclude.add(groupByProperty.id);
    // Always exclude the title property from card body (it's shown as card title)

    const visible = viewConfig.visibleProperties
      ? properties.filter(
          (p) =>
            viewConfig.visibleProperties!.includes(p.id) &&
            !exclude.has(p.id) &&
            p.type !== "title",
        )
      : properties.filter(
          (p) => p.isVisible && !exclude.has(p.id) && p.type !== "title",
        );

    return visible
      .sort((a, b) => a.position - b.position)
      .slice(0, MAX_VISIBLE_PROPERTIES);
  }, [properties, viewConfig.visibleProperties, groupByProperty]);

  // Group rows by the groupBy property value
  const groupedRows = useMemo(() => {
    const groups: Record<string, RowData[]> = {};

    // Initialize columns for each option + "no value"
    groups[NO_VALUE_KEY] = [];
    for (const opt of options) {
      groups[opt.id] = [];
    }

    for (const row of rows) {
      const val = groupByProperty
        ? (row.values[groupByProperty.id] as string | undefined)
        : undefined;

      if (val && groups[val]) {
        groups[val].push(row);
      } else if (val) {
        // Value exists but isn't a known option — find by name match
        const matched = options.find((o) => o.name === val);
        if (matched) {
          groups[matched.id]!.push(row);
        } else {
          groups[NO_VALUE_KEY]!.push(row);
        }
      } else {
        groups[NO_VALUE_KEY]!.push(row);
      }
    }

    return groups;
  }, [rows, groupByProperty, options]);

  // Column ordering: known options first, then "No value"
  const columnOrder = useMemo(() => {
    const cols = options.map((o) => o.id);
    cols.push(NO_VALUE_KEY);
    return cols;
  }, [options]);

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, rowId: string) => {
      draggedRowId.current = rowId;
      e.dataTransfer.effectAllowed = "move";
      // Use a small delay to allow the browser to capture the drag image
      e.dataTransfer.setData("text/plain", rowId);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, columnId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverColumn(columnId);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, columnId: string) => {
      e.preventDefault();
      setDragOverColumn(null);

      const rowId = draggedRowId.current;
      if (!rowId || !groupByProperty) return;

      const newValue = columnId === NO_VALUE_KEY ? "" : columnId;
      onUpdateRow(rowId, groupByProperty.id, newValue);
      draggedRowId.current = null;
    },
    [groupByProperty, onUpdateRow],
  );

  const handleAddRow = useCallback(
    (columnId: string) => {
      if (!groupByProperty) {
        onAddRow();
        return;
      }
      const value = columnId === NO_VALUE_KEY ? undefined : columnId;
      onAddRow(
        value ? { [groupByProperty.id]: value } : undefined,
      );
    },
    [groupByProperty, onAddRow],
  );

  const getOptionById = useCallback(
    (id: string): SelectOption | undefined => {
      return options.find((o) => o.id === id);
    },
    [options],
  );

  if (!groupByProperty) {
    return (
      <div
        className="flex items-center justify-center py-12 text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
        No select or status property found. Add one to use Board view.
      </div>
    );
  }

  return (
    <div
      className="flex gap-2 overflow-x-auto p-3"
      style={{ minHeight: 300 }}
    >
      {columnOrder.map((columnId) => {
        const option = getOptionById(columnId);
        const columnRows = groupedRows[columnId] ?? [];
        const isNoValue = columnId === NO_VALUE_KEY;
        const isDragOver = dragOverColumn === columnId;

        return (
          <div
            key={columnId}
            className="flex w-[272px] shrink-0 flex-col rounded-lg"
            style={{
              backgroundColor: isDragOver
                ? "var(--bg-hover)"
                : "var(--bg-secondary, #f7f6f3)",
              transition: "background-color 150ms",
            }}
            onDragOver={(e) => handleDragOver(e, columnId)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, columnId)}
          >
            {/* Column header */}
            <div
              className="flex items-center gap-2 px-3 py-2"
              style={{ minHeight: 38 }}
            >
              {!isNoValue && option && (
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      COLOR_DOT_MAP[option.color] ?? COLOR_DOT_MAP.default,
                  }}
                />
              )}
              <span
                className="truncate text-sm font-medium"
                style={{
                  color: isNoValue
                    ? "var(--text-tertiary)"
                    : "var(--text-primary)",
                }}
              >
                {isNoValue ? "No value" : option?.name ?? columnId}
              </span>
              <span
                className="ml-auto shrink-0 text-xs"
                style={{ color: "var(--text-tertiary)" }}
              >
                {columnRows.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-1.5 pb-1.5">
              {columnRows.map((row) => (
                <BoardCard
                  key={row.id}
                  row={row}
                  cardProperties={cardProperties}
                  onDragStart={handleDragStart}
                  onClick={() => onRowClick(row.pageId)}
                />
              ))}

              {/* "+ New" button */}
              <button
                onClick={() => handleAddRow(columnId)}
                className="flex items-center gap-1 rounded px-2 py-1.5 text-sm transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-secondary)" }}
              >
                <span className="text-base leading-none">+</span>
                <span>New</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Board Card ──────────────────────────────────────────────

function BoardCard({
  row,
  cardProperties,
  onDragStart,
  onClick,
}: {
  row: RowData;
  cardProperties: DatabaseData["properties"];
  onDragStart: (e: React.DragEvent, rowId: string) => void;
  onClick: () => void;
}) {
  const title = row.page?.title ?? "Untitled";
  const icon = row.page?.icon;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, row.id)}
      onClick={onClick}
      className="cursor-pointer rounded-md border p-2 shadow-sm transition-shadow hover:shadow-md"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* Title */}
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-sm">{icon}</span>}
        <span
          className="truncate text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </span>
      </div>

      {/* Visible property values */}
      {cardProperties.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1">
          {cardProperties.map((prop) => {
            const value = row.values[prop.id];
            if (value === null || value === undefined || value === "")
              return null;
            return (
              <div key={prop.id} className="text-xs" style={{ color: "var(--text-secondary)" }}>
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
}
