import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { authenticateApiKey, unauthorized } from "@/lib/api-auth";

// POST /api/v1/search — Search pages
export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  let query = "";
  try {
    const body = await request.json();
    query = body.query ?? "";
  } catch {
    // empty query is fine
  }

  const pages = await db.page.findMany({
    where: {
      workspaceId: auth.workspaceId,
      isDeleted: false,
      ...(query
        ? { title: { contains: query, mode: "insensitive" as const } }
        : {}),
    },
    select: {
      id: true,
      title: true,
      icon: true,
      parentId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return Response.json({
    object: "list",
    results: pages.map((p) => ({
      object: "page",
      id: p.id,
      title: p.title,
      icon: p.icon,
      parent: p.parentId
        ? { type: "page_id", page_id: p.parentId }
        : { type: "workspace", workspace_id: auth.workspaceId },
      created_time: p.createdAt.toISOString(),
      last_edited_time: p.updatedAt.toISOString(),
      archived: false,
    })),
    has_more: false,
  });
}
