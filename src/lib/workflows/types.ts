/** Node types available in the workflow builder */
export type WorkflowNodeType =
  | "trigger"
  | "action"
  | "condition"
  | "wait"
  | "approval"
  | "loop"
  | "end";

/** A single node in the workflow graph */
export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
};

/** Discriminated union of node data by type */
export type WorkflowNodeData =
  | TriggerNodeData
  | ActionNodeData
  | ConditionNodeData
  | WaitNodeData
  | ApprovalNodeData
  | LoopNodeData
  | EndNodeData;

export type TriggerNodeData = {
  nodeType: "trigger";
  label: string;
  triggerType: string; // e.g. "page.created", "task.status_changed", "webhook.received", "schedule.cron"
  config: Record<string, unknown>;
};

export type ActionNodeData = {
  nodeType: "action";
  label: string;
  actionType: string; // e.g. "send_notification", "update_property", "create_task", "call_webhook", "send_email"
  config: Record<string, unknown>;
};

export type ConditionNodeData = {
  nodeType: "condition";
  label: string;
  field: string;
  operator: string; // "equals" | "not_equals" | "contains" | "gt" | "lt" | "is_empty" | "is_not_empty"
  value: unknown;
};

export type WaitNodeData = {
  nodeType: "wait";
  label: string;
  waitType: "delay" | "until_date" | "until_condition";
  delayMinutes?: number;
  untilDate?: string; // ISO date
  condition?: { field: string; operator: string; value: unknown };
};

export type ApprovalNodeData = {
  nodeType: "approval";
  label: string;
  assigneeId?: string;
  message: string;
  timeoutMinutes?: number;
};

export type LoopNodeData = {
  nodeType: "loop";
  label: string;
  collection: string; // variable name containing the array to iterate
  itemVariable: string; // variable name for current item
  maxIterations: number;
};

export type EndNodeData = {
  nodeType: "end";
  label: string;
};

/** An edge connecting two nodes */
export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // e.g. "true" | "false" for condition, "loop" | "done" for loop
  label?: string;
};

/** Per-node execution state tracked in WorkflowExecution.nodeStates */
export type NodeExecutionState = {
  status: "pending" | "running" | "completed" | "failed" | "skipped" | "waiting";
  output?: unknown;
  error?: string;
  startedAt?: string;
  endedAt?: string;
  iteration?: number; // for loop nodes
};

/** Runtime context for workflow execution */
export type WorkflowContext = {
  workspaceId: string;
  userId: string;
  executionId: string;
  variables: Record<string, unknown>;
  triggerData: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
};

/** Palette definition for the builder UI */
export type NodePaletteItem = {
  type: WorkflowNodeType;
  label: string;
  description: string;
  icon: string; // lucide icon name
  defaultData: Partial<WorkflowNodeData>;
};

export const NODE_PALETTE: NodePaletteItem[] = [
  {
    type: "trigger",
    label: "Trigger",
    description: "Event that starts the workflow",
    icon: "Zap",
    defaultData: { nodeType: "trigger", label: "Trigger", triggerType: "page.created", config: {} },
  },
  {
    type: "action",
    label: "Action",
    description: "Perform an operation",
    icon: "Play",
    defaultData: { nodeType: "action", label: "Action", actionType: "send_notification", config: {} },
  },
  {
    type: "condition",
    label: "Condition",
    description: "Branch based on a condition",
    icon: "GitBranch",
    defaultData: { nodeType: "condition", label: "Condition", field: "", operator: "equals", value: "" },
  },
  {
    type: "wait",
    label: "Wait",
    description: "Pause execution",
    icon: "Clock",
    defaultData: { nodeType: "wait", label: "Wait", waitType: "delay", delayMinutes: 5 },
  },
  {
    type: "approval",
    label: "Approval",
    description: "Wait for human approval",
    icon: "UserCheck",
    defaultData: { nodeType: "approval", label: "Approval", message: "Please approve" },
  },
  {
    type: "loop",
    label: "Loop",
    description: "Iterate over a collection",
    icon: "Repeat",
    defaultData: { nodeType: "loop", label: "Loop", collection: "items", itemVariable: "item", maxIterations: 100 },
  },
  {
    type: "end",
    label: "End",
    description: "End of workflow",
    icon: "CircleStop",
    defaultData: { nodeType: "end", label: "End" },
  },
];
