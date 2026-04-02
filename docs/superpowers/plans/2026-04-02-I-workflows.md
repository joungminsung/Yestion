# Visual Workflow Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visual workflow builder with ReactFlow where users create multi-step automations using drag-and-drop nodes for triggers, actions, conditions, waits, approvals, and loops.
**Architecture:** New Prisma models (Workflow, WorkflowExecution, WorkflowApproval) store workflow definitions as JSON node/edge graphs. A server-side executor walks the graph node-by-node, handling branching conditions, delays, approval gates, and loop iterations. The client uses ReactFlow for a canvas-based builder with custom node components and a configuration sidebar. Execution history provides a timeline with per-node status for debugging.
**Tech Stack:** Prisma, tRPC, @xyflow/react (ReactFlow), React 18, Tailwind CSS, date-fns

---

## File Structure

### New Files
- `prisma/migrations/<timestamp>_add_workflow_models/migration.sql` (auto-generated)
- `src/lib/workflows/types.ts`
- `src/lib/workflows/executor.ts`
- `src/server/routers/workflow.ts`
- `src/components/workflow/nodes/trigger-node.tsx`
- `src/components/workflow/nodes/action-node.tsx`
- `src/components/workflow/nodes/condition-node.tsx`
- `src/components/workflow/nodes/wait-node.tsx`
- `src/components/workflow/nodes/approval-node.tsx`
- `src/components/workflow/nodes/loop-node.tsx`
- `src/components/workflow/nodes/end-node.tsx`
- `src/components/workflow/workflow-builder.tsx`
- `src/components/workflow/execution-history.tsx`
- `src/app/(main)/[workspaceId]/workflows/page.tsx`

### Modified Files
- `prisma/schema.prisma`
- `src/server/trpc/router.ts`
- `package.json`

---

### Task 1: Install ReactFlow, Add Workflow Prisma Models
**Files:**
- Modify: `package.json`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Install ReactFlow**

```bash
npm install @xyflow/react
```

- [ ] **Step 2: Add Workflow model to Prisma schema**

In `prisma/schema.prisma`, add after the `AutomationLog` model:

```prisma
model Workflow {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  description String?
  isEnabled   Boolean  @default(false)
  nodes       Json     @default("[]") // WorkflowNode[]
  edges       Json     @default("[]") // WorkflowEdge[]
  variables   Json     @default("{}") // default variable values
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  executions  WorkflowExecution[]

  @@index([workspaceId])
  @@index([isEnabled])
}

model WorkflowExecution {
  id          String    @id @default(cuid())
  workflowId  String
  status      String    @default("running") // "running" | "completed" | "failed" | "waiting" | "cancelled"
  triggerData Json?
  variables   Json      @default("{}")
  nodeStates  Json      @default("{}") // { [nodeId]: { status, output, error, startedAt, endedAt } }
  currentNode String?
  error       String?
  startedAt   DateTime  @default(now())
  completedAt DateTime?

  workflow    Workflow   @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  approvals   WorkflowApproval[]

  @@index([workflowId])
  @@index([status])
  @@index([startedAt])
}

model WorkflowApproval {
  id          String    @id @default(cuid())
  executionId String
  nodeId      String
  status      String    @default("pending") // "pending" | "approved" | "rejected"
  assigneeId  String?
  decidedBy   String?
  decidedAt   DateTime?
  comment     String?
  createdAt   DateTime  @default(now())

  execution   WorkflowExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  @@index([executionId])
  @@index([assigneeId, status])
}
```

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name add_workflow_models
```

- [ ] **Step 4: Commit**

```bash
git add prisma/ package.json package-lock.json
git commit -m "feat: add Workflow, WorkflowExecution, WorkflowApproval models and install ReactFlow"
```

---

### Task 2: Workflow Types
**Files:**
- Create: `src/lib/workflows/types.ts`

- [ ] **Step 1: Create the workflow type definitions**

Create `src/lib/workflows/types.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/workflows/types.ts
git commit -m "feat: add workflow type definitions for nodes, edges, and execution context"
```

---

### Task 3: Workflow Executor
**Files:**
- Create: `src/lib/workflows/executor.ts`

- [ ] **Step 1: Create the workflow executor**

Create `src/lib/workflows/executor.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/workflows/executor.ts
git commit -m "feat: add workflow executor with condition branching, wait, approval, and loop"
```

---

### Task 4: Workflow Router
**Files:**
- Create: `src/server/routers/workflow.ts`
- Modify: `src/server/trpc/router.ts`

- [ ] **Step 1: Create the workflow router**

Create `src/server/routers/workflow.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";
import { executeWorkflow } from "@/lib/workflows/executor";
import type { WorkflowNode, WorkflowEdge, WorkflowContext } from "@/lib/workflows/types";

