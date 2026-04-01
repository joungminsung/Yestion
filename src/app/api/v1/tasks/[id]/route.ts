import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { authenticateApiKey, unauthorized, notFound } from "@/lib/api-auth";

// GET /api/v1/tasks/[id] — Get a single task with subtasks
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const task = await db.task.findFirst({
    where: {
      id: params.id,
      project: { workspaceId: auth.workspaceId },
    },
    include: { subtasks: true },
  });

  if (!task) return notFound("Task not found");

  return Response.json(task);
}

// PATCH /api/v1/tasks/[id] — Update a task
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  // Verify ownership via workspace
  const existing = await db.task.findFirst({
    where: { id: params.id, project: { workspaceId: auth.workspaceId } },
    select: { id: true },
  });
  if (!existing) return notFound("Task not found");

  const body = await request.json();
  const { title, status, priority, assigneeId, dueDate, labels } = body;

  const task = await db.task.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      ...(assigneeId !== undefined && { assigneeId }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(labels !== undefined && { labels }),
    },
  });

  return Response.json(task);
}

// DELETE /api/v1/tasks/[id] — Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const existing = await db.task.findFirst({
    where: { id: params.id, project: { workspaceId: auth.workspaceId } },
    select: { id: true },
  });
  if (!existing) return notFound("Task not found");

  await db.task.delete({ where: { id: params.id } });

  return Response.json({ deleted: true });
}
