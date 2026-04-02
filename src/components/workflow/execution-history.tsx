"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { format } from "date-fns";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Ban,
} from "lucide-react";
import type { NodeExecutionState } from "@/lib/workflows/types";

type Props = {
  workflowId: string;
  onBack: () => void;
};

type StatusEntry = { icon: typeof CheckCircle; color: string; label: string };

const DEFAULT_STATUS: StatusEntry = { icon: Loader2, color: "var(--accent-blue)", label: "Running" };

const STATUS_CONFIG: Record<string, StatusEntry> = {
  completed: { icon: CheckCircle, color: "var(--color-green)", label: "Completed" },
  failed: { icon: XCircle, color: "var(--color-red)", label: "Failed" },
  running: { icon: Loader2, color: "var(--accent-blue)", label: "Running" },
  waiting: { icon: Clock, color: "var(--color-yellow)", label: "Waiting" },
  cancelled: { icon: Ban, color: "var(--text-tertiary)", label: "Cancelled" },
};

type NodeStatusEntry = { color: string };

const DEFAULT_NODE_STATUS: NodeStatusEntry = { color: "var(--text-placeholder)" };

const NODE_STATUS_CONFIG: Record<string, NodeStatusEntry> = {
  completed: { color: "var(--color-green)" },
  failed: { color: "var(--color-red)" },
  running: { color: "var(--accent-blue)" },
  waiting: { color: "var(--color-yellow)" },
  skipped: { color: "var(--text-tertiary)" },
  pending: { color: "var(--text-placeholder)" },
};

