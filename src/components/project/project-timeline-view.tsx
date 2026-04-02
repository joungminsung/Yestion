"use client";

import { useMemo, useRef, useState } from "react";
import { trpc } from "@/server/trpc/client";
import {
  startOfWeek,
  addDays,
  differenceInDays,
  format,
  isToday,
  addWeeks,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = { projectId: string };

const ROW_HEIGHT = 36;
const DAY_WIDTH = 40;
const HEADER_HEIGHT = 52;
const LEFT_PANEL_WIDTH = 220;

const STATUS_COLORS: Record<string, string> = {
  backlog: "#9CA3AF",
  todo: "#3B82F6",
  in_progress: "#F59E0B",
  in_review: "#8B5CF6",
  done: "#10B981",
};

export function ProjectTimelineView({ projectId }: Props) {
  const { data: tasks } = trpc.task.list.useQuery({ projectId });
  const [viewStart, setViewStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weeksToShow = 6;
  const viewEnd = addWeeks(viewStart, weeksToShow);
  const totalDays = differenceInDays(viewEnd, viewStart);

  const days = useMemo(() => {
    const d: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      d.push(addDays(viewStart, i));
    }
    return d;
  }, [viewStart, totalDays]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const tasksWithDates = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter((t) => t.startDate || t.dueDate)
      .map((t) => ({
        ...t,
        barStart: t.startDate ? new Date(t.startDate) : t.dueDate ? new Date(t.dueDate) : new Date(),
        barEnd: t.dueDate ? new Date(t.dueDate) : t.startDate ? addDays(new Date(t.startDate), 3) : new Date(),
      }));
  }, [tasks]);

  const getBarStyle = (barStart: Date, barEnd: Date) => {
    const startOffset = differenceInDays(barStart, viewStart);
    const duration = Math.max(1, differenceInDays(barEnd, barStart) + 1);
    return {
      left: startOffset * DAY_WIDTH,
      width: duration * DAY_WIDTH - 4,
    };
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Navigation bar */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <button
          onClick={() => setViewStart(subWeeks(viewStart, 2))}
          className="p-1 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {format(viewStart, "MMM d")} - {format(viewEnd, "MMM d, yyyy")}
        </span>
        <button
          onClick={() => setViewStart(addWeeks(viewStart, 2))}
          className="p-1 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setViewStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          className="ml-2 px-2 py-1 text-xs rounded border"
          style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
        >
          Today
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: task names */}
        <div
          className="flex-shrink-0 overflow-y-auto border-r"
          style={{ width: LEFT_PANEL_WIDTH, borderColor: "var(--border-default)" }}
        >
          <div
            className="sticky top-0 px-3 flex items-center text-xs font-medium"
            style={{ height: HEADER_HEIGHT, color: "var(--text-tertiary)", backgroundColor: "var(--bg-primary)", borderBottom: "1px solid var(--border-default)" }}
          >
            Task
          </div>
          {tasksWithDates.map((task) => (
            <div
              key={task.id}
              className="flex items-center px-3 text-sm truncate border-b"
              style={{ height: ROW_HEIGHT, color: "var(--text-primary)", borderColor: "var(--border-light, #eee)" }}
            >
              <div
                className="w-2 h-2 rounded-full mr-2 shrink-0"
                style={{ backgroundColor: STATUS_COLORS[task.status] ?? "#9CA3AF" }}
              />
              <span className="truncate">{task.title}</span>
            </div>
          ))}
        </div>

        {/* Right panel: Gantt chart */}
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <svg
            width={totalDays * DAY_WIDTH}
            height={HEADER_HEIGHT + tasksWithDates.length * ROW_HEIGHT}
            className="block"
          >
            {/* Date headers */}
            {days.map((day, i) => {
              const x = i * DAY_WIDTH;
              const today = isToday(day);
              const isMonday = day.getDay() === 1;
              return (
                <g key={i}>
                  {/* Column background */}
                  {today && (
                    <rect
                      x={x}
                      y={0}
                      width={DAY_WIDTH}
                      height={HEADER_HEIGHT + tasksWithDates.length * ROW_HEIGHT}
                      fill="var(--accent-blue-light, rgba(35,131,226,0.06))"
                    />
                  )}
                  {/* Grid line */}
                  <line
                    x1={x}
                    y1={HEADER_HEIGHT}
                    x2={x}
                    y2={HEADER_HEIGHT + tasksWithDates.length * ROW_HEIGHT}
                    stroke="var(--border-light, #eee)"
                    strokeWidth={isMonday ? 1 : 0.5}
                  />
                  {/* Month label on 1st */}
                  {day.getDate() === 1 && (
                    <text
                      x={x + 4}
                      y={14}
                      fontSize={11}
                      fontWeight={600}
                      fill="var(--text-secondary)"
                    >
                      {format(day, "MMM")}
                    </text>
                  )}
                  {/* Day number */}
                  <text
                    x={x + DAY_WIDTH / 2}
                    y={HEADER_HEIGHT - 8}
                    fontSize={10}
                    fill={today ? "var(--accent-blue, #2383e2)" : "var(--text-tertiary)"}
                    fontWeight={today ? 600 : 400}
                    textAnchor="middle"
                  >
                    {format(day, "d")}
                  </text>
                  {/* Weekday */}
                  {isMonday && (
                    <text
                      x={x + DAY_WIDTH / 2}
                      y={HEADER_HEIGHT - 22}
                      fontSize={9}
                      fill="var(--text-tertiary)"
                      textAnchor="middle"
                    >
                      {format(day, "EEE")}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Header bottom line */}
            <line
              x1={0}
              y1={HEADER_HEIGHT}
              x2={totalDays * DAY_WIDTH}
              y2={HEADER_HEIGHT}
              stroke="var(--border-default)"
              strokeWidth={1}
            />

            {/* Row separators */}
            {tasksWithDates.map((_, i) => (
              <line
                key={i}
                x1={0}
                y1={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT}
                x2={totalDays * DAY_WIDTH}
                y2={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT}
                stroke="var(--border-light, #eee)"
                strokeWidth={0.5}
              />
            ))}

            {/* Today marker */}
            {(() => {
              const todayOffset = differenceInDays(new Date(), viewStart);
              if (todayOffset < 0 || todayOffset >= totalDays) return null;
              const x = todayOffset * DAY_WIDTH + DAY_WIDTH / 2;
              return (
                <line
                  x1={x}
                  y1={HEADER_HEIGHT}
                  x2={x}
                  y2={HEADER_HEIGHT + tasksWithDates.length * ROW_HEIGHT}
                  stroke="var(--accent-blue, #2383e2)"
                  strokeWidth={2}
                  strokeDasharray="4,4"
                />
              );
            })()}

            {/* Task bars */}
            {tasksWithDates.map((task, i) => {
              const { left, width } = getBarStyle(task.barStart, task.barEnd);
              const y = HEADER_HEIGHT + i * ROW_HEIGHT + 8;
              const barHeight = ROW_HEIGHT - 16;
              return (
                <g key={task.id}>
                  <rect
                    x={left}
                    y={y}
                    width={Math.max(width, 8)}
                    height={barHeight}
                    rx={4}
                    fill={STATUS_COLORS[task.status] ?? "#9CA3AF"}
                    opacity={0.85}
                    className="cursor-pointer hover:opacity-100 transition-opacity"
                  />
                  {width > 60 && (
                    <text
                      x={left + 8}
                      y={y + barHeight / 2 + 4}
                      fontSize={10}
                      fill="white"
                      fontWeight={500}
                    >
                      {task.title.length > width / 7 ? task.title.slice(0, Math.floor(width / 7)) + "..." : task.title}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Empty state */}
      {tasksWithDates.length === 0 && tasks && tasks.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Add start dates or due dates to tasks to see them on the timeline
          </p>
        </div>
      )}
    </div>
  );
}
