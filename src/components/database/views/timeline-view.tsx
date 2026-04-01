"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import {
  eachDayOfInterval,
  format,
  addDays,
  subDays,
  differenceInDays,
  startOfDay,
  isSameDay,
} from "date-fns";
import type { DatabaseData, RowData, ViewConfig } from "@/types/database";

type TimelineViewProps = {
  databaseId: string;
  properties: DatabaseData["properties"];
  rows: RowData[];
  viewConfig: ViewConfig;
  onAddRow: () => void;
  onUpdateRow: (rowId: string, propertyId: string, value: unknown) => void;
  onRowClick: (pageId: string) => void;
};

const DAY_WIDTH = 40;
const ROW_HEIGHT = 36;
const SIDEBAR_WIDTH = 220;
const HEADER_HEIGHT = 48;
const VISIBLE_DAYS = 30;

export function TimelineView({
  properties,
  rows,
  viewConfig,
  onAddRow,
  onUpdateRow,
  onRowClick,
}: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Determine start/end date properties
  const startProperty = useMemo(() => {
    if (viewConfig.timelineStartProperty) {
      return properties.find((p) => p.id === viewConfig.timelineStartProperty);
    }
    return properties.find((p) => p.type === "date");
  }, [properties, viewConfig.timelineStartProperty]);

  const endProperty = useMemo(() => {
    if (viewConfig.timelineEndProperty) {
      return properties.find((p) => p.id === viewConfig.timelineEndProperty);
    }
    return undefined;
  }, [properties, viewConfig.timelineEndProperty]);

  // Timeline range: default to today +/- some days
  const [rangeStart, setRangeStart] = useState(() => {
    return startOfDay(subDays(new Date(), 3));
  });

  const rangeEnd = useMemo(
    () => addDays(rangeStart, VISIBLE_DAYS - 1),
    [rangeStart],
  );

  const timelineDays = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd],
  );

  // Parse row dates
  const rowDates = useMemo(() => {
    const result: {
      row: RowData;
      start: Date | null;
      end: Date | null;
    }[] = [];

    for (const row of rows) {
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (startProperty) {
        const val = row.values[startProperty.id];
        if (val) {
          const d = new Date(String(val));
          if (!isNaN(d.getTime())) startDate = startOfDay(d);
        }
      }

      if (endProperty) {
        const val = row.values[endProperty.id];
        if (val) {
          const d = new Date(String(val));
          if (!isNaN(d.getTime())) endDate = startOfDay(d);
        }
      }

      result.push({ row, start: startDate, end: endDate });
    }

    return result;
  }, [rows, startProperty, endProperty]);

  const handlePrev = useCallback(() => {
    setRangeStart((prev) => subDays(prev, 7));
  }, []);

  const handleNext = useCallback(() => {
    setRangeStart((prev) => addDays(prev, 7));
  }, []);

  const handleToday = useCallback(() => {
    setRangeStart(startOfDay(subDays(new Date(), 3)));
  }, []);

  if (!startProperty) {
    return (
      <div
        className="flex items-center justify-center py-12 text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
        날짜 속성을 선택하세요
      </div>
    );
  }

  const totalWidth = timelineDays.length * DAY_WIDTH;
  const today = startOfDay(new Date());

  return (
    <div className="flex flex-col">
      {/* Navigation */}
      <div
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--border-default)" }}
      >
        <button
          onClick={handlePrev}
          className="rounded px-2 py-1 text-sm transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--text-secondary)" }}
        >
          &lsaquo; Week
        </button>
        <button
          onClick={handleToday}
          className="rounded px-2 py-1 text-sm transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--text-secondary)" }}
        >
          Today
        </button>
        <button
          onClick={handleNext}
          className="rounded px-2 py-1 text-sm transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--text-secondary)" }}
        >
          Week &rsaquo;
        </button>
        <span
          className="ml-2 text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {format(rangeStart, "MMM d")} &ndash; {format(rangeEnd, "MMM d, yyyy")}
        </span>
      </div>

      {/* Timeline body */}
      <div className="flex overflow-hidden">
        {/* Left sidebar: row names */}
        <div
          className="shrink-0 border-r"
          style={{
            width: SIDEBAR_WIDTH,
            borderColor: "var(--border-default)",
          }}
        >
          {/* Sidebar header */}
          <div
            className="flex items-center border-b px-3 text-xs font-medium"
            style={{
              height: HEADER_HEIGHT,
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
              backgroundColor: "var(--bg-secondary, #f7f6f3)",
            }}
          >
            Name
          </div>

          {/* Row labels */}
          {rowDates.map(({ row }) => {
            const title = row.page?.title ?? "Untitled";
            const icon = row.page?.icon;
            return (
              <div
                key={row.id}
                className="flex cursor-pointer items-center gap-1.5 border-b px-3 text-sm transition-colors hover:bg-[var(--bg-hover)]"
                style={{
                  height: ROW_HEIGHT,
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                }}
                onClick={() => onRowClick(row.pageId)}
              >
                {icon && (
                  <span className="shrink-0 text-xs">{icon}</span>
                )}
                <span className="truncate">{title}</span>
              </div>
            );
          })}

          {/* Add row */}
          <button
            onClick={onAddRow}
            className="flex w-full items-center gap-1 px-3 text-sm transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              height: ROW_HEIGHT,
              color: "var(--text-secondary)",
            }}
          >
            <span className="text-base leading-none">+</span>
            <span>New</span>
          </button>
        </div>

        {/* Right area: scrollable timeline */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto"
        >
          <div style={{ width: totalWidth, minWidth: "100%" }}>
            {/* Date header row */}
            <div
              className="flex border-b"
              style={{
                height: HEADER_HEIGHT,
                borderColor: "var(--border-default)",
                backgroundColor: "var(--bg-secondary, #f7f6f3)",
              }}
            >
              {timelineDays.map((day) => {
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const isTodayCol = isSameDay(day, today);
                return (
                  <div
                    key={day.toISOString()}
                    className="flex shrink-0 flex-col items-center justify-center border-r text-xs"
                    style={{
                      width: DAY_WIDTH,
                      borderColor: "var(--border-default)",
                      color: isTodayCol
                        ? "#2383e2"
                        : isWeekend
                          ? "var(--text-tertiary)"
                          : "var(--text-secondary)",
                      fontWeight: isTodayCol ? 600 : 400,
                    }}
                  >
                    <span>{format(day, "EEE")}</span>
                    <span>{format(day, "d")}</span>
                  </div>
                );
              })}
            </div>

            {/* Row bars */}
            {rowDates.map(({ row, start, end }) => (
              <TimelineRow
                key={row.id}
                row={row}
                startDate={start}
                endDate={end}
                rangeStart={rangeStart}
                timelineDays={timelineDays}
                onRowClick={onRowClick}
                onUpdateRow={onUpdateRow}
                startPropertyId={startProperty.id}
                endPropertyId={endProperty?.id ?? null}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Timeline Row Bar ────────────────────────────────────────

function TimelineRow({
  row,
  startDate,
  endDate,
  rangeStart,
  timelineDays,
  onRowClick,
  onUpdateRow,
  startPropertyId,
  endPropertyId,
}: {
  row: RowData;
  startDate: Date | null;
  endDate: Date | null;
  rangeStart: Date;
  timelineDays: Date[];
  onRowClick: (pageId: string) => void;
  onUpdateRow: (rowId: string, propertyId: string, value: unknown) => void;
  startPropertyId: string;
  endPropertyId: string | null;
}) {
  const [dragTooltip, setDragTooltip] = useState<string | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
  const dragStateRef = useRef<{
    type: "start" | "end" | "move";
    initialMouseX: number;
    initialStartDate: Date;
    initialEndDate: Date | null;
    initialBarLeft: number;
    initialBarWidth: number;
  } | null>(null);

  // Local override during drag
  const [dragOffset, setDragOffset] = useState<{
    startDays: number;
    endDays: number;
  } | null>(null);

  // Calculate bar position
  const barStyle = useMemo(() => {
    if (!startDate) return null;

    let effectiveStart = startDate;
    let effectiveEnd = endDate;

    if (dragOffset) {
      effectiveStart = addDays(startDate, dragOffset.startDays);
      if (endDate) {
        effectiveEnd = addDays(endDate, dragOffset.endDays);
      }
    }

    const offsetDays = differenceInDays(effectiveStart, rangeStart);
    const left = offsetDays * DAY_WIDTH;

    if (effectiveEnd && !isSameDay(effectiveStart, effectiveEnd)) {
      const duration = differenceInDays(effectiveEnd, effectiveStart) + 1;
      const width = Math.max(duration * DAY_WIDTH, DAY_WIDTH);
      return { left, width, isDot: false };
    }

    // Single-day dot
    return { left: left + DAY_WIDTH / 2 - 6, width: 12, isDot: true };
  }, [startDate, endDate, rangeStart, dragOffset]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, type: "start" | "end" | "move") => {
      if (!startDate) return;
      e.preventDefault();
      e.stopPropagation();

      const offsetDays = differenceInDays(startDate, rangeStart);
      const barLeft = offsetDays * DAY_WIDTH;
      let barWidth = DAY_WIDTH;
      if (endDate && !isSameDay(startDate, endDate)) {
        barWidth = (differenceInDays(endDate, startDate) + 1) * DAY_WIDTH;
      }

      dragStateRef.current = {
        type,
        initialMouseX: e.clientX,
        initialStartDate: startDate,
        initialEndDate: endDate,
        initialBarLeft: barLeft,
        initialBarWidth: barWidth,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragStateRef.current) return;
        const state = dragStateRef.current;
        const deltaX = ev.clientX - state.initialMouseX;
        const deltaDays = Math.round(deltaX / DAY_WIDTH);

        let startDays = 0;
        let endDays = 0;

        if (state.type === "start") {
          startDays = deltaDays;
          // Prevent start going past end
          if (state.initialEndDate) {
            const maxStartDays = differenceInDays(state.initialEndDate, state.initialStartDate);
            if (startDays > maxStartDays) startDays = maxStartDays;
          }
          const newStart = addDays(state.initialStartDate, startDays);
          setDragTooltip(format(newStart, "MMM d, yyyy"));
        } else if (state.type === "end") {
          endDays = deltaDays;
          // Prevent end going before start
          if (state.initialEndDate) {
            const minEndDays = -differenceInDays(state.initialEndDate, state.initialStartDate);
            if (endDays < minEndDays) endDays = minEndDays;
          }
          const newEnd = addDays(state.initialEndDate ?? state.initialStartDate, endDays);
          setDragTooltip(format(newEnd, "MMM d, yyyy"));
        } else {
          // move - shift both
          startDays = deltaDays;
          endDays = deltaDays;
          const newStart = addDays(state.initialStartDate, startDays);
          const newEnd = state.initialEndDate ? addDays(state.initialEndDate, endDays) : null;
          setDragTooltip(
            newEnd
              ? `${format(newStart, "MMM d")} - ${format(newEnd, "MMM d")}`
              : format(newStart, "MMM d, yyyy"),
          );
        }

        setTooltipX(ev.clientX);
        setDragOffset({ startDays, endDays });
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        if (!dragStateRef.current) return;
        const state = dragStateRef.current;

        // Read final offset from the ref-based calculation
        const finalOffset = { startDays: 0, endDays: 0 };
        // We need to get the current dragOffset - use the last set value
        // The cleanest way is to compute from the final mouse position
        setDragOffset((current) => {
          if (current) {
            finalOffset.startDays = current.startDays;
            finalOffset.endDays = current.endDays;
          }
          return null;
        });

        // Use setTimeout to ensure we read the final offset
        setTimeout(() => {
          if (finalOffset.startDays !== 0) {
            const newStart = addDays(state.initialStartDate, finalOffset.startDays);
            onUpdateRow(row.id, startPropertyId, format(newStart, "yyyy-MM-dd"));
          }
          if (finalOffset.endDays !== 0 && endPropertyId) {
            const baseEnd = state.initialEndDate ?? state.initialStartDate;
            const newEnd = addDays(baseEnd, finalOffset.endDays);
            onUpdateRow(row.id, endPropertyId, format(newEnd, "yyyy-MM-dd"));
          }
        }, 0);

        dragStateRef.current = null;
        setDragTooltip(null);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [startDate, endDate, rangeStart, row.id, onUpdateRow, startPropertyId, endPropertyId],
  );

  const today = startOfDay(new Date());

  return (
    <div
      className="relative border-b"
      style={{
        height: ROW_HEIGHT,
        borderColor: "var(--border-default)",
      }}
    >
      {/* Day column backgrounds */}
      <div className="absolute inset-0 flex">
        {timelineDays.map((day) => {
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const isToday = isSameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className="shrink-0 border-r"
              style={{
                width: DAY_WIDTH,
                borderColor: "var(--border-default)",
                backgroundColor: isToday
                  ? "rgba(35, 131, 226, 0.04)"
                  : isWeekend
                    ? "var(--bg-secondary, #f7f6f3)"
                    : "transparent",
              }}
            />
          );
        })}
      </div>

      {/* Bar */}
      {barStyle && (
        <div
          className="absolute top-1/2 -translate-y-1/2 cursor-pointer transition-opacity hover:opacity-80"
          style={{
            left: barStyle.left,
            width: barStyle.width,
            height: barStyle.isDot ? 12 : 22,
            borderRadius: barStyle.isDot ? "50%" : 4,
            backgroundColor: "#2383e2",
          }}
          onClick={() => onRowClick(row.pageId)}
          title={row.page?.title ?? "Untitled"}
        >
          {!barStyle.isDot && barStyle.width > 60 && (
            <span className="block truncate px-2 text-xs leading-[22px] text-white">
              {row.page?.title ?? "Untitled"}
            </span>
          )}

          {/* Resize handles - only for non-dot bars */}
          {!barStyle.isDot && (
            <>
              {/* Left resize handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-l opacity-0 transition-opacity hover:opacity-100"
                style={{ backgroundColor: "rgba(255,255,255,0.3)" }}
                onMouseDown={(e) => handleResizeStart(e, "start")}
                onClick={(e) => e.stopPropagation()}
              />
              {/* Right resize handle */}
              <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-r opacity-0 transition-opacity hover:opacity-100"
                style={{ backgroundColor: "rgba(255,255,255,0.3)" }}
                onMouseDown={(e) => handleResizeStart(e, "end")}
                onClick={(e) => e.stopPropagation()}
              />
              {/* Middle drag area */}
              <div
                className="absolute left-2 right-2 top-0 bottom-0 cursor-grab"
                onMouseDown={(e) => handleResizeStart(e, "move")}
                onClick={(e) => e.stopPropagation()}
              />
            </>
          )}

          {/* Single-day dot drag */}
          {barStyle.isDot && (
            <div
              className="absolute inset-0 cursor-grab"
              onMouseDown={(e) => handleResizeStart(e, "move")}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      {/* Drag tooltip */}
      {dragTooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg"
          style={{
            left: tooltipX,
            top: -30,
            transform: "translateX(-50%)",
          }}
        >
          {dragTooltip}
        </div>
      )}
    </div>
  );
}