export function ExecutionHistory({ workflowId, onBack }: Props) {
  const { data: executions } = trpc.workflow.executions.useQuery({ workflowId });
  const [selectedExecId, setSelectedExecId] = useState<string | null>(null);

  const { data: selectedExecution } = trpc.workflow.getExecution.useQuery(
    { id: selectedExecId! },
    { enabled: !!selectedExecId }
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Execution History
        </h2>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Execution list */}
        <div
          className="w-[360px] flex-shrink-0 overflow-y-auto border-r"
          style={{ borderColor: "var(--border-default)" }}
        >
          {executions?.length === 0 && (
            <div className="p-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
              No executions yet
            </div>
          )}

          {executions?.map((exec) => {
            const config = STATUS_CONFIG[exec.status] ?? DEFAULT_STATUS;
            const Icon = config.icon;
            return (
              <button
                key={exec.id}
                onClick={() => setSelectedExecId(exec.id)}
                className="flex items-center gap-3 w-full px-4 py-3 border-b hover:bg-notion-bg-hover text-left"
                style={{
                  borderColor: "var(--border-light, #eee)",
                  backgroundColor: selectedExecId === exec.id ? "var(--bg-hover)" : undefined,
                }}
              >
                <Icon
                  size={16}
                  style={{ color: config.color }}
                  className={exec.status === "running" ? "animate-spin" : ""}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: config.color }}>
                      {config.label}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-placeholder)" }}>
                      {exec.id.slice(-6)}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    {format(new Date(exec.startedAt), "MMM d, HH:mm:ss")}
                  </p>
                  {exec.error && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--color-red)" }}>
                      {exec.error}
                    </p>
                  )}
                </div>
                <ChevronRight size={14} style={{ color: "var(--text-placeholder)" }} />
              </button>
            );
          })}
        </div>

        {/* Execution detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedExecution ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                Select an execution to view details
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const config = STATUS_CONFIG[selectedExecution.status] ?? DEFAULT_STATUS;
                    const Icon = config.icon;
                    return (
                      <>
                        <Icon size={18} style={{ color: config.color }} />
                        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {config.label}
                        </span>
                      </>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  <div>
                    <span className="font-medium">Started:</span>{" "}
                    {format(new Date(selectedExecution.startedAt), "MMM d, yyyy HH:mm:ss")}
                  </div>
                  {selectedExecution.completedAt && (
                    <div>
                      <span className="font-medium">Completed:</span>{" "}
                      {format(new Date(selectedExecution.completedAt), "MMM d, yyyy HH:mm:ss")}
                    </div>
                  )}
                  {selectedExecution.error && (
                    <div className="col-span-2" style={{ color: "var(--color-red)" }}>
                      <span className="font-medium">Error:</span> {selectedExecution.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Node timeline */}
              <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
                Node Execution Timeline
              </h3>
              <div className="flex flex-col gap-1">
                {Object.entries(
                  (selectedExecution.nodeStates as Record<string, NodeExecutionState>) ?? {}
                ).map(([nodeId, state]) => {
                  const nodeConfig = NODE_STATUS_CONFIG[state.status] ?? DEFAULT_NODE_STATUS;
                  // Find the node definition for this ID
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const workflowNodes = (selectedExecution.workflow?.nodes ?? []) as any[];
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const nodeDef = workflowNodes.find((n: any) => n.id === nodeId);

                  return (
                    <div
                      key={nodeId}
                      className="flex items-start gap-3 p-3 rounded-lg border"
                      style={{ borderColor: "var(--border-light, #eee)" }}
                    >
                      {/* Status dot */}
                      <div
                        className="w-3 h-3 rounded-full mt-0.5 shrink-0"
                        style={{ backgroundColor: nodeConfig.color }}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {nodeDef?.data?.label ?? nodeId}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: nodeConfig.color, backgroundColor: `${nodeConfig.color}15` }}>
                            {state.status}
                          </span>
                          {state.iteration !== undefined && (
                            <span className="text-[10px]" style={{ color: "var(--text-placeholder)" }}>
                              iteration {state.iteration}
                            </span>
                          )}
                        </div>

                        {state.startedAt && (
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                            {format(new Date(state.startedAt), "HH:mm:ss")}
                            {state.endedAt && ` - ${format(new Date(state.endedAt), "HH:mm:ss")}`}
                          </p>
                        )}

                        {state.error && (
                          <p className="text-xs mt-1 p-2 rounded" style={{ color: "var(--color-red)", backgroundColor: "rgba(239,68,68,0.05)" }}>
                            {state.error}
                          </p>
                        )}

                        {state.output !== undefined && state.output !== null && (
                          <details className="mt-1">
                            <summary className="text-[10px] cursor-pointer" style={{ color: "var(--text-tertiary)" }}>
                              Output
                            </summary>
                            <pre
                              className="text-[10px] mt-1 p-2 rounded overflow-x-auto"
                              style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                            >
                              {JSON.stringify(state.output, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Approvals */}
              {selectedExecution.approvals && selectedExecution.approvals.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
                    Approvals
                  </h3>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {selectedExecution.approvals.map((approval: any) => (
                    <div
                      key={approval.id}
                      className="flex items-center gap-3 p-3 rounded-lg border mb-2"
                      style={{ borderColor: "var(--border-light, #eee)" }}
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            approval.status === "approved"
                              ? "var(--color-green)"
                              : approval.status === "rejected"
                                ? "var(--color-red)"
                                : "var(--color-yellow)",
                        }}
                      />
                      <div className="flex-1">
                        <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                          {approval.status}
                        </span>
                        {approval.comment && (
                          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                            {approval.comment}
                          </p>
                        )}
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-placeholder)" }}>
                        {format(new Date(approval.createdAt), "MMM d, HH:mm")}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Debug: variables */}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {selectedExecution.variables && Object.keys(selectedExecution.variables as any).length > 0 && (
                <details className="mt-6">
                  <summary className="text-sm font-medium cursor-pointer" style={{ color: "var(--text-primary)" }}>
                    Variables
                  </summary>
                  <pre
                    className="text-xs mt-2 p-3 rounded overflow-x-auto"
                    style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                  >
                    {JSON.stringify(selectedExecution.variables, null, 2)}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
