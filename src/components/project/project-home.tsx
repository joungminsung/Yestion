"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus, BarChart3, LayoutGrid, CalendarDays, List, GanttChart, Timer } from "lucide-react";
import { trpc } from "@/server/trpc/client";
import { BoardView } from "./board-view";
import { ProjectTimelineView } from "./project-timeline-view";
import { ProjectCalendarView } from "./project-calendar-view";
import { ProjectListView } from "./project-list-view";
import { SprintPanel } from "./sprint-panel";

type ViewType = "board" | "list" | "timeline" | "calendar";

const VIEW_TABS: { id: ViewType; label: string; icon: typeof LayoutGrid }[] = [
  { id: "board", label: "Board", icon: LayoutGrid },
  { id: "list", label: "List", icon: List },
  { id: "timeline", label: "Timeline", icon: GanttChart },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
];

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
  const [activeView, setActiveView] = useState<ViewType>("board");
  const [showSprints, setShowSprints] = useState(false);

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
            <span>{project.icon || "\uD83D\uDCC1"}</span>
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

      {selectedProject ? (
        <>
          {/* View tabs */}
          <div
            className="flex items-center gap-1 px-4 py-1.5 border-b"
            style={{ borderColor: "var(--border-default)" }}
          >
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors"
                style={{
                  color: activeView === tab.id ? "var(--text-primary)" : "var(--text-tertiary)",
                  backgroundColor: activeView === tab.id ? "var(--bg-hover)" : "transparent",
                  fontWeight: activeView === tab.id ? 500 : 400,
                }}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}

            <div className="w-px h-4 mx-1" style={{ backgroundColor: "var(--border-default)" }} />

            <button
              onClick={() => setShowSprints(!showSprints)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors"
              style={{
                color: showSprints ? "var(--text-primary)" : "var(--text-tertiary)",
                backgroundColor: showSprints ? "var(--bg-hover)" : "transparent",
              }}
            >
              <Timer size={13} />
              Sprints
            </button>
          </div>

          {/* Content area */}
          <div className="flex flex-1 overflow-hidden">
            {/* Main view */}
            <div className="flex-1 overflow-hidden">
              {activeView === "board" && <BoardView projectId={selectedProject.id} />}
              {activeView === "list" && <ProjectListView projectId={selectedProject.id} />}
              {activeView === "timeline" && <ProjectTimelineView projectId={selectedProject.id} />}
              {activeView === "calendar" && <ProjectCalendarView projectId={selectedProject.id} />}
            </div>

            {/* Sprint side panel */}
            {showSprints && (
              <div
                className="w-[320px] flex-shrink-0 border-l overflow-y-auto"
                style={{ borderColor: "var(--border-default)" }}
              >
                <SprintPanel projectId={selectedProject.id} />
              </div>
            )}
          </div>
        </>
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
