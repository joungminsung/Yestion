"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus, BarChart3 } from "lucide-react";
import { trpc } from "@/server/trpc/client";
import { BoardView } from "./board-view";

export function ProjectHome() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const { data: projects, isLoading } = trpc.project.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const utils = trpc.useUtils();
  const createProject = trpc.project.create.useMutation({
    onSuccess: () => utils.project.list.invalidate(),
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const selectedProject = projects?.find((p) => p.id === selectedProjectId) ?? projects?.[0];

  const handleCreate = () => {
    if (!newName.trim()) return;
    createProject.mutate({ workspaceId, name: newName.trim() });
    setNewName("");
    setShowCreate(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span style={{ color: "var(--text-tertiary)" }}>Loading projects...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Project selector bar */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b overflow-x-auto"
        style={{ borderColor: "var(--border-default)" }}
      >
        {projects?.map((project) => (
          <button
            key={project.id}
            onClick={() => setSelectedProjectId(project.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors"
            style={{
              color: selectedProject?.id === project.id ? "var(--text-primary)" : "var(--text-secondary)",
              backgroundColor: selectedProject?.id === project.id ? "var(--bg-hover)" : undefined,
              fontWeight: selectedProject?.id === project.id ? 500 : 400,
            }}
          >
            <span>{project.icon || "📁"}</span>
            <span>{project.name}</span>
            <span className="text-xs opacity-60">{project._count.tasks}</span>
          </button>
        ))}

        {showCreate ? (
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
              placeholder="Project name..."
              className="px-2 py-1 text-sm rounded border bg-transparent outline-none"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", width: "160px" }}
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-sm hover:bg-notion-bg-hover whitespace-nowrap"
            style={{ color: "var(--text-tertiary)" }}
          >
            <Plus size={14} />
            New Project
          </button>
        )}
      </div>

      {/* Board */}
      {selectedProject ? (
        <BoardView projectId={selectedProject.id} />
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <BarChart3 size={48} style={{ color: "var(--text-placeholder)" }} />
          <p style={{ color: "var(--text-tertiary)" }}>Create a project to get started</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
          >
            New Project
          </button>
        </div>
      )}
    </div>
  );
}
