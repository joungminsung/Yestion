"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { CellRenderer } from "../cell-renderer";
import { CellEditor } from "../cell-editor";
import { propertyTypeIcon } from "../property-type-icon";
import type { DatabaseData, RowData, ViewConfig, PropertyType, SortRule } from "@/types/database";

type TableViewProps = {
  databaseId: string;
  properties: DatabaseData["properties"];
  rows: RowData[];
  viewConfig: ViewConfig;
  onAddRow: () => void;
  onUpdateRow: (rowId: string, propertyId: string, value: unknown) => void;
  onAddProperty: () => void;
  onRowClick: (pageId: string) => void;
  sorts?: SortRule[];
  onSortChange?: (sorts: SortRule[]) => void;
  onReorderRow?: (draggedRowId: string, targetRowId: string) => void;
};

const DEFAULT_COLUMN_WIDTH = 200;
const MIN_COLUMN_WIDTH = 100;
const TITLE_COLUMN_WIDTH = 260;
const ROW_NUMBER_WIDTH = 32;

const READ_ONLY_TYPES: PropertyType[] = [
  "created_time",
  "created_by",
  "last_edited_time",
  "last_edited_by",
  "formula",
  "rollup",
];

export function TableView({
  properties,
  rows,
  viewConfig,
  onAddRow,
  onUpdateRow,
  onAddProperty,
  onRowClick,
  sorts,
  onSortChange,
  onReorderRow,
}: TableViewProps) {
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

  const tableRef = useRef<HTMLDivElement>(null);

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

  const gridTemplateColumns = useMemo(() => {
    const cols = visibleProperties.map(
      (p) => `${getColumnWidth(p.id, p.type)}px`,
    );
    return `${ROW_NUMBER_WIDTH}px ${cols.join(" ")} 44px`;
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

  return (
    <div className="overflow-x-auto" ref={tableRef}>
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
            return (
              <ColumnHeader
                key={property.id}
                property={property}
                width={getColumnWidth(property.id, property.type)}
                sortDirection={currentSort?.direction}
                onSortClick={onSortChange ? () => handleHeaderSortClick(property.id) : undefined}
                onResize={(newWidth) => {
                  setColumnWidths((prev) => ({
                    ...prev,
                    [property.id]: Math.max(MIN_COLUMN_WIDTH, newWidth),
                  }));
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

        {/* ── Data Rows ─────────────────────────────── */}
        {rows.map((row, rowIndex) => (
          <div
            key={row.id}
            className="group"
            style={{
              display: "contents",
              opacity: draggingRowId === row.id ? 0.4 : 1,
            }}
            onMouseEnter={() => setHoveredRowId(row.id)}
            onMouseLeave={() => setHoveredRowId(null)}
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
                height: 33,
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

              return (
                <div
                  key={property.id}
                  onDragOver={(e) => handleDragOver(e, row.id)}
                  onDrop={(e) => handleDrop(e, row.id)}
                  className="flex items-center border-b border-r px-2 text-sm transition-colors"
                  style={{
                    borderColor: "var(--border-default)",
                    backgroundColor:
                      hoveredRowId === row.id
                        ? "var(--bg-hover)"
                        : "var(--bg-primary)",
                    color: "var(--text-primary)",
                    height: 33,
                    overflow: "hidden",
                    cursor:
                      property.type === "title" ? "pointer" : "default",
                    outline: isFocused ? "2px solid #2383e2" : "none",
                    outlineOffset: -2,
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
                    <div className="w-full truncate">
                      <CellRenderer
                        value={value}
                        type={property.type}
                        config={property.config}
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
                height: 33,
              }}
            />
          </div>
        ))}

        {/* ── "+ New" row ────────────────────────────── */}
        <div style={{ display: "contents" }}>
          <div style={{ height: 33 }} />
          <button
            onClick={onAddRow}
            className="flex items-center gap-1 px-2 text-sm transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              color: "var(--text-secondary)",
              height: 33,
              gridColumn: `2 / ${visibleProperties.length + 2}`,
            }}
          >
            <span className="text-base leading-none">+</span>
            <span>New</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Column Header with Resize + Sort ───────────────────────

function ColumnHeader({
  property,
  width,
  sortDirection,
  onSortClick,
  onResize,
}: {
  property: DatabaseData["properties"][number];
  width: number;
  sortDirection?: "asc" | "desc";
  onSortClick?: () => void;
  onResize: (newWidth: number) => void;
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
        position: "relative",
        cursor: onSortClick ? "pointer" : "default",
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