async function verifyWorkspaceAccess(db: any, workspaceId: string, userId: string) {
  const member = await db.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!member) throw new Error("Not authorized: not a workspace member");
  return member;
}

async function verifyWorkflowAccess(db: any, workflowId: string, userId: string) {
  const workflow = await db.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) throw new Error("Workflow not found");
  await verifyWorkspaceAccess(db, workflow.workspaceId, userId);
  return workflow;
}

export const workflowRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyWorkspaceAccess(ctx.db, input.workspaceId, ctx.session.user.id);
      return ctx.db.workflow.findMany({
        where: { workspaceId: input.workspaceId },
        include: { _count: { select: { executions: true } } },
        orderBy: { updatedAt: "desc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const workflow = await verifyWorkflowAccess(ctx.db, input.id, ctx.session.user.id);
      return workflow;
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyWorkspaceAccess(ctx.db, input.workspaceId, ctx.session.user.id);
      return ctx.db.workflow.create({
        data: {
          ...input,
          createdBy: ctx.session.user.id,
          // Start with a default trigger node
          nodes: [
            {
              id: "trigger-1",
              type: "trigger",
              position: { x: 250, y: 50 },
              data: { nodeType: "trigger", label: "Trigger", triggerType: "page.created", config: {} },
            },
          ],
          edges: [],
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      isEnabled: z.boolean().optional(),
      nodes: z.array(z.any()).optional(),
      edges: z.array(z.any()).optional(),
      variables: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyWorkflowAccess(ctx.db, input.id, ctx.session.user.id);
      const { id, ...data } = input;
      return ctx.db.workflow.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyWorkflowAccess(ctx.db, input.id, ctx.session.user.id);
      return ctx.db.workflow.delete({ where: { id: input.id } });
    }),

  /** Execute a workflow manually */
  execute: protectedProcedure
    .input(z.object({
      id: z.string(),
      triggerData: z.record(z.unknown()).default({}),
    }))
    .mutation(async ({ ctx, input }) => {
      const workflow = await verifyWorkflowAccess(ctx.db, input.id, ctx.session.user.id);

      // Create execution record
      const execution = await ctx.db.workflowExecution.create({
        data: {
          workflowId: workflow.id,
          triggerData: input.triggerData,
          variables: workflow.variables ?? {},
        },
      });

      const context: WorkflowContext = {
        workspaceId: workflow.workspaceId,
        userId: ctx.session.user.id,
        executionId: execution.id,
        variables: (workflow.variables as Record<string, unknown>) ?? {},
        triggerData: input.triggerData,
        db: ctx.db,
      };

      // Execute asynchronously (don't block the response)
      const nodes = workflow.nodes as WorkflowNode[];
      const edges = workflow.edges as WorkflowEdge[];

      // Fire and forget — execution updates its own status
      executeWorkflow(nodes, edges, context).catch(async (err) => {
        await ctx.db.workflowExecution.update({
          where: { id: execution.id },
          data: {
            status: "failed",
            error: err instanceof Error ? err.message : "Unknown error",
            completedAt: new Date(),
          },
        });
      });

      return execution;
    }),

  /** Approve or reject a pending approval */
  approve: protectedProcedure
    .input(z.object({
      approvalId: z.string(),
      decision: z.enum(["approved", "rejected"]),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const approval = await ctx.db.workflowApproval.findUnique({
        where: { id: input.approvalId },
        include: { execution: { include: { workflow: true } } },
      });
      if (!approval) throw new Error("Approval not found");

      // Verify user has access
      await verifyWorkspaceAccess(
        ctx.db,
        approval.execution.workflow.workspaceId,
        ctx.session.user.id
      );

      return ctx.db.workflowApproval.update({
        where: { id: input.approvalId },
        data: {
          status: input.decision,
          decidedBy: ctx.session.user.id,
          decidedAt: new Date(),
          comment: input.comment,
        },
      });
    }),

  /** Get execution history for a workflow */
  executions: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      await verifyWorkflowAccess(ctx.db, input.workflowId, ctx.session.user.id);
      return ctx.db.workflowExecution.findMany({
        where: { workflowId: input.workflowId },
        include: { approvals: true },
        orderBy: { startedAt: "desc" },
        take: input.limit,
      });
    }),

  /** Get a single execution with full details */
  getExecution: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const execution = await ctx.db.workflowExecution.findUnique({
        where: { id: input.id },
        include: {
          workflow: true,
          approvals: true,
        },
      });
      if (!execution) throw new Error("Execution not found");
      await verifyWorkspaceAccess(
        ctx.db,
        execution.workflow.workspaceId,
        ctx.session.user.id
      );
      return execution;
    }),

  /** Pending approvals for the current user */
  pendingApprovals: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyWorkspaceAccess(ctx.db, input.workspaceId, ctx.session.user.id);
      return ctx.db.workflowApproval.findMany({
        where: {
          status: "pending",
          OR: [
            { assigneeId: ctx.session.user.id },
            { assigneeId: null },
          ],
          execution: {
            workflow: { workspaceId: input.workspaceId },
          },
        },
        include: {
          execution: {
            include: { workflow: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),
});
```

- [ ] **Step 2: Register workflow router in app router**

In `src/server/trpc/router.ts`, add import:
```typescript
import { workflowRouter } from "@/server/routers/workflow";
```

Add to the router object:
```typescript
  workflow: workflowRouter,
```

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/workflow.ts src/server/trpc/router.ts
git commit -m "feat: add workflow router with CRUD, execute, approve, execution history"
```

---

### Task 5: Custom ReactFlow Nodes
**Files:**
- Create: `src/components/workflow/nodes/trigger-node.tsx`
- Create: `src/components/workflow/nodes/action-node.tsx`
- Create: `src/components/workflow/nodes/condition-node.tsx`
- Create: `src/components/workflow/nodes/wait-node.tsx`
- Create: `src/components/workflow/nodes/approval-node.tsx`
- Create: `src/components/workflow/nodes/loop-node.tsx`
- Create: `src/components/workflow/nodes/end-node.tsx`

- [ ] **Step 1: Create the trigger node**

Create `src/components/workflow/nodes/trigger-node.tsx`:

```tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Zap } from "lucide-react";
import type { TriggerNodeData } from "@/lib/workflows/types";

function TriggerNodeComponent({ data, selected }: NodeProps & { data: TriggerNodeData }) {
  return (
    <div
      className="px-4 py-3 rounded-lg border-2 min-w-[180px] shadow-sm"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: selected ? "#F59E0B" : "var(--color-yellow)",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded" style={{ backgroundColor: "rgba(245,158,11,0.15)" }}>
          <Zap size={14} style={{ color: "var(--color-yellow)" }} />
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {data.label}
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        {data.triggerType}
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
```

- [ ] **Step 2: Create the action node**

Create `src/components/workflow/nodes/action-node.tsx`:

```tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";
import type { ActionNodeData } from "@/lib/workflows/types";

function ActionNodeComponent({ data, selected }: NodeProps & { data: ActionNodeData }) {
  return (
    <div
      className="px-4 py-3 rounded-lg border-2 min-w-[180px] shadow-sm"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: selected ? "#3B82F6" : "var(--accent-blue, #2383e2)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded" style={{ backgroundColor: "rgba(35,131,226,0.15)" }}>
          <Play size={14} style={{ color: "var(--accent-blue)" }} />
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {data.label}
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        {data.actionType}
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

export const ActionNode = memo(ActionNodeComponent);
```

- [ ] **Step 3: Create the condition node**

Create `src/components/workflow/nodes/condition-node.tsx`:

```tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import type { ConditionNodeData } from "@/lib/workflows/types";

function ConditionNodeComponent({ data, selected }: NodeProps & { data: ConditionNodeData }) {
  return (
    <div
      className="px-4 py-3 rounded-lg border-2 min-w-[180px] shadow-sm"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: selected ? "#8B5CF6" : "var(--color-purple)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded" style={{ backgroundColor: "rgba(139,92,246,0.15)" }}>
          <GitBranch size={14} style={{ color: "var(--color-purple)" }} />
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {data.label}
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        {data.field} {data.operator} {String(data.value ?? "")}
      </p>
      <div className="flex justify-between mt-2">
        <div className="relative">
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!bg-green-500 !w-3 !h-3 !border-2 !border-white !left-0"
          />
          <span className="text-[10px] absolute -bottom-4 left-0" style={{ color: "var(--color-green)" }}>
            True
          </span>
        </div>
        <div className="relative">
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!bg-red-500 !w-3 !h-3 !border-2 !border-white !right-0 !left-auto"
          />
          <span className="text-[10px] absolute -bottom-4 right-0" style={{ color: "var(--color-red)" }}>
            False
          </span>
        </div>
      </div>
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
```

- [ ] **Step 4: Create the wait node**

Create `src/components/workflow/nodes/wait-node.tsx`:

```tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Clock } from "lucide-react";
import type { WaitNodeData } from "@/lib/workflows/types";

function WaitNodeComponent({ data, selected }: NodeProps & { data: WaitNodeData }) {
  const description =
    data.waitType === "delay"
      ? `Wait ${data.delayMinutes ?? 0} minutes`
      : data.waitType === "until_date"
        ? `Until ${data.untilDate ?? "..."}`
        : "Until condition met";

  return (
    <div
      className="px-4 py-3 rounded-lg border-2 min-w-[180px] shadow-sm"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: selected ? "#6B7280" : "var(--color-gray)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded" style={{ backgroundColor: "rgba(107,114,128,0.15)" }}>
          <Clock size={14} style={{ color: "var(--color-gray)" }} />
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {data.label}
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        {description}
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

export const WaitNode = memo(WaitNodeComponent);
```

- [ ] **Step 5: Create the approval node**

Create `src/components/workflow/nodes/approval-node.tsx`:

```tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { UserCheck } from "lucide-react";
import type { ApprovalNodeData } from "@/lib/workflows/types";

function ApprovalNodeComponent({ data, selected }: NodeProps & { data: ApprovalNodeData }) {
  return (
    <div
      className="px-4 py-3 rounded-lg border-2 min-w-[180px] shadow-sm"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: selected ? "#F97316" : "var(--color-orange)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-orange-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded" style={{ backgroundColor: "rgba(249,115,22,0.15)" }}>
          <UserCheck size={14} style={{ color: "var(--color-orange)" }} />
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {data.label}
        </span>
      </div>
      <p className="text-xs line-clamp-2" style={{ color: "var(--text-tertiary)" }}>
        {data.message}
      </p>
      {data.timeoutMinutes && (
        <p className="text-[10px] mt-1" style={{ color: "var(--text-placeholder)" }}>
          Timeout: {data.timeoutMinutes}m
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-orange-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

export const ApprovalNode = memo(ApprovalNodeComponent);
```

- [ ] **Step 6: Create the loop node**

Create `src/components/workflow/nodes/loop-node.tsx`:

```tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Repeat } from "lucide-react";
import type { LoopNodeData } from "@/lib/workflows/types";

function LoopNodeComponent({ data, selected }: NodeProps & { data: LoopNodeData }) {
  return (
    <div
      className="px-4 py-3 rounded-lg border-2 min-w-[180px] shadow-sm"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: selected ? "#10B981" : "var(--color-green)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-green-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded" style={{ backgroundColor: "rgba(16,185,129,0.15)" }}>
          <Repeat size={14} style={{ color: "var(--color-green)" }} />
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {data.label}
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        for {data.itemVariable} in {data.collection}
      </p>
      <p className="text-[10px]" style={{ color: "var(--text-placeholder)" }}>
        max {data.maxIterations} iterations
      </p>
      <div className="flex justify-between mt-2">
        <div className="relative">
          <Handle
            type="source"
            position={Position.Bottom}
            id="loop"
            className="!bg-green-500 !w-3 !h-3 !border-2 !border-white !left-0"
          />
          <span className="text-[10px] absolute -bottom-4 left-0" style={{ color: "var(--color-green)" }}>
            Loop
          </span>
        </div>
        <div className="relative">
          <Handle
            type="source"
            position={Position.Bottom}
            id="done"
            className="!bg-gray-500 !w-3 !h-3 !border-2 !border-white !right-0 !left-auto"
          />
          <span className="text-[10px] absolute -bottom-4 right-0" style={{ color: "var(--text-tertiary)" }}>
            Done
          </span>
        </div>
      </div>
    </div>
  );
}

export const LoopNode = memo(LoopNodeComponent);
```

- [ ] **Step 7: Create the end node**

Create `src/components/workflow/nodes/end-node.tsx`:

```tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CircleStop } from "lucide-react";
import type { EndNodeData } from "@/lib/workflows/types";

function EndNodeComponent({ data, selected }: NodeProps & { data: EndNodeData }) {
  return (
    <div
      className="px-4 py-3 rounded-lg border-2 min-w-[120px] shadow-sm text-center"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: selected ? "#EF4444" : "var(--color-red)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-red-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center justify-center gap-2">
        <div className="p-1 rounded" style={{ backgroundColor: "rgba(239,68,68,0.15)" }}>
          <CircleStop size={14} style={{ color: "var(--color-red)" }} />
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {data.label}
        </span>
      </div>
    </div>
  );
}

export const EndNode = memo(EndNodeComponent);
```

- [ ] **Step 8: Commit**

```bash
git add src/components/workflow/nodes/
git commit -m "feat: add custom ReactFlow node components for all workflow node types"
```

---

### Task 6: Workflow Builder UI
**Files:**
- Create: `src/components/workflow/workflow-builder.tsx`

- [ ] **Step 1: Create the workflow builder**

Create `src/components/workflow/workflow-builder.tsx`:

```tsx
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
import { NODE_PALETTE, type WorkflowNode, type WorkflowEdge } from "@/lib/workflows/types";
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
      nodes: nodes as any,
      edges: edges as any,
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
                value={(selectedNode.data as any).label ?? ""}
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
                  value={(selectedNode.data as any).triggerType ?? ""}
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
                  value={(selectedNode.data as any).actionType ?? ""}
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
                    value={(selectedNode.data as any).field ?? ""}
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
                    value={(selectedNode.data as any).operator ?? "equals"}
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
                    value={String((selectedNode.data as any).value ?? "")}
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
                  value={(selectedNode.data as any).delayMinutes ?? 5}
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
                  value={(selectedNode.data as any).message ?? ""}
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
                    value={(selectedNode.data as any).collection ?? ""}
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
                    value={(selectedNode.data as any).itemVariable ?? ""}
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
                    value={(selectedNode.data as any).maxIterations ?? 100}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workflow/workflow-builder.tsx
git commit -m "feat: add ReactFlow workflow builder with node palette and config panel"
```

---

### Task 7: Workflow Page
**Files:**
- Create: `src/app/(main)/[workspaceId]/workflows/page.tsx`

- [ ] **Step 1: Create the workflows page**

Create `src/app/(main)/[workspaceId]/workflows/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(main\)/\[workspaceId\]/workflows/page.tsx
git commit -m "feat: add workflows page with list, create, and navigation to builder"
```

---

### Task 8: Execution History UI
**Files:**
- Create: `src/components/workflow/execution-history.tsx`

- [ ] **Step 1: Create the execution history component**

Create `src/components/workflow/execution-history.tsx`:

```tsx
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

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  completed: { icon: CheckCircle, color: "var(--color-green)", label: "Completed" },
  failed: { icon: XCircle, color: "var(--color-red)", label: "Failed" },
  running: { icon: Loader2, color: "var(--accent-blue)", label: "Running" },
  waiting: { icon: Clock, color: "var(--color-yellow)", label: "Waiting" },
  cancelled: { icon: Ban, color: "var(--text-tertiary)", label: "Cancelled" },
};

const NODE_STATUS_CONFIG: Record<string, { color: string }> = {
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
            const config = STATUS_CONFIG[exec.status] ?? STATUS_CONFIG.running;
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
                    const config = STATUS_CONFIG[selectedExecution.status] ?? STATUS_CONFIG.running;
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
                  const nodeConfig = NODE_STATUS_CONFIG[state.status] ?? NODE_STATUS_CONFIG.pending;
                  // Find the node definition for this ID
                  const workflowNodes = (selectedExecution.workflow?.nodes ?? []) as any[];
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workflow/execution-history.tsx
git commit -m "feat: add workflow execution history with node timeline, debug view, and approvals"
```
