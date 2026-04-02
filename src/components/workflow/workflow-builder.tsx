"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { trpc } from "@/server/trpc/client";
import { NODE_PALETTE } from "@/lib/workflows/types";
import { TriggerNode } from "./nodes/trigger-node";
import { ActionNode } from "./nodes/action-node";
import { ConditionNode } from "./nodes/condition-node";
import { WaitNode } from "./nodes/wait-node";
import { ApprovalNode } from "./nodes/approval-node";
import { LoopNode } from "./nodes/loop-node";
import { EndNode } from "./nodes/end-node";
import { Save, Play, GripVertical } from "lucide-react";

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  wait: WaitNode,
  approval: ApprovalNode,
  loop: LoopNode,
  end: EndNode,
};

type Props = {
  workflowId: string;
  onBack: () => void;
};

export function WorkflowBuilder({ workflowId, onBack }: Props) {
  const { data: workflow, refetch } = trpc.workflow.getById.useQuery({ id: workflowId });
  const updateWorkflow = trpc.workflow.update.useMutation({ onSuccess: () => refetch() });
  const executeWorkflow = trpc.workflow.execute.useMutation();

  const initialNodes = useMemo(
    () => (workflow?.nodes as Node[]) ?? [],
    [workflow]
  );
  const initialEdges = useMemo(
    () => (workflow?.edges as Edge[]) ?? [],
    [workflow]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: "var(--text-tertiary)" },
          },
          eds
        )
      ),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleSave = () => {
    updateWorkflow.mutate({
      id: workflowId,
      nodes: nodes as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      edges: edges as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });
  };

  const handleExecute = () => {
    executeWorkflow.mutate({ id: workflowId });
  };

  const handleAddNode = (paletteItem: (typeof NODE_PALETTE)[number]) => {
    const id = `${paletteItem.type}-${Date.now()}`;
    const newNode: Node = {
      id,
      type: paletteItem.type,
      position: { x: 250, y: (nodes.length + 1) * 120 },
      data: { ...paletteItem.defaultData },
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const handleUpdateNodeData = (key: string, value: unknown) => {
    if (!selectedNode) return;
    setNodes((prev) =>
      prev.map((n) =>
        n.id === selectedNode.id
          ? { ...n, data: { ...n.data, [key]: value } }
          : n
      )
    );
    setSelectedNode((prev) =>
      prev ? { ...prev, data: { ...prev.data, [key]: value } } : null
    );
  };

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full">
        <span style={{ color: "var(--text-tertiary)" }}>Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <button
          onClick={onBack}
          className="text-sm hover:underline"
          style={{ color: "var(--text-secondary)" }}
        >
          Workflows
        </button>
        <span style={{ color: "var(--text-tertiary)" }}>/</span>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {workflow.name}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleExecute}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded"
            style={{ backgroundColor: "var(--color-green)", color: "white" }}
            disabled={executeWorkflow.isPending}
          >
            <Play size={12} />
            Run
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded"
            style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
            disabled={updateWorkflow.isPending}
          >
            <Save size={12} />
            Save
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Node palette */}
        <div
          className="w-[200px] flex-shrink-0 p-3 border-r overflow-y-auto"
          style={{ borderColor: "var(--border-default)" }}
        >
          <p className="text-xs font-medium mb-3" style={{ color: "var(--text-tertiary)" }}>
            NODES
          </p>
          <div className="flex flex-col gap-2">
            {NODE_PALETTE.map((item) => (
              <button
                key={item.type}
                onClick={() => handleAddNode(item)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-left hover:bg-notion-bg-hover transition-colors"
                style={{ borderColor: "var(--border-default)" }}
              >
                <GripVertical size={12} style={{ color: "var(--text-placeholder)" }} />
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {item.label}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                    {item.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ReactFlow canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: "var(--text-tertiary)", strokeWidth: 2 },
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls />
            <MiniMap
              style={{ backgroundColor: "var(--bg-secondary)" }}
              maskColor="rgba(0,0,0,0.1)"
            />
          </ReactFlow>
        </div>

        {/* Config panel */}
        {selectedNode && (
          <div
            className="w-[280px] flex-shrink-0 p-4 border-l overflow-y-auto"
            style={{ borderColor: "var(--border-default)" }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
              Node Configuration
            </h3>

            {/* Common fields */}
            <div className="mb-3">
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
                Label
              </label>
              <input
                value={(selectedNode.data as any).label ?? ""} // eslint-disable-line @typescript-eslint/no-explicit-any
                onChange={(e) => handleUpdateNodeData("label", e.target.value)}
                className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
                style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
              />
            </div>

            {/* Type-specific fields */}
            {selectedNode.type === "trigger" && (
              <div className="mb-3">
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
                  Trigger Type
                </label>
                <select
                  value={(selectedNode.data as any).triggerType ?? ""} // eslint-disable-line @typescript-eslint/no-explicit-any
                  onChange={(e) => handleUpdateNodeData("triggerType", e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                >
                  <option value="page.created">Page Created</option>
                  <option value="page.updated">Page Updated</option>
                  <option value="task.status_changed">Task Status Changed</option>
                  <option value="task.assigned">Task Assigned</option>
                  <option value="database.row_created">Database Row Created</option>
                  <option value="webhook.received">Webhook Received</option>
                  <option value="schedule.cron">Schedule (Cron)</option>
                </select>
              </div>
            )}

            {selectedNode.type === "action" && (
              <div className="mb-3">
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
                  Action Type
                </label>
                <select
                  value={(selectedNode.data as any).actionType ?? ""} // eslint-disable-line @typescript-eslint/no-explicit-any
                  onChange={(e) => handleUpdateNodeData("actionType", e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                >
                  <option value="send_notification">Send Notification</option>
                  <option value="update_property">Update Property</option>
                  <option value="assign_user">Assign User</option>
                  <option value="create_task">Create Task</option>
                  <option value="create_page">Create Page</option>
                  <option value="call_webhook">Call Webhook</option>
                  <option value="send_email">Send Email</option>
                  <option value="post_comment">Post Comment</option>
                </select>
              </div>
            )}

            {selectedNode.type === "condition" && (
              <>
                <div className="mb-3">
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
                    Field
                  </label>
                  <input
                    value={(selectedNode.data as any).field ?? ""} // eslint-disable-line @typescript-eslint/no-explicit-any
                    onChange={(e) => handleUpdateNodeData("field", e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
                    style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                    placeholder="e.g. status"
                  />
                </div>
                <div className="mb-3">
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
                    Operator
                  </label>
                  <select
                    value={(selectedNode.data as any).operator ?? "equals"} // eslint-disable-line @typescript-eslint/no-explicit-any
                    onChange={(e) => handleUpdateNodeData("operator", e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
                    style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  >
                    <option value="equals">Equals</option>
                    <option value="not_equals">Not Equals</option>
                    <option value="contains">Contains</option>
                    <option value="gt">Greater Than</option>
                    <option value="lt">Less Than</option>
                    <option value="is_empty">Is Empty</option>
                    <option value="is_not_empty">Is Not Empty</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
                    Value
                  </label>
                  <input
                    value={String((selectedNode.data as any).value ?? "")} // eslint-disable-line @typescript-eslint/no-explicit-any
                    onChange={(e) => handleUpdateNodeData("value", e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
                    style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>
              </>
            )}

            {selectedNode.type === "wait" && (
              <div className="mb-3">
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
                  Delay (minutes)
                </label>
                <input
                  type="number"
                  value={(selectedNode.data as any).delayMinutes ?? 5} // eslint-disable-line @typescript-eslint/no-explicit-any
                  onChange={(e) => handleUpdateNodeData("delayMinutes", parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                />
              </div>
            )}

            {selectedNode.type === "approval" && (
              <div className="mb-3">
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
                  Message
                </label>
                <textarea
                  value={(selectedNode.data as any).message ?? ""} // eslint-disable-line @typescript-eslint/no-explicit-any
                  onChange={(e) => handleUpdateNodeData("message", e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none resize-none"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  rows={3}
                />
              </div>
            )}

            {selectedNode.type === "loop" && (
              <>
                <div className="mb-3">
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
                    Collection Variable
                  </label>
                  <input
                    value={(selectedNode.data as any).collection ?? ""} // eslint-disable-line @typescript-eslint/no-explicit-any
                    onChange={(e) => handleUpdateNodeData("collection", e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
                    style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>
                <div className="mb-3">
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
                    Item Variable Name
                  </label>
                  <input
                    value={(selectedNode.data as any).itemVariable ?? ""} // eslint-disable-line @typescript-eslint/no-explicit-any
                    onChange={(e) => handleUpdateNodeData("itemVariable", e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
                    style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>
                <div className="mb-3">
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
                    Max Iterations
                  </label>
                  <input
                    type="number"
                    value={(selectedNode.data as any).maxIterations ?? 100} // eslint-disable-line @typescript-eslint/no-explicit-any
                    onChange={(e) => handleUpdateNodeData("maxIterations", parseInt(e.target.value) || 100)}
                    className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
                    style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>
              </>
            )}

            {/* Delete button */}
            <div className="mt-6 pt-4 border-t" style={{ borderColor: "var(--border-default)" }}>
              <button
                onClick={() => {
                  setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
                  setEdges((prev) => prev.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                  setSelectedNode(null);
                }}
                className="w-full px-3 py-1.5 text-xs rounded border"
                style={{ borderColor: "var(--color-red)", color: "var(--color-red)" }}
              >
                Delete Node
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
