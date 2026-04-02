"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDatabaseStore } from "@/stores/database";
import { CellRenderer } from "../cell-renderer";
import { CellEditor } from "../cell-editor";
import { propertyTypeIcon } from "../property-type-icon";
import type { DatabaseData, RowData, ViewConfig, PropertyType, SortRule, RowHeight, AggregationFunction } from "@/types/database";

type TableViewProps = {
  databaseId: string;
  properties: DatabaseData["properties"];
  rows: RowData[];
  viewConfig: ViewConfig;
  onAddRow: () => void;
  onUpdateRow: (rowId: string, propertyId: string, value: unknown) => void;
  onAddProperty: () => void;
  onRowClick: (pageId: string) => void;
  onDeleteRow?: (rowId: string) => void;
  onDuplicateRow?: (rowId: string) => void;
  sorts?: SortRule[];
  onSortChange?: (sorts: SortRule[]) => void;
  onReorderRow?: (draggedRowId: string, targetRowId: string) => void;
};

const DEFAULT_COLUMN_WIDTH = 200;
const MIN_COLUMN_WIDTH = 100;
const TITLE_COLUMN_WIDTH = 260;
const ROW_NUMBER_WIDTH = 32;

const ROW_HEIGHT_MAP: Record<Exclude<RowHeight, "auto">, number> = {
  short: 33,
  medium: 56,
  tall: 76,
};

const READ_ONLY_TYPES: PropertyType[] = [
  "created_time",
  "created_by",
  "last_edited_time",
  "last_edited_by",
  "formula",
  "rollup",
];

