import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";
import { executeWorkflow } from "@/lib/workflows/executor";
import type { WorkflowNode, WorkflowEdge, WorkflowContext } from "@/lib/workflows/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyWorkspaceAccess(db: any, workspaceId: string, userId: string) {
  const member = await db.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!member) throw new Error("Not authorized: not a workspace member");
  return member;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      variables: z.record(z.string(), z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyWorkflowAccess(ctx.db, input.id, ctx.session.user.id);
      const { id, ...data } = input;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ctx.db.workflow.update({ where: { id }, data: data as any });
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
      triggerData: z.record(z.string(), z.any()).default({}),
    }))
    .mutation(async ({ ctx, input }) => {
      const workflow = await verifyWorkflowAccess(ctx.db, input.id, ctx.session.user.id);

      // Create execution record
      const execution = await ctx.db.workflowExecution.create({
        data: {
          workflowId: workflow.id,
          triggerData: input.triggerData as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          variables: (workflow.variables as any) ?? {}, // eslint-disable-line @typescript-eslint/no-explicit-any
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
