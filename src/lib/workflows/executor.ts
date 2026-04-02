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
        await executeWaitNode(node.data as WaitNodeData);
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

/** Wait for the specified delay */
async function executeWaitNode(data: WaitNodeData): Promise<void> {
  if (data.waitType === "delay" && data.delayMinutes) {
    // In production this would use a job queue; for now, capped at 5 min in-process
    const waitMs = Math.min(data.delayMinutes * 60 * 1000, 5 * 60 * 1000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  // "until_date" and "until_condition" would be handled by a background scheduler
}

/** Create an approval request and wait for it */
async function executeApprovalNode(
  nodeId: string,
  data: ApprovalNodeData,
  context: WorkflowContext
): Promise<void> {
  const approval = await context.db.workflowApproval.create({
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

  // Poll for approval (in production, use a webhook/event-driven approach)
  const maxWait = (data.timeoutMinutes ?? 1440) * 60 * 1000; // default 24h
  const pollInterval = 5000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const updated = await context.db.workflowApproval.findUnique({
      where: { id: approval.id },
    });
    if (updated?.status === "approved") return;
    if (updated?.status === "rejected") {
      throw new Error("Approval rejected");
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error("Approval timed out");
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