const AGGREGATION_OPTIONS: { value: AggregationFunction; label: string }[] = [
  { value: "none", label: "None" },
  { value: "count", label: "Count" },
  { value: "count_values", label: "Count values" },
  { value: "count_unique", label: "Count unique" },
  { value: "count_empty", label: "Count empty" },
  { value: "count_not_empty", label: "Count not empty" },
  { value: "percent_empty", label: "Percent empty" },
  { value: "percent_not_empty", label: "Percent not empty" },
  { value: "sum", label: "Sum" },
  { value: "average", label: "Average" },
  { value: "median", label: "Median" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
  { value: "range", label: "Range" },
];

const CHECKBOX_WIDTH = 28;

export function TableView({
  properties,
  rows,
  viewConfig,
  onAddRow,
  onUpdateRow,
  onAddProperty,
  onRowClick,
  onDeleteRow,
  onDuplicateRow,
  sorts,
  onSortChange,
  onReorderRow,
}: TableViewProps) {
  // Row selection from store
  const { selectedRowIds, toggleRowSelection, selectAllRows } = useDatabaseStore();

  // Context menu for row actions
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rowId: string;
    pageId: string;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    propertyId: string;
  } | null>(null);

  const [focusedCell, setFocusedCell] = useState<{
    rowIndex: number;
    colIndex: number;
  } | null>(null);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    viewConfig.propertyWidths ?? {},
  );

  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  // Drag reorder state
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [dropTargetRowId, setDropTargetRowId] = useState<string | null>(null);

  // Summary aggregation dropdown
  const [aggregationDropdown, setAggregationDropdown] = useState<string | null>(null);
  const aggDropdownRef = useRef<HTMLDivElement>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rowHeight = viewConfig.rowHeight ?? "short";
  const effectiveRowHeight = rowHeight === "auto" ? 33 : ROW_HEIGHT_MAP[rowHeight];

  // Calculate auto row height based on content
  const getRowHeight = useCallback(
    (row: RowData): number => {
      if (rowHeight !== "auto") {
        return effectiveRowHeight;
      }

      // Auto height: calculate based on content
      const values = (row.values as Record<string, unknown>) ?? {};
      let maxLines = 1;
      for (const prop of properties) {
        const val = values[prop.id];
        if (typeof val === "string") {
          const lines = val.split("\n").length;
          if (lines > maxLines) maxLines = lines;
        }
      }
      return Math.max(33, maxLines * 22 + 11); // 22px per line + padding
    },
    [rowHeight, effectiveRowHeight, properties],
  );

  // Sort properties: title first, then by position; filter hidden
  const visibleProperties = useMemo(() => {
    const hidden = new Set(
      viewConfig.visibleProperties
        ? properties
            .filter((p) => !viewConfig.visibleProperties!.includes(p.id))
            .map((p) => p.id)
        : properties.filter((p) => !p.isVisible).map((p) => p.id),
    );

    return [...properties]
      .filter((p) => !hidden.has(p.id))
      .sort((a, b) => {
        if (a.type === "title") return -1;
        if (b.type === "title") return 1;
        return a.position - b.position;
      });
  }, [properties, viewConfig.visibleProperties]);

  const getColumnWidth = useCallback(
    (propertyId: string, type: PropertyType) => {
      if (columnWidths[propertyId]) return columnWidths[propertyId];
      if (type === "title") return TITLE_COLUMN_WIDTH;
      return DEFAULT_COLUMN_WIDTH;
    },
    [columnWidths],
  );

  // Pinned columns
  const pinnedSet = useMemo(
    () => new Set(viewConfig.pinnedProperties ?? []),
    [viewConfig.pinnedProperties],
  );

  // Calculate pinned column left offsets for sticky positioning
  const pinnedOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let left = ROW_NUMBER_WIDTH + CHECKBOX_WIDTH; // after row number + checkbox
    for (const prop of visibleProperties) {
      if (pinnedSet.has(prop.id)) {
        offsets[prop.id] = left;
        left += getColumnWidth(prop.id, prop.type);
      }
    }
    return offsets;
  }, [visibleProperties, pinnedSet, getColumnWidth]);

  const gridTemplateColumns = useMemo(() => {
    const cols = visibleProperties.map(
      (p) => `${getColumnWidth(p.id, p.type)}px`,
    );
    return `${CHECKBOX_WIDTH}px ${ROW_NUMBER_WIDTH}px ${cols.join(" ")} 44px`;
  }, [visibleProperties, getColumnWidth]);

  const handleCellClick = useCallback(
    (rowId: string, propertyId: string, type: PropertyType, rowIndex: number, colIndex: number) => {
      if (READ_ONLY_TYPES.includes(type)) return;
      // Checkbox: toggle directly
      if (type === "checkbox") {
        const row = rows.find((r) => r.id === rowId);
        if (row) {
          onUpdateRow(rowId, propertyId, !(row.values[propertyId] === true));
        }
        return;
      }
      setEditingCell({ rowId, propertyId });
      setFocusedCell({ rowIndex, colIndex });
    },
    [rows, onUpdateRow],
  );

  const handleCellChange = useCallback(
    (rowId: string, propertyId: string, value: unknown) => {
      onUpdateRow(rowId, propertyId, value);
    },
    [onUpdateRow],
  );

  const handleCellClose = useCallback(() => {
    setEditingCell(null);
  }, []);

  // Navigation handler passed to CellEditor
  const handleCellNavigate = useCallback(
    (rowId: string, propertyId: string, e: React.KeyboardEvent) => {
      const rowIndex = rows.findIndex((r) => r.id === rowId);
      const colIndex = visibleProperties.findIndex((p) => p.id === propertyId);

      if (e.key === "Tab") {
        const nextCol = e.shiftKey ? colIndex - 1 : colIndex + 1;
        if (nextCol >= 0 && nextCol < visibleProperties.length) {
          const nextProp = visibleProperties[nextCol]!;
          if (!READ_ONLY_TYPES.includes(nextProp.type) && nextProp.type !== "checkbox") {
            setEditingCell({ rowId, propertyId: nextProp.id });
            setFocusedCell({ rowIndex, colIndex: nextCol });
          } else {
            setEditingCell(null);
            setFocusedCell({ rowIndex, colIndex: nextCol });
          }
        } else {
          setEditingCell(null);
        }
      } else if (e.key === "Enter") {
        const nextRow = rowIndex + 1;
        if (nextRow < rows.length) {
          const prop = visibleProperties[colIndex]!;
          if (!READ_ONLY_TYPES.includes(prop.type) && prop.type !== "checkbox") {
            setEditingCell({ rowId: rows[nextRow]!.id, propertyId: prop.id });
            setFocusedCell({ rowIndex: nextRow, colIndex });
          } else {
            setEditingCell(null);
            setFocusedCell({ rowIndex: nextRow, colIndex });
          }
        } else {
          setEditingCell(null);
        }
      }
    },
    [rows, visibleProperties],
  );

  // Arrow key navigation when not editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingCell) return;
      if (!focusedCell) return;

      const { rowIndex, colIndex } = focusedCell;
      let nextRow = rowIndex;
      let nextCol = colIndex;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          nextRow = Math.max(0, rowIndex - 1);
          break;
        case "ArrowDown":
          e.preventDefault();
          nextRow = Math.min(rows.length - 1, rowIndex + 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          nextCol = Math.max(0, colIndex - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          nextCol = Math.min(visibleProperties.length - 1, colIndex + 1);
          break;
        case "Enter": {
          e.preventDefault();
          const prop = visibleProperties[colIndex];
          if (prop && !READ_ONLY_TYPES.includes(prop.type) && prop.type !== "checkbox") {
            const row = rows[rowIndex];
            if (row) setEditingCell({ rowId: row.id, propertyId: prop.id });
          }
          return;
        }
        case "Escape":
          setFocusedCell(null);
          return;
        default:
          return;
      }

      setFocusedCell({ rowIndex: nextRow, colIndex: nextCol });
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingCell, focusedCell, rows, visibleProperties]);

  // Column header sort toggle
  const handleHeaderSortClick = useCallback(
    (propertyId: string) => {
      if (!onSortChange) return;
      const currentSorts = sorts ?? [];
      const existing = currentSorts.find((s) => s.propertyId === propertyId);
      if (!existing) {
        onSortChange([...currentSorts, { propertyId, direction: "asc" }]);
      } else if (existing.direction === "asc") {
        onSortChange(
          currentSorts.map((s) =>
            s.propertyId === propertyId ? { ...s, direction: "desc" as const } : s,
          ),
        );
      } else {
        onSortChange(currentSorts.filter((s) => s.propertyId !== propertyId));
      }
    },
    [sorts, onSortChange],
  );

  // Drag reorder handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, rowId: string) => {
      e.dataTransfer.setData("text/plain", rowId);
      e.dataTransfer.effectAllowed = "move";
      setDraggingRowId(rowId);
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    setDraggingRowId(null);
    setDropTargetRowId(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, rowId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (rowId !== draggingRowId) {
        setDropTargetRowId(rowId);
      }
    },
    [draggingRowId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetRowId: string) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId && draggedId !== targetRowId) {
        onReorderRow?.(draggedId, targetRowId);
      }
      setDraggingRowId(null);
      setDropTargetRowId(null);
    },
    [onReorderRow],
  );

  // Close aggregation dropdown and context menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (aggregationDropdown && aggDropdownRef.current && !aggDropdownRef.current.contains(e.target as Node)) {
        setAggregationDropdown(null);
      }
      if (contextMenu) {
        setContextMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [aggregationDropdown, contextMenu]);

  // Row context menu handler
  const handleRowContextMenu = useCallback(
    (e: React.MouseEvent, rowId: string, pageId: string) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, rowId, pageId });
    },
    [],
  );

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) =>
      rowHeight === "auto" && rows[index]
        ? getRowHeight(rows[index]!)
        : effectiveRowHeight,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalVirtualHeight = rowVirtualizer.getTotalSize();

  // Column aggregation helpers
  const columnAggregations = useMemo(
    () => viewConfig.columnAggregations ?? {},
    [viewConfig.columnAggregations],
  );

  const getAggregation = useCallback(
    (propId: string): AggregationFunction => {
      return columnAggregations[propId] ?? "none";
    },
    [columnAggregations],
  );

  return (
    <div
      ref={scrollContainerRef}
      className="overflow-auto"
      style={{ maxHeight: "calc(100vh - 200px)" }}
    >
      <div
        className="inline-grid min-w-full"
        style={{ gridTemplateColumns }}
      >
        {/* ── Header Row ─────────────────────────────── */}
        <div
          className="sticky top-0 z-10"
          style={{
            display: "contents",
          }}
        >
          {/* Select all checkbox */}
          <div
            className="sticky top-0 flex items-center justify-center border-b border-r"
            style={{
              backgroundColor: "var(--bg-secondary, #f7f6f3)",
              borderColor: "var(--border-default)",
              height: 33,
            }}
          >
            <input
              type="checkbox"
              checked={rows.length > 0 && rows.every((r) => selectedRowIds.has(r.id))}
              onChange={() => selectAllRows(rows.map((r) => r.id))}
              className="h-3.5 w-3.5 accent-[#2383e2]"
            />
          </div>

          {/* Row number header */}
          <div
            className="sticky top-0 flex items-center justify-center border-b border-r text-xs font-medium"
            style={{
              backgroundColor: "var(--bg-secondary, #f7f6f3)",
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
              height: 33,
            }}
          />

          {visibleProperties.map((property) => {
            const currentSort = sorts?.find((s) => s.propertyId === property.id);
            const isPinned = pinnedSet.has(property.id);
            return (
              <ColumnHeader
                key={property.id}
                property={property}
                width={getColumnWidth(property.id, property.type)}
                sortDirection={currentSort?.direction}
                isPinned={isPinned}
                pinnedOffset={pinnedOffsets[property.id]}
                onSortClick={onSortChange ? () => handleHeaderSortClick(property.id) : undefined}
                onResize={(newWidth) => {
                  setColumnWidths((prev) => ({
                    ...prev,
                    [property.id]: Math.max(MIN_COLUMN_WIDTH, newWidth),
                  }));
                }}
                onTogglePin={() => {
                  const current = viewConfig.pinnedProperties ?? [];
                  const next = isPinned
                    ? current.filter((id) => id !== property.id)
                    : [...current, property.id];
                  const event = new CustomEvent("database:updatePinnedProperties", {
                    detail: { pinnedProperties: next },
                    bubbles: true,
                  });
                  document.dispatchEvent(event);
                }}
              />
            );
          })}

          {/* Add property button in header */}
          <button
            onClick={onAddProperty}
            className="sticky top-0 flex items-center justify-center border-b text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              backgroundColor: "var(--bg-secondary, #f7f6f3)",
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
              height: 33,
            }}
            title="Add a property"
          >
            +
          </button>
        </div>

        {/* ── Virtual Data Rows ─────────────────────── */}
        {/* Spacer before virtual rows */}
        {virtualRows.length > 0 && virtualRows[0]!.start > 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              height: virtualRows[0]!.start,
            }}
          />
        )}

        {virtualRows.map((virtualRow) => {
          const rowIndex = virtualRow.index;
          const row = rows[rowIndex]!;

          return (
            <div
              key={row.id}
              className="group"
              style={{
                display: "contents",
                opacity: draggingRowId === row.id ? 0.4 : 1,
              }}
              onMouseEnter={() => setHoveredRowId(row.id)}
              onMouseLeave={() => setHoveredRowId(null)}
              onContextMenu={(e) => handleRowContextMenu(e, row.id, row.pageId)}
            >
              {/* Drop indicator above this row */}
              {dropTargetRowId === row.id && draggingRowId !== row.id && (
                <div
                  style={{
                    gridColumn: `1 / -1`,
                    height: 2,
                    backgroundColor: "#2383e2",
                  }}
                />
              )}

              {/* Row checkbox */}
              <div
                className="flex items-center justify-center border-b border-r"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor:
                    selectedRowIds.has(row.id)
                      ? "#2383e210"
                      : hoveredRowId === row.id
                      ? "var(--bg-hover)"
                      : "var(--bg-primary)",
                  height: effectiveRowHeight,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedRowIds.has(row.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleRowSelection(row.id);
                  }}
                  className="h-3.5 w-3.5 accent-[#2383e2]"
                />
              </div>

              {/* Row number / drag handle */}
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, row.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, row.id)}
                onDrop={(e) => handleDrop(e, row.id)}
                className="flex items-center justify-center border-b border-r text-[10px] transition-colors"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor:
                    hoveredRowId === row.id
                      ? "var(--bg-hover)"
                      : "var(--bg-primary)",
                  color: "var(--text-tertiary)",
                  height: effectiveRowHeight,
                  cursor: "grab",
                }}
              >
                {hoveredRowId === row.id ? (
                  <span style={{ fontSize: "10px", letterSpacing: "2px", lineHeight: 1 }}>&#x2807;</span>
                ) : (
                  ""
                )}
              </div>

              {visibleProperties.map((property, colIndex) => {
                const isEditing =
                  editingCell?.rowId === row.id &&
                  editingCell?.propertyId === property.id;
                const isFocused =
                  focusedCell?.rowIndex === rowIndex &&
                  focusedCell?.colIndex === colIndex &&
                  !isEditing;
                const value = property.type === "title"
                  ? (row.page?.title ?? row.values[property.id])
                  : row.values[property.id];
                const isPinned = pinnedSet.has(property.id);

                return (
                  <div
                    key={property.id}
                    onDragOver={(e) => handleDragOver(e, row.id)}
                    onDrop={(e) => handleDrop(e, row.id)}
                    className="flex items-center border-b border-r px-2 text-sm transition-colors"
                    style={{
                      borderColor: "var(--border-default)",
                      backgroundColor:
                        selectedRowIds.has(row.id)
                          ? "#2383e210"
                          : hoveredRowId === row.id
                          ? "var(--bg-hover)"
                          : "var(--bg-primary)",
                      color: "var(--text-primary)",
                      height: effectiveRowHeight,
                      overflow: "hidden",
                      cursor:
                        property.type === "title" ? "pointer" : "default",
                      outline: isFocused ? "2px solid #2383e2" : "none",
                      outlineOffset: -2,
                      ...(isPinned ? {
                        position: "sticky" as const,
                        left: pinnedOffsets[property.id],
                        zIndex: 5,
                      } : {}),
                    }}
                    onClick={() => {
                      if (property.type === "title") {
                        onRowClick(row.pageId);
                      } else {
                        handleCellClick(row.id, property.id, property.type, rowIndex, colIndex);
                      }
                    }}
                  >
                    {isEditing ? (
                      <CellEditor
                        value={value}
                        type={property.type}
                        config={property.config}
                        onChange={(v) =>
                          handleCellChange(row.id, property.id, v)
                        }
                        onClose={handleCellClose}
                        onNavigate={(e) =>
                          handleCellNavigate(row.id, property.id, e)
                        }
                      />
                    ) : (
                      <div
                        className="w-full"
                        style={{
                          overflow: rowHeight === "auto" ? "visible" : "hidden",
                          textOverflow: rowHeight === "auto" ? "unset" : "ellipsis",
                          whiteSpace: rowHeight === "auto" ? "normal" : "nowrap",
                        }}
                      >
                        <CellRenderer
                          value={value}
                          type={property.type}
                          config={property.config}
                          rowId={row.id}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Empty cell under the "+" column */}
              <div
                onDragOver={(e) => handleDragOver(e, row.id)}
                onDrop={(e) => handleDrop(e, row.id)}
                className="border-b transition-colors"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor:
                    hoveredRowId === row.id
                      ? "var(--bg-hover)"
                      : "var(--bg-primary)",
                  height: effectiveRowHeight,
                }}
              />
            </div>
          );
        })}

        {/* Spacer after virtual rows */}
        {virtualRows.length > 0 && (
          (() => {
            const lastItem = virtualRows[virtualRows.length - 1]!;
            const remaining = totalVirtualHeight - lastItem.end;
            return remaining > 0 ? (
              <div
                style={{
                  gridColumn: "1 / -1",
                  height: remaining,
                }}
              />
            ) : null;
          })()
        )}

        {/* ── Summary Row ──────────────────────────── */}
        <div style={{ display: "contents" }}>
          {/* Empty cell for checkbox column */}
          <div
            className="border-t"
            style={{ borderColor: "var(--border-divider)", height: 36 }}
          />
          {/* Empty cell for row number column */}
          <div
            className="border-t"
            style={{
              borderColor: "var(--border-divider)",
              height: 36,
            }}
          />
          {visibleProperties.map((prop) => {
            const aggFn = getAggregation(prop.id);
            const aggregate = calculateAggregate(rows, prop, aggFn);
            const isOpen = aggregationDropdown === prop.id;

            return (
              <div
                key={prop.id}
                className="relative flex items-center border-t px-3"
                style={{
                  borderColor: "var(--border-divider)",
                  fontSize: "12px",
                  color: "var(--text-tertiary)",
                  height: 36,
                  justifyContent: prop.type === "title" ? "flex-start" : "flex-end",
                }}
              >
                {prop.type === "title" ? (
                  <span>Count: {rows.length}</span>
                ) : (
                  <button
                    onClick={() => setAggregationDropdown(isOpen ? null : prop.id)}
                    className="rounded px-1 py-0.5 text-xs transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {aggregate || (aggFn === "none" ? "Calculate" : aggFn)}
                  </button>
                )}

                {/* Aggregation dropdown */}
                {isOpen && prop.type !== "title" && (
                  <div
                    ref={aggDropdownRef}
                    className="absolute bottom-full right-0 z-50 mb-1 min-w-[140px] rounded-md border shadow-lg"
                    style={{
                      backgroundColor: "var(--bg-primary)",
                      borderColor: "var(--border-default)",
                    }}
                  >
                    {AGGREGATION_OPTIONS.map((opt) => {
                      // Only show numeric aggregations for number type
                      if (
                        ["sum", "average", "median", "min", "max", "range"].includes(opt.value) &&
                        prop.type !== "number"
                      ) {
                        return null;
                      }
                      return (
                        <button
                          key={opt.value}
                          onClick={() => {
                            // We store the aggregation preference - caller persists via viewConfig
                            // For now, update local state; the toolbar onUpdateViewConfig would persist it
                            setAggregationDropdown(null);
                            // Dispatch a custom event that the parent can listen to
                            const event = new CustomEvent("database:updateAggregation", {
                              detail: { propertyId: prop.id, aggregation: opt.value },
                              bubbles: true,
                            });
                            document.dispatchEvent(event);
                          }}
                          className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--bg-hover)]"
                          style={{
                            color: aggFn === opt.value ? "#2383e2" : "var(--text-primary)",
                          }}
                        >
                          <span>{opt.label}</span>
                          {aggFn === opt.value && (
                            <span className="text-xs">&#10003;</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {/* Empty cell under the "+" column */}
          <div
            className="border-t"
            style={{
              borderColor: "var(--border-divider)",
              height: 36,
            }}
          />
        </div>

        {/* ── "+ New" row ────────────────────────────── */}
        <div style={{ display: "contents" }}>
          <div style={{ height: 33 }} />
          <div style={{ height: 33 }} />
          <button
            onClick={onAddRow}
            className="flex items-center gap-1 px-2 text-sm transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              color: "var(--text-secondary)",
              height: 33,
              gridColumn: `3 / ${visibleProperties.length + 3}`,
            }}
          >
            <span className="text-base leading-none">+</span>
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Row context menu */}
      {contextMenu && (
        <div
          className="fixed z-[100] min-w-[160px] rounded-md border py-1 shadow-lg"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-default)",
          }}
        >
          <button
            onClick={() => {
              onRowClick(contextMenu.pageId);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-primary)" }}
          >
            열기
          </button>
          {onDuplicateRow && (
            <button
              onClick={() => {
                onDuplicateRow(contextMenu.rowId);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-primary)" }}
            >
              복제
            </button>
          )}
          {onDeleteRow && (
            <>
              <div
                className="my-1 border-t"
                style={{ borderColor: "var(--border-default)" }}
              />
              <button
                onClick={() => {
                  onDeleteRow(contextMenu.rowId);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                삭제
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Aggregate Calculation ──────────────────────────────────

function computeAggregation(
  fn: AggregationFunction,
  rows: RowData[],
  propertyId: string,
): string {
  if (fn === "none") return "";

  const values = rows.map((r) => {
    const vals = (r.values as Record<string, unknown>) ?? {};
    return vals[propertyId];
  });

  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== "");
  const numericValues = nonEmpty
    .map((v) => (typeof v === "number" ? v : parseFloat(String(v))))
    .filter((n) => !isNaN(n));

  switch (fn) {
    case "count":
      return String(rows.length);
    case "count_values":
      return String(nonEmpty.length);
    case "count_unique":
      return String(new Set(nonEmpty.map(String)).size);
    case "count_empty":
      return String(values.length - nonEmpty.length);
    case "count_not_empty":
      return String(nonEmpty.length);
    case "percent_empty":
      return values.length > 0
        ? `${(((values.length - nonEmpty.length) / values.length) * 100).toFixed(1)}%`
        : "0%";
    case "percent_not_empty":
      return values.length > 0
        ? `${((nonEmpty.length / values.length) * 100).toFixed(1)}%`
        : "0%";
    case "sum":
      return numericValues.reduce((a, b) => a + b, 0).toLocaleString();
    case "average":
      return numericValues.length > 0
        ? (numericValues.reduce((a, b) => a + b, 0) / numericValues.length).toFixed(2)
        : "-";
    case "median": {
      if (numericValues.length === 0) return "-";
      const sorted = [...numericValues].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0
        ? String(sorted[mid])
        : ((sorted[mid - 1]! + sorted[mid]!) / 2).toFixed(2);
    }
    case "min":
      return numericValues.length > 0 ? String(Math.min(...numericValues)) : "-";
    case "max":
      return numericValues.length > 0 ? String(Math.max(...numericValues)) : "-";
    case "range":
      return numericValues.length > 0
        ? String(Math.max(...numericValues) - Math.min(...numericValues))
        : "-";
    default:
      return "";
  }
}

function calculateAggregate(
  rows: RowData[],
  prop: DatabaseData["properties"][number],
  aggFn: AggregationFunction,
): string {
  if (prop.type === "title") return "";
  if (aggFn === "none") {
    // Legacy fallback behavior
    if (prop.type === "number") {
      const values = rows
        .map((r) => Number(r.values[prop.id]))
        .filter((v) => !isNaN(v));
      if (values.length === 0) return "";
      const sum = values.reduce((a, b) => a + b, 0);
      return `Sum: ${sum.toLocaleString()}`;
    }
    if (prop.type === "checkbox") {
      const checked = rows.filter((r) => r.values[prop.id] === true).length;
      return `${checked}/${rows.length}`;
    }
    return "";
  }

  const label = AGGREGATION_OPTIONS.find((o) => o.value === aggFn)?.label ?? aggFn;
  const result = computeAggregation(aggFn, rows, prop.id);
  return result ? `${label}: ${result}` : "";
}

// ── Column Header with Resize + Sort ───────────────────────

function ColumnHeader({
  property,
  width,
  sortDirection,
  isPinned,
  pinnedOffset,
  onSortClick,
  onResize,
  onTogglePin,
}: {
  property: DatabaseData["properties"][number];
  width: number;
  sortDirection?: "asc" | "desc";
  isPinned?: boolean;
  pinnedOffset?: number;
  onSortClick?: () => void;
  onResize: (newWidth: number) => void;
  onTogglePin?: () => void;
}) {
  const headerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;
      startWidth.current = width;

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX.current;
        onResize(startWidth.current + delta);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [width, onResize],
  );

  return (
    <div
      ref={headerRef}
      className="sticky top-0 flex items-center gap-1.5 border-b border-r px-2 text-xs font-medium select-none"
      style={{
        backgroundColor: "var(--bg-secondary, #f7f6f3)",
        borderColor: "var(--border-default)",
        color: "var(--text-secondary)",
        height: 33,
        position: isPinned ? "sticky" : "relative",
        cursor: onSortClick ? "pointer" : "default",
        zIndex: isPinned ? 15 : 10,
        ...(isPinned && pinnedOffset != null ? { left: pinnedOffset } : {}),
      }}
      onClick={onSortClick}
    >
      <span className="shrink-0 opacity-60">
        {propertyTypeIcon(property.type)}
      </span>
      <span className="truncate">{property.name}</span>
      {sortDirection === "asc" && (
        <span className="shrink-0 text-[10px] text-[#2383e2]">{"\u25B2"}</span>
      )}
      {sortDirection === "desc" && (
        <span className="shrink-0 text-[10px] text-[#2383e2]">{"\u25BC"}</span>
      )}
      {isPinned && (
        <span className="shrink-0 text-[10px] text-[#2383e2]" title="Pinned">&#x1F4CC;</span>
      )}

      {/* Pin toggle button (visible on hover) */}
      {onTogglePin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className="ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--bg-hover)]"
          title={isPinned ? "Unpin column" : "Pin column"}
          style={{ fontSize: "10px" }}
        >
          {isPinned ? "Unpin" : "Pin"}
        </button>
      )}

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 z-20 h-full cursor-col-resize"
        style={{ width: 4 }}
      >
        <div
          className="h-full transition-opacity hover:opacity-100"
          style={{
            width: 2,
            marginLeft: 1,
            backgroundColor: "#2383e2",
            opacity: 0,
          }}
        />
      </div>
    </div>
  );
}
