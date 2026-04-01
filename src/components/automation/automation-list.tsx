"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Zap, ToggleLeft, ToggleRight, Trash2, Clock } from "lucide-react";
import { trpc } from "@/server/trpc/client";
import { AutomationBuilder } from "./automation-builder";

export function AutomationList() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const utils = trpc.useUtils();

  const { data: automations, isLoading } = trpc.automation.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const toggleEnabled = trpc.automation.update.useMutation({
    onSuccess: () => utils.automation.list.invalidate(),
  });

  const deleteAutomation = trpc.automation.delete.useMutation({
    onSuccess: () => utils.automation.list.invalidate(),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  if (showCreate || editingId) {
    return (
      <AutomationBuilder
        workspaceId={workspaceId}
        automationId={editingId ?? undefined}
        onClose={() => { setShowCreate(false); setEditingId(null); }}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Zap size={20} style={{ color: "var(--text-primary)" }} />
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Automations
          </h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
          style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
        >
          <Plus size={14} /> New Automation
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--bg-hover)" }} />
          ))}
        </div>
      ) : !automations || automations.length === 0 ? (
        <div className="text-center py-12">
          <Zap size={40} style={{ color: "var(--text-placeholder)" }} className="mx-auto mb-3" />
          <p style={{ color: "var(--text-tertiary)" }}>No automations yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-placeholder)" }}>
            Create your first automation to streamline your workflow
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {automations.map((auto) => (
            <div
              key={auto.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border hover:bg-notion-bg-hover transition-colors cursor-pointer"
              style={{ borderColor: "var(--border-default)" }}
              onClick={() => setEditingId(auto.id)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleEnabled.mutate({ id: auto.id, isEnabled: !auto.isEnabled });
                }}
                style={{ color: auto.isEnabled ? "var(--accent-blue)" : "var(--text-tertiary)" }}
              >
                {auto.isEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {auto.name}
                </div>
                {auto.description && (
                  <div className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                    {auto.description}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {auto.triggerCount > 0 && (
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    <Clock size={10} className="inline mr-1" />
                    {auto.triggerCount} runs
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this automation?")) {
                      deleteAutomation.mutate({ id: auto.id });
                    }
                  }}
                  className="p-1 rounded hover:bg-notion-bg-hover"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
