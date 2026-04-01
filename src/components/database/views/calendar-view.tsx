"use client";

import { useState, useMemo, useCallback } from "react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import type { DatabaseData, RowData, ViewConfig } from "@/types/database";

type CalendarViewProps = {
  databaseId: string;
  properties: DatabaseData["properties"];
  rows: RowData[];
  viewConfig: ViewConfig;
  onAddRow: (defaultValues?: Record<string, unknown>) => void;
  onUpdateRow: (rowId: string, propertyId: string, value: unknown) => void;
  onRowClick: (pageId: string) => void;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({
  properties,
  rows,
  viewConfig,
  onAddRow,
  onUpdateRow,
  onRowClick,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Find the date property
  const dateProperty = useMemo(() => {
    if (viewConfig.calendarDateProperty) {
      return properties.find((p) => p.id === viewConfig.calendarDateProperty);
    }
    return properties.find((p) => p.type === "date");
  }, [properties, viewConfig.calendarDateProperty]);

  // Calendar grid days (including padding from prev/next months)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  // Map rows to dates
  const rowsByDate = useMemo(() => {
    const map = new Map<string, RowData[]>();
    if (!dateProperty) return map;

    for (const row of rows) {
      const dateVal = row.values[dateProperty.id];
      if (!dateVal) continue;
      const date = new Date(String(dateVal));
      if (isNaN(date.getTime())) continue;
      const key = format(date, "yyyy-MM-dd");
      const existing = map.get(key) ?? [];
      existing.push(row);
      map.set(key, existing);
    }
    return map;
  }, [rows, dateProperty]);

  const handlePrevMonth = useCallback(() => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  }, []);

  const handleDayClick = useCallback(
    (day: Date) => {
      if (!dateProperty) return;
      onAddRow({ [dateProperty.id]: format(day, "yyyy-MM-dd") });
    },
    [dateProperty, onAddRow],
  );

  // Drag and drop handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, rowId: string) => {
      e.dataTransfer.setData("text/plain", rowId);
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, dateKey: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverDate(dateKey);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dateKey: string) => {
      e.preventDefault();
      setDragOverDate(null);
      if (!dateProperty) return;

      const rowId = e.dataTransfer.getData("text/plain");
      if (!rowId) return;

      onUpdateRow(rowId, dateProperty.id, dateKey);
    },
    [dateProperty, onUpdateRow],
  );

  if (!dateProperty) {
    return (
      <div
        className="flex items-center justify-center py-12 text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
        날짜 속성을 선택하세요
      </div>
    );
  }

  const today = new Date();

  return (
    <div className="flex flex-col p-3">
      {/* Header: month/year + navigation */}
      <div className="mb-3 flex items-center justify-between">
        <h2
          className="text-lg font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="flex gap-1">
          <button
            onClick={handlePrevMonth}
            className="rounded px-2 py-1 text-sm transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-secondary)" }}
          >
            &lsaquo;
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="rounded px-2 py-1 text-sm transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-secondary)" }}
          >
            Today
          </button>
          <button
            onClick={handleNextMonth}
            className="rounded px-2 py-1 text-sm transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-secondary)" }}
          >
            &rsaquo;
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div
        className="grid grid-cols-7 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1.5 text-center text-xs font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayRows = rowsByDate.get(key) ?? [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, today);
          const isDragOver = dragOverDate === key;

          return (
            <div
              key={key}
              className="group min-h-[100px] border-b border-r p-1 transition-colors"
              style={{
                borderColor: "var(--border-default)",
                backgroundColor: isDragOver
                  ? "rgba(35, 131, 226, 0.1)"
                  : isCurrentMonth
                    ? "var(--bg-primary)"
                    : "var(--bg-secondary, #f7f6f3)",
                ...(isDragOver ? { outline: "2px solid #2383e2", outlineOffset: -2 } : {}),
              }}
              onDragOver={(e) => handleDragOver(e, key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, key)}
            >
              {/* Day number */}
              <div className="mb-0.5 flex items-center justify-between">
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs"
                  style={{
                    color: isCurrentMonth
                      ? "var(--text-primary)"
                      : "var(--text-tertiary)",
                    backgroundColor: isToday ? "#2383e2" : "transparent",
                    ...(isToday ? { color: "#ffffff" } : {}),
                    fontWeight: isToday ? 600 : 400,
                  }}
                >
                  {format(day, "d")}
                </span>
                {/* Click empty area to add */}
                {dayRows.length === 0 && (
                  <button
                    onClick={() => handleDayClick(day)}
                    className="h-5 w-5 rounded text-xs opacity-0 transition-opacity hover:bg-[var(--bg-hover)] group-hover:opacity-100"
                    style={{ color: "var(--text-tertiary)" }}
                    title="Add row"
                  >
                    +
                  </button>
                )}
              </div>

              {/* Row cards */}
              <div className="flex flex-col gap-0.5">
                {dayRows.map((row) => {
                  const title = row.page?.title ?? "Untitled";
                  const icon = row.page?.icon;
                  return (
                    <button
                      key={row.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, row.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRowClick(row.pageId);
                      }}
                      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-[var(--bg-hover)]"
                      style={{ color: "var(--text-primary)", cursor: "grab" }}
                    >
                      {icon && (
                        <span className="shrink-0 text-[10px]">{icon}</span>
                      )}
                      <span className="truncate">{title}</span>
                    </button>
                  );
                })}
              </div>

              {/* Click day to add when there are already rows */}
              {dayRows.length > 0 && (
                <button
                  onClick={() => handleDayClick(day)}
                  className="mt-0.5 w-full rounded py-0.5 text-xs opacity-0 transition-opacity hover:bg-[var(--bg-hover)] [*:hover>&]:opacity-100"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
