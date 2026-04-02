"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/server/trpc/client";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = { projectId: string };

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "var(--color-red)",
  high: "var(--color-orange)",
  medium: "var(--color-yellow)",
  low: "var(--color-green)",
};

export function ProjectCalendarView({ projectId }: Props) {
  const { data: tasks } = trpc.task.list.useQuery({ projectId });
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    let day = calStart;
    while (day <= calEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(day);
        day = addDays(day, 1);
      }
      result.push(week);
    }
    return result;
  }, [calStart, calEnd]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    if (!tasks) return map;
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = format(new Date(task.dueDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [tasks]);

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex flex-col h-full p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          <ChevronRight size={18} />
        </button>
        <button
          onClick={() => setCurrentMonth(new Date())}
          className="ml-2 px-2 py-1 text-xs rounded border"
          style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
        >
          Today
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {weekDays.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium py-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px flex-1 border rounded-lg overflow-hidden" style={{ borderColor: "var(--border-default)" }}>
        {weeks.flatMap((week) =>
          week.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate.get(dateKey) ?? [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            return (
              <div
                key={dateKey}
                className="flex flex-col p-1.5 min-h-[90px] border-b border-r"
                style={{
                  borderColor: "var(--border-light, #eee)",
                  backgroundColor: inMonth ? "var(--bg-primary)" : "var(--bg-secondary)",
                  opacity: inMonth ? 1 : 0.5,
                }}
              >
                <span
                  className="text-xs mb-1 w-6 h-6 flex items-center justify-center rounded-full"
                  style={{
                    color: today ? "white" : "var(--text-secondary)",
                    backgroundColor: today ? "var(--accent-blue, #2383e2)" : "transparent",
                    fontWeight: today ? 600 : 400,
                  }}
                >
                  {format(day, "d")}
                </span>

                <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                      style={{
                        backgroundColor: PRIORITY_COLORS[task.priority] ? `${PRIORITY_COLORS[task.priority]}22` : "var(--bg-hover)",
                        color: "var(--text-primary)",
                        borderLeft: `2px solid ${PRIORITY_COLORS[task.priority] ?? "var(--color-gray)"}`,
                      }}
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-xs px-1.5" style={{ color: "var(--text-tertiary)" }}>
                      +{dayTasks.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
