import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowContext,
  NodeExecutionState,
  ActionNodeData,
  ConditionNodeData,
  WaitNodeData,
  ApprovalNodeData,
  LoopNodeData,
} from "./types";
import { executeAction } from "@/lib/automation/actions";
import { evaluateConditions } from "@/lib/automation/conditions";
import type { ActionType, AutomationContext } from "@/lib/automation/types";

type NodeStates = Record<string, NodeExecutionState>;

/** Signal thrown when a wait-delay node persists state and yields control */
export class WaitDelaySignal extends Error {
  readonly resumeAt: Date;
  constructor(resumeAt: Date) {
    super("Execution paused for delay");
    this.name = "WaitDelaySignal";
    this.resumeAt = resumeAt;
  }
}

/**
 * Execute a workflow from its trigger node.
 * Walks the graph node-by-node, following edges.
 */
export async function executeWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  context: WorkflowContext
): Promise<{ success: boolean; nodeStates: NodeStates; error?: string }> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const nodeStates: NodeStates = {};

  // Find the trigger node (entry point)
  const triggerNode = nodes.find((n) => n.type === "trigger");
  if (!triggerNode) {
    return { success: false, nodeStates, error: "No trigger node found" };
  }

  // Mark trigger as completed
  nodeStates[triggerNode.id] = {
    status: "completed",
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    output: context.triggerData,
  };

  await updateExecutionState(context, nodeStates, triggerNode.id);

  // Get outgoing edges from trigger and process next nodes
  const nextNodeIds = getOutgoingNodeIds(edges, triggerNode.id);

  try {
    for (const nextId of nextNodeIds) {
      await processNode(nextId, nodeMap, edges, nodeStates, context);
    }
    await finalizeExecution(context, nodeStates, "completed");
    return { success: true, nodeStates };
  } catch (err) {
    if (err instanceof WaitDelaySignal) {
      // Execution paused — state already saved to DB; return without marking as failed
      return { success: true, nodeStates };
    }
    if (err instanceof ApprovalWaitError) {
      // Execution paused for approval — state already persisted
      return { success: true, nodeStates };
    }
    const error = err instanceof Error ? err.message : "Unknown error";
    await finalizeExecution(context, nodeStates, "failed", error);
    return { success: false, nodeStates, error };
  }
}

async function processNode(
  nodeId: string,
  nodeMap: Map<string, WorkflowNode>,
  edges: WorkflowEdge[],
  nodeStates: NodeStates,
  context: WorkflowContext,
  depth = 0
): Promise<void> {
  if (depth > 200) throw new Error("Maximum workflow depth exceeded");

  const node = nodeMap.get(nodeId);
  if (!node) throw new Error(`Node ${nodeId} not found`);

  // Mark as running
  nodeStates[nodeId] = { status: "running", startedAt: new Date().toISOString() };
  await updateExecutionState(context, nodeStates, nodeId);

  try {
    let output: unknown;
    let nextHandle: string | undefined;

    switch (node.type) {
      case "action":
        output = await executeActionNode(node.data as ActionNodeData, context);
        break;

      case "condition":
        nextHandle = evaluateConditionNode(node.data as ConditionNodeData, context)
          ? "true"
          : "false";
        output = { result: nextHandle };
        break;

      case "wait":
        await executeWaitNode(nodeId, node.data as WaitNodeData, context);
        break;

      case "approval":
        await executeApprovalNode(nodeId, node.data as ApprovalNodeData, context);
        break;

      case "loop": {
        await executeLoopNode(nodeId, node.data as LoopNodeData, nodeMap, edges, nodeStates, context, depth);
        // Loop handles its own next-node processing
        nodeStates[nodeId] = {
          ...nodeStates[nodeId],
          status: "completed",
          endedAt: new Date().toISOString(),
        };
        await updateExecutionState(context, nodeStates, nodeId);
        // Follow "done" handle after loop
        const doneNodeIds = getOutgoingNodeIds(edges, nodeId, "done");
        for (const nextId of doneNodeIds) {
          await processNode(nextId, nodeMap, edges, nodeStates, context, depth + 1);
        }
        return;
      }

      case "end":
        nodeStates[nodeId] = {
          status: "completed",
          startedAt: nodeStates[nodeId].startedAt,
          endedAt: new Date().toISOString(),
        };
        await updateExecutionState(context, nodeStates, nodeId);
        return;

      default:
        break;
    }

    // Mark as completed
    nodeStates[nodeId] = {
      ...nodeStates[nodeId],
      status: "completed",
      endedAt: new Date().toISOString(),
      output,
    };
    await updateExecutionState(context, nodeStates, nodeId);

    // Follow outgoing edges
    const nextNodeIds = getOutgoingNodeIds(edges, nodeId, nextHandle);
    for (const nextId of nextNodeIds) {
      await processNode(nextId, nodeMap, edges, nodeStates, context, depth + 1);
    }
  } catch (err) {
    // Let wait/approval signals propagate without marking the node as failed
    if (err instanceof WaitDelaySignal || err instanceof ApprovalWaitError) {
      throw err;
    }
    const error = err instanceof Error ? err.message : "Unknown error";
    nodeStates[nodeId] = {
      ...nodeStates[nodeId],
      status: "failed",
      endedAt: new Date().toISOString(),
      error,
    };
    await updateExecutionState(context, nodeStates, nodeId);
    throw err;
  }
}

