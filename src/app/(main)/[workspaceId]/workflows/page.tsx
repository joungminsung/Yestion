"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { WorkflowBuilder } from "@/components/workflow/workflow-builder";
import { ExecutionHistory } from "@/components/workflow/execution-history";
import { Plus, Workflow, ToggleLeft, ToggleRight, Trash2, History } from "lucide-react";

export default function WorkflowsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const { data: workflows, refetch } = trpc.workflow.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const createWorkflow = trpc.workflow.create.useMutation({ onSuccess: () => refetch() });
  const updateWorkflow = trpc.workflow.update.useMutation({ onSuccess: () => refetch() });
  const deleteWorkflow = trpc.workflow.delete.useMutation({ onSuccess: () => refetch() });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    createWorkflow.mutate({ workspaceId, name: newName.trim() });
    setNewName("");
    setShowCreate(false);
  };

  // Show builder if editing
  if (editingId) {
    return (
      <WorkflowBuilder
        workflowId={editingId}
        onBack={() => setEditingId(null)}
      />
    );
  }

  // Show execution history
  if (showHistory) {
    return (
      <ExecutionHistory
        workflowId={showHistory}
        onBack={() => setShowHistory(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center gap-3">
          <Workflow size={20} style={{ color: "var(--accent-blue)" }} />
          <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Workflows
          </h1>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: "var(--text-tertiary)", backgroundColor: "var(--bg-hover)" }}>
            {workflows?.length ?? 0}
          </span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg"
          style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
        >
          <Plus size={14} />
          New Workflow
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div
          className="mx-6 mt-4 p-4 rounded-lg border"
          style={{ borderColor: "var(--border-default)" }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
            placeholder="Workflow name..."
            className="w-full px-3 py-2 text-sm rounded border bg-transparent outline-none mb-3"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="px-3 py-1.5 text-xs rounded"
              style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 text-xs rounded hover:bg-notion-bg-hover"
              style={{ color: "var(--text-tertiary)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Workflow list */}
      <div className="flex-1 overflow-y-auto p-6">
        {workflows?.length === 0 && !showCreate && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Workflow size={48} style={{ color: "var(--text-placeholder)" }} />
            <p style={{ color: "var(--text-tertiary)" }}>No workflows yet</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
            >
              Create your first workflow
            </button>
          </div>
        )}

        <div className="grid gap-3">
          {workflows?.map((workflow) => (
            <div
              key={workflow.id}
              className="flex items-center gap-4 p-4 rounded-lg border hover:bg-notion-bg-hover transition-colors cursor-pointer"
              style={{ borderColor: "var(--border-default)" }}
              onClick={() => setEditingId(workflow.id)}
            >
              <Workflow size={18} style={{ color: "var(--accent-blue)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {workflow.name}
                </p>
                {workflow.description && (
                  <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                    {workflow.description}
                  </p>
                )}
                <p className="text-xs mt-1" style={{ color: "var(--text-placeholder)" }}>
                  {workflow._count.executions} executions
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHistory(workflow.id);
                  }}
                  className="p-1.5 rounded hover:bg-notion-bg-hover"
                  style={{ color: "var(--text-tertiary)" }}
                  title="Execution history"
                >
                  <History size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateWorkflow.mutate({ id: workflow.id, isEnabled: !workflow.isEnabled });
                  }}
                  className="p-1.5 rounded hover:bg-notion-bg-hover"
                  style={{ color: workflow.isEnabled ? "var(--color-green)" : "var(--text-tertiary)" }}
                  title={workflow.isEnabled ? "Disable" : "Enable"}
                >
                  {workflow.isEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this workflow?")) {
                      deleteWorkflow.mutate({ id: workflow.id });
                    }
                  }}
                  className="p-1.5 rounded hover:bg-notion-bg-hover"
                  style={{ color: "var(--text-tertiary)" }}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
