import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { authenticateApiKey, unauthorized, badRequest } from "@/lib/api-auth";

function rateLimitHeaders() {
  return {
    "X-RateLimit-Limit": "300",
    "X-RateLimit-Remaining": "299",
    "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
  };
}

// GET /api/v1/tasks — List tasks for a project
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return badRequest("projectId required");

  const status = url.searchParams.get("status");
  const assigneeId = url.searchParams.get("assigneeId");

  // Verify the project belongs to the authenticated workspace
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: auth.workspaceId },
    select: { id: true },
  });
  if (!project) return badRequest("projectId not found in workspace");

  const where: Record<string, unknown> = { projectId, parentTaskId: null };
  if (status) where.status = status;
  if (assigneeId) where.assigneeId = assigneeId;

  const tasks = await db.task.findMany({
    where,
    include: { _count: { select: { subtasks: true } } },
    orderBy: [{ position: "asc" }],
  });

  return Response.json({ results: tasks }, { headers: rateLimitHeaders() });
}

// POST /api/v1/tasks — Create a task
export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  try {
    const body = await request.json();
    const { projectId, title, status, priority, assigneeId, dueDate, labels } = body;

    if (!projectId || !title) return badRequest("projectId and title required");

    // Verify the project belongs to the authenticated workspace
    const project = await db.project.findFirst({
      where: { id: projectId, workspaceId: auth.workspaceId },
      select: { id: true },
    });
    if (!project) return badRequest("projectId not found in workspace");

    const task = await db.task.create({
      data: {
        projectId,
        title,
        status: status ?? "todo",
        priority: priority ?? "medium",
        assigneeId: assigneeId ?? null,
        dueDate: dueDate ? new Date(dueDate) : null,
        labels: labels ?? [],
        reporterId: auth.apiKeyId,
      },
    });

    return Response.json(task, {
      status: 201,
      headers: rateLimitHeaders(),
    });
  } catch {
    return badRequest("Invalid request body");
  }
}