/** Execute an action node using the existing automation action system */
async function executeActionNode(
  data: ActionNodeData,
  context: WorkflowContext
): Promise<unknown> {
  const automationContext: AutomationContext = {
    workspaceId: context.workspaceId,
    userId: context.userId,
    triggerData: { ...context.triggerData, ...context.variables },
    db: context.db,
  };

  const result = await executeAction(
    data.actionType as ActionType,
    data.config,
    automationContext
  );

  if (!result.success) {
    throw new Error(result.error ?? `Action ${data.actionType} failed`);
  }

  return result.data;
}

/** Evaluate a condition node, returns true/false */
function evaluateConditionNode(
  data: ConditionNodeData,
  context: WorkflowContext
): boolean {
  const conditions = [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { field: data.field, operator: data.operator as any, value: data.value },
  ];
  const evalData = { ...context.triggerData, ...context.variables };
  return evaluateConditions(conditions, evalData);
}

/** Wait for the specified delay — persists state to DB and returns instead of blocking */
async function executeWaitNode(
  nodeId: string,
  data: WaitNodeData,
  context: WorkflowContext
): Promise<void> {
  if (data.waitType === "delay" && data.delayMinutes) {
    const resumeAt = new Date(Date.now() + data.delayMinutes * 60 * 1000);

    // Persist the execution as WAITING_DELAY with a resumeAt timestamp
    await context.db.workflowExecution.update({
      where: { id: context.executionId },
      data: {
        status: "waiting_delay",
        currentNode: nodeId,
        variables: {
          ...context.variables,
          __resumeAt: resumeAt.toISOString(),
        },
      },
    });

    // Return instead of blocking — a background scheduler should pick this up
    // when Date.now() >= resumeAt and resume execution from the next node.
    throw new WaitDelaySignal(resumeAt);
  }
  // "until_date" and "until_condition" are also handled by the background scheduler
}

/**
 * Create an approval request and persist execution state.
 * Instead of polling, we save state and throw ApprovalWaitError to pause.
 * The workflow resumes via `resumeExecution` when approval is granted.
 */
async function executeApprovalNode(
  nodeId: string,
  data: ApprovalNodeData,
  context: WorkflowContext
): Promise<void> {
  await context.db.workflowApproval.create({
    data: {
      executionId: context.executionId,
      nodeId,
      assigneeId: data.assigneeId,
    },
  });

  // Update execution status to "waiting"
  await context.db.workflowExecution.update({
    where: { id: context.executionId },
    data: { status: "waiting", currentNode: nodeId },
  });

  // Send notification if assignee is set
  if (data.assigneeId) {
    await context.db.notification.create({
      data: {
        userId: data.assigneeId,
        type: "workflow_approval",
        title: "Approval Required",
        message: data.message,
      },
    });
  }

  // Persist and return -- no polling
  throw new ApprovalWaitError(nodeId);
}

/** Sentinel error to signal that the workflow should pause for approval */
class ApprovalWaitError extends Error {
  public readonly nodeId: string;
  constructor(nodeId: string) {
    super("WAITING_APPROVAL");
    this.name = "ApprovalWaitError";
    this.nodeId = nodeId;
  }
}

