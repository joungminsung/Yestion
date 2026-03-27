"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { CellRenderer } from "../cell-renderer";
import { CellEditor } from "../cell-editor";
import type { DatabaseData, RowData, ViewConfig, PropertyType } from "@/types/database";

type TableViewProps = {
  databaseId: string;
  properties: DatabaseData["properties"];
  rows: RowData[];
  viewConfig: ViewConfig;
  onAddRow: () => void;
  onUpdateRow: (rowId: string, propertyId: string, value: unknown) => void;
  onAddProperty: () => void;
  onRowClick: (pageId: string) => void;
};

const DEFAULT_COLUMN_WIDTH = 200;
const MIN_COLUMN_WIDTH = 100;
const TITLE_COLUMN_WIDTH = 260;
const ROW_NUMBER_WIDTH = 32;

/** Map property type to a small icon character */
function propertyTypeIcon(type: PropertyType): string {
  switch (type) {
    case "title": return "Aa";
    case "text": return "T";
    case "number": return "#";
    case "select": return "\u25BC";
    case "multi_select": return "\u25A4";
    case "date": return "\uD83D\uDCC5";
    case "person": return "\uD83D\uDC64";
    case "file": return "\uD83D\uDCCE";
    case "checkbox": return "\u2611";
    case "url": return "\uD83D\uDD17";
    case "email": return "@";
    case "phone": return "\uD83D\uDCDE";
    case "status": return "\u25CF";
    case "created_time":
    case "last_edited_time": return "\uD83D\uDD52";
    case "created_by":
    case "last_edited_by": return "\uD83D\uDC64";
    case "formula": return "f";
    case "relation": return "\u2194";
    case "rollup": return "\u2211";
    default: return "?";
  }
}

export function TableView({
  properties,
  rows,
  viewConfig,
  onAddRow,
  onUpdateRow,
  onAddProperty,
  onRowClick,
}: TableViewProps) {
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    propertyId: string;
  } | null>(null);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    viewConfig.propertyWidths ?? {},
  );

  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

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
    // Add the "+" column at the end
    return `${ROW_NUMBER_WIDTH}px ${cols.join(" ")} 44px`;
  }, [visibleProperties, getColumnWidth]);

  const handleCellClick = useCallback(
    (rowId: string, propertyId: string, type: PropertyType) => {
      // Read-only types
      const readOnlyTypes: PropertyType[] = [
        "created_time",
        "created_by",
        "last_edited_time",
        "last_edited_by",
        "formula",
        "rollup",
      ];
      if (readOnlyTypes.includes(type)) return;
      setEditingCell({ rowId, propertyId });
    },
    [],
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

  return (
    <div className="overflow-x-auto">
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

          {visibleProperties.map((property) => (
            <ColumnHeader
              key={property.id}
              property={property}
              width={getColumnWidth(property.id, property.type)}
              onResize={(newWidth) => {
                setColumnWidths((prev) => ({
                  ...prev,
                  [property.id]: Math.max(MIN_COLUMN_WIDTH, newWidth),
                }));
              }}
            />
          ))}

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
        {rows.map((row) => (
          <div
            key={row.id}
            className="group"
            style={{ display: "contents" }}
            onMouseEnter={() => setHoveredRowId(row.id)}
            onMouseLeave={() => setHoveredRowId(null)}
          >
            {/* Row number / grab handle */}
            <div
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
              {hoveredRowId === row.id ? "\u2630" : ""}
            </div>

            {visibleProperties.map((property) => {
              const isEditing =
                editingCell?.rowId === row.id &&
                editingCell?.propertyId === property.id;
              const value = property.type === "title"
                ? (row.page?.title ?? row.values[property.id])
                : row.values[property.id];

              return (
                <div
                  key={property.id}
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
                  }}
                  onClick={() => {
                    if (property.type === "title") {
                      onRowClick(row.pageId);
                    } else {
                      handleCellClick(row.id, property.id, property.type);
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

// ── Column Header with Resize ─────────────────────────────

function ColumnHeader({
  property,
  width,
  onResize,
}: {
  property: DatabaseData["properties"][number];
  width: number;
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
      }}
    >
      <span className="shrink-0 opacity-60">
        {propertyTypeIcon(property.type)}
      </span>
      <span className="truncate">{property.name}</span>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
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
