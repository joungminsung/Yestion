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

// GET /api/v1/projects — List projects in a workspace
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) return badRequest("workspaceId required");

  // Ensure the API key belongs to the requested workspace
  if (auth.workspaceId !== workspaceId) return unauthorized();

  const projects = await db.project.findMany({
    where: { workspaceId },
    include: { _count: { select: { tasks: true } } },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ results: projects }, { headers: rateLimitHeaders() });
}

// POST /api/v1/projects — Create a project
export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  try {
    const body = await request.json();
    const { name, description, icon } = body;

    if (!name) return badRequest("name required");

    const project = await db.project.create({
      data: {
        workspaceId: auth.workspaceId,
        name,
        description: description ?? null,
        icon: icon ?? null,
        ownerId: auth.apiKeyId,
        members: {
          create: { userId: auth.apiKeyId, role: "owner" },
        },
      },
    });

    return Response.json(project, {
      status: 201,
      headers: rateLimitHeaders(),
    });
  } catch {
    return badRequest("Invalid request body");
  }
}
