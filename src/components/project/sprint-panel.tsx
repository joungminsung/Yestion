"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { Play, CheckCircle, Plus, X, Target } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Props = { projectId: string };

export function SprintPanel({ projectId }: Props) {
  const { data: sprints, refetch } = trpc.sprint.list.useQuery({ projectId });
  const createSprint = trpc.sprint.create.useMutation({ onSuccess: () => refetch() });
  const startSprint = trpc.sprint.start.useMutation({ onSuccess: () => refetch() });
  const completeSprint = trpc.sprint.complete.useMutation({ onSuccess: () => refetch() });

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);

  const activeSprint = sprints?.find((s) => s.status === "active");
  const burndownSprint = selectedSprintId ?? activeSprint?.id;

  const { data: burndownData } = trpc.sprint.burndown.useQuery(
    { id: burndownSprint! },
    { enabled: !!burndownSprint }
  );

  const handleCreate = () => {
    if (!newName.trim()) return;
    createSprint.mutate({ projectId, name: newName.trim(), goal: newGoal.trim() || undefined });
    setNewName("");
    setNewGoal("");
    setShowCreate(false);
  };

  const STATUS_BADGES: Record<string, { label: string; color: string; bg: string }> = {
    planning: { label: "Planning", color: "var(--text-secondary)", bg: "var(--bg-hover)" },
    active: { label: "Active", color: "var(--color-green)", bg: "rgba(16,185,129,0.1)" },
    completed: { label: "Completed", color: "var(--text-tertiary)", bg: "var(--bg-hover)" },
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Sprints
        </h3>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          <Plus size={12} />
          New Sprint
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div
          className="p-3 rounded-lg border"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              New Sprint
            </span>
            <button onClick={() => setShowCreate(false)} style={{ color: "var(--text-tertiary)" }}>
              <X size={14} />
            </button>
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Sprint name..."
            className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none mb-2"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            autoFocus
          />
          <input
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            placeholder="Sprint goal (optional)..."
            className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none mb-3"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
          />
          <button
            onClick={handleCreate}
            className="px-3 py-1.5 text-xs rounded"
            style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
          >
            Create Sprint
          </button>
        </div>
      )}

      {/* Sprint list */}
      {sprints?.map((sprint) => {
        const badge = STATUS_BADGES[sprint.status] ?? STATUS_BADGES["planning"]!;
        return (
          <div
            key={sprint.id}
            className="p-3 rounded-lg border cursor-pointer"
            style={{ borderColor: selectedSprintId === sprint.id ? "var(--accent-blue)" : "var(--border-default)" }}
            onClick={() => setSelectedSprintId(sprint.id)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {sprint.name}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ color: badge.color, backgroundColor: badge.bg }}
              >
                {badge.label}
              </span>
            </div>

            {sprint.goal && (
              <div className="flex items-center gap-1 mb-2">
                <Target size={10} style={{ color: "var(--text-tertiary)" }} />
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {sprint.goal}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
              <span>{sprint._count.tasks} tasks</span>
              {sprint.startDate && (
                <span>
                  {new Date(sprint.startDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  {sprint.endDate && ` - ${new Date(sprint.endDate).toLocaleDateString("en", { month: "short", day: "numeric" })}`}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-2">
              {sprint.status === "planning" && (
                <button
                  onClick={(e) => { e.stopPropagation(); startSprint.mutate({ id: sprint.id }); }}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded"
                  style={{ backgroundColor: "var(--color-green)", color: "white" }}
                >
                  <Play size={10} />
                  Start Sprint
                </button>
              )}
              {sprint.status === "active" && (
                <button
                  onClick={(e) => { e.stopPropagation(); completeSprint.mutate({ id: sprint.id }); }}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded"
                  style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
                >
                  <CheckCircle size={10} />
                  Complete Sprint
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Burndown chart */}
      {burndownData && burndownData.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
            Burndown Chart
          </h4>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={burndownData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light, #eee)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
                  tickFormatter={(v: string) => v.slice(5)} // MM-DD
                />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="remaining"
                  name="Remaining"
                  stroke="var(--accent-blue, #2383e2)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="ideal"
                  name="Ideal"
                  stroke="var(--text-tertiary)"
                  strokeDasharray="5 5"
                  strokeWidth={1}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
