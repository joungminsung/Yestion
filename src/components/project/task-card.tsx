"use client";

import { Calendar, User } from "lucide-react";

type TaskCardProps = {
  task: {
    id: string;
    title: string;
    priority: string;
    assigneeId?: string | null;
    dueDate?: Date | string | null;
    labels: string[];
    _count?: { subtasks: number };
  };
  onClick?: () => void;
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "var(--color-red)",
  high: "var(--color-orange)",
  medium: "var(--color-yellow)",
  low: "var(--color-green)",
};

export function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border hover:bg-notion-bg-hover transition-colors"
      style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)" }}
    >
      {/* Priority dot + Title */}
      <div className="flex items-start gap-2">
        <div
          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? "var(--color-gray)" }}
        />
        <span className="text-sm font-medium line-clamp-2" style={{ color: "var(--text-primary)" }}>
          {task.title || "Untitled"}
        </span>
      </div>

      {/* Labels */}
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 ml-4">
          {task.labels.slice(0, 3).map((label) => (
            <span
              key={label}
              className="px-1.5 py-0.5 rounded text-xs"
              style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Footer: assignee + due date */}
      <div className="flex items-center gap-3 mt-2 ml-4">
        {task.assigneeId && (
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
            <User size={10} />
          </span>
        )}
        {task.dueDate && (
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
            <Calendar size={10} />
            {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
          </span>
        )}
        {(task._count?.subtasks ?? 0) > 0 && (
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {task._count?.subtasks} subtasks
          </span>
        )}
      </div>
    </button>
  );
}
