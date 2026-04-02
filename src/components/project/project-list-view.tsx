"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/server/trpc/client";
import { ChevronRight, ChevronDown, Calendar, User } from "lucide-react";

type Props = { projectId: string };

type GroupBy = "status" | "priority" | "assignee" | "none";

const STATUS_ORDER = ["backlog", "todo", "in_progress", "in_review", "done"];
const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};
const PRIORITY_ORDER = ["urgent", "high", "medium", "low"];
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "var(--color-red)",
  high: "var(--color-orange)",
  medium: "var(--color-yellow)",
  low: "var(--color-green)",
};

export function ProjectListView({ projectId }: Props) {
  const { data: tasks } = trpc.task.list.useQuery({ projectId });
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    if (!tasks) return [];

    if (groupBy === "none") {
      return [{ key: "all", label: "All Tasks", tasks: [...tasks].sort((a, b) => a.position - b.position) }];
    }

    if (groupBy === "status") {
      return STATUS_ORDER.map((status) => ({
        key: status,
        label: STATUS_LABELS[status] ?? status,
        tasks: tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position),
      })).filter((g) => g.tasks.length > 0);
    }

    if (groupBy === "priority") {
      return PRIORITY_ORDER.map((priority) => ({
        key: priority,
        label: PRIORITY_LABELS[priority] ?? priority,
        tasks: tasks.filter((t) => t.priority === priority).sort((a, b) => a.position - b.position),
      })).filter((g) => g.tasks.length > 0);
    }

    // groupBy === "assignee"
    const map = new Map<string, typeof tasks>();
    for (const task of tasks) {
      const key = task.assigneeId ?? "unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return Array.from(map.entries()).map(([key, groupTasks]) => ({
      key,
      label: key === "unassigned" ? "Unassigned" : key,
      tasks: groupTasks.sort((a, b) => a.position - b.position),
    }));
  }, [tasks, groupBy]);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-4 py-2 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
          Group by:
        </span>
        {(["status", "priority", "assignee", "none"] as GroupBy[]).map((g) => (
          <button
            key={g}
            onClick={() => setGroupBy(g)}
            className="px-2 py-1 text-xs rounded"
            style={{
              backgroundColor: groupBy === g ? "var(--bg-hover)" : "transparent",
              color: groupBy === g ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: groupBy === g ? 500 : 400,
            }}
          >
            {g === "none" ? "None" : g.charAt(0).toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {/* Column headers */}
        <div
          className="grid grid-cols-[1fr_100px_80px_100px_80px] gap-2 px-4 py-2 text-xs font-medium sticky top-0"
          style={{ color: "var(--text-tertiary)", backgroundColor: "var(--bg-primary)", borderBottom: "1px solid var(--border-default)" }}
        >
          <span>Title</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Due Date</span>
          <span>Assignee</span>
        </div>

        {groups.map((group) => (
          <div key={group.key}>
            {/* Group header */}
            {groupBy !== "none" && (
              <button
                onClick={() => toggleCollapse(group.key)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium hover:bg-notion-bg-hover"
                style={{ color: "var(--text-primary)" }}
              >
                {collapsed.has(group.key) ? (
                  <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />
                ) : (
                  <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} />
                )}
                {group.label}
                <span className="text-xs px-1.5 rounded-full" style={{ color: "var(--text-tertiary)", backgroundColor: "var(--bg-hover)" }}>
                  {group.tasks.length}
                </span>
              </button>
            )}

            {/* Tasks */}
            {!collapsed.has(group.key) &&
              group.tasks.map((task) => (
                <div
                  key={task.id}
                  className="grid grid-cols-[1fr_100px_80px_100px_80px] gap-2 px-4 py-2 border-b hover:bg-notion-bg-hover cursor-pointer"
                  style={{ borderColor: "var(--border-light, #eee)" }}
                >
                  <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                    {task.title}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full w-fit"
                    style={{
                      backgroundColor: "var(--bg-hover)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {STATUS_LABELS[task.status] ?? task.status}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? "var(--color-gray)" }}
                    />
                    {PRIORITY_LABELS[task.priority] ?? task.priority}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {task.dueDate ? (
                      <>
                        <Calendar size={10} />
                        {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
                      </>
                    ) : (
                      "\u2014"
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {task.assigneeId ? <User size={10} /> : "\u2014"}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