/**
 * Resume a workflow execution after an approval has been granted.
 * Called by the workflow router's `approve` procedure.
 */
export async function resumeExecution(
  executionId: string,
  db: any // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<void> {
  const execution = await db.workflowExecution.findUnique({
    where: { id: executionId },
    include: { workflow: true },
  });

  if (!execution || execution.status !== "waiting") return;

  const workflow = execution.workflow;
  const nodes = workflow.nodes as WorkflowNode[];
  const edges = workflow.edges as WorkflowEdge[];
  const currentNodeId = execution.currentNode;

  if (!currentNodeId) return;

  const context: WorkflowContext = {
    workspaceId: workflow.workspaceId,
    userId: workflow.createdBy,
    executionId: execution.id,
    variables: (execution.variables as Record<string, unknown>) ?? {},
    triggerData: (execution.triggerData as Record<string, unknown>) ?? {},
    db,
  };

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const nodeStates: NodeStates = (execution.nodeStates as NodeStates) ?? {};

  // Mark the approval node as completed
  nodeStates[currentNodeId] = {
    ...nodeStates[currentNodeId],
    status: "completed",
    endedAt: new Date().toISOString(),
  };

  // Update execution status back to running
  await db.workflowExecution.update({
    where: { id: executionId },
    data: { status: "running", nodeStates, currentNode: currentNodeId },
  });

  try {
    // Continue from the approval node's outgoing edges
    const nextNodeIds = getOutgoingNodeIds(edges, currentNodeId);
    for (const nextId of nextNodeIds) {
      await processNode(nextId, nodeMap, edges, nodeStates, context, 0);
    }
    await finalizeExecution(context, nodeStates, "completed");
  } catch (err) {
    if (err instanceof ApprovalWaitError || err instanceof WaitDelaySignal) {
      // Another pause node encountered -- state already persisted
      return;
    }
    const error = err instanceof Error ? err.message : "Unknown error";
    await finalizeExecution(context, nodeStates, "failed", error);
  }
}

/** Execute a loop node, iterating over a collection */
async function executeLoopNode(
  nodeId: string,
  data: LoopNodeData,
  nodeMap: Map<string, WorkflowNode>,
  edges: WorkflowEdge[],
  nodeStates: NodeStates,
  context: WorkflowContext,
  depth: number
): Promise<void> {
  const collection = context.variables[data.collection];
  if (!Array.isArray(collection)) {
    throw new Error(`Loop variable "${data.collection}" is not an array`);
  }

  const loopBodyNodeIds = getOutgoingNodeIds(edges, nodeId, "loop");
  const maxIter = Math.min(collection.length, data.maxIterations);

  for (let i = 0; i < maxIter; i++) {
    // Set the current item in variables
    context.variables[data.itemVariable] = collection[i];
    context.variables[`${data.itemVariable}_index`] = i;

    nodeStates[nodeId] = {
      ...nodeStates[nodeId],
      status: "running",
      iteration: i,
    };

    for (const bodyNodeId of loopBodyNodeIds) {
      await processNode(bodyNodeId, nodeMap, edges, nodeStates, context, depth + 1);
    }
  }
}

/** Get node IDs connected by outgoing edges from a source node */
function getOutgoingNodeIds(
  edges: WorkflowEdge[],
  sourceId: string,
  sourceHandle?: string
): string[] {
  return edges
    .filter((e) => {
      if (e.source !== sourceId) return false;
      if (sourceHandle !== undefined) return e.sourceHandle === sourceHandle;
      return true;
    })
    .map((e) => e.target);
}

/** Persist node states to the database */
async function updateExecutionState(
  context: WorkflowContext,
  nodeStates: NodeStates,
  currentNode: string
): Promise<void> {
  await context.db.workflowExecution.update({
    where: { id: context.executionId },
    data: { nodeStates, currentNode },
  });
}

/** Finalize the execution record */
async function finalizeExecution(
  context: WorkflowContext,
  nodeStates: NodeStates,
  status: "completed" | "failed",
  error?: string
): Promise<void> {
  await context.db.workflowExecution.update({
    where: { id: context.executionId },
    data: {
      status,
      nodeStates,
      completedAt: new Date(),
      error,
      currentNode: null,
    },
  });
}
