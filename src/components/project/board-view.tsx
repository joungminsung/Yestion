"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { trpc } from "@/server/trpc/client";
import { TaskCard } from "./task-card";

const STATUSES = [
  { id: "backlog", label: "Backlog", color: "var(--color-gray)" },
  { id: "todo", label: "Todo", color: "var(--color-blue)" },
  { id: "in_progress", label: "In Progress", color: "var(--color-yellow)" },
  { id: "in_review", label: "In Review", color: "var(--color-purple)" },
  { id: "done", label: "Done", color: "var(--color-green)" },
];

type Props = {
  projectId: string;
};

export function BoardView({ projectId }: Props) {
  const { data: tasks, refetch } = trpc.task.list.useQuery({ projectId });
  const createTask = trpc.task.create.useMutation({ onSuccess: () => refetch() });
  const reorderTask = trpc.task.reorder.useMutation({ onSuccess: () => refetch() });
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const tasksByStatus = (status: string) =>
    tasks?.filter((t) => t.status === status).sort((a, b) => a.position - b.position) ?? [];

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/task-id", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/task-id");
    if (!taskId) return;

    // Find the task being dragged
    const draggedTask = tasks?.find(t => t.id === taskId);
    if (!draggedTask) return;

    const statusTasks = tasksByStatus(targetStatus);
    const newPosition = statusTasks.length;

    // Skip if dropping in same column at the end (effectively same position)
    if (draggedTask.status === targetStatus && draggedTask.position >= statusTasks.length - 1) return;

    reorderTask.mutate({ id: taskId, status: targetStatus, position: newPosition });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleAddTask = (status: string) => {
    if (!newTitle.trim()) return;
    createTask.mutate({
      projectId,
      title: newTitle.trim(),
      status,
    });
    setNewTitle("");
    setAddingTo(null);
  };

  return (
    <div className="flex gap-3 overflow-x-auto p-4 h-full">
      {STATUSES.map((status) => {
        const columnTasks = tasksByStatus(status.id);
        return (
          <div
            key={status.id}
            className="flex flex-col w-[280px] min-w-[280px] shrink-0"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status.id)}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-2 py-2 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {status.label}
              </span>
              <span className="text-xs px-1.5 rounded-full" style={{ color: "var(--text-tertiary)", backgroundColor: "var(--bg-hover)" }}>
                {columnTasks.length}
              </span>
              <button
                className="ml-auto p-1 rounded hover:bg-notion-bg-hover"
                style={{ color: "var(--text-tertiary)" }}
                onClick={() => { setAddingTo(status.id); setNewTitle(""); }}
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 flex-1 overflow-y-auto px-1 pb-2">
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <TaskCard task={task} />
                </div>
              ))}

              {/* Add task inline */}
              {addingTo === status.id && (
                <div className="p-2 rounded-lg border" style={{ borderColor: "var(--border-default)" }}>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTask(status.id);
                      if (e.key === "Escape") setAddingTo(null);
                    }}
                    placeholder="Task title..."
                    className="w-full bg-transparent text-sm outline-none mb-2"
                    style={{ color: "var(--text-primary)" }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddTask(status.id)}
                      className="px-3 py-1 text-xs rounded"
                      style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setAddingTo(null)}
                      className="px-3 py-1 text-xs rounded hover:bg-notion-bg-hover"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
