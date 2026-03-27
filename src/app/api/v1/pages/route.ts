import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { authenticateApiKey, unauthorized, badRequest } from "@/lib/api-auth";

// POST /api/v1/pages — Create a page
export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  try {
    const body = await request.json();
    const { title = "", parentId, icon } = body;

    // Get next position
    const last = await db.page.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        parentId: parentId ?? null,
        isDeleted: false,
      },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (last?.position ?? -1) + 1;

    const page = await db.page.create({
      data: {
        workspaceId: auth.workspaceId,
        title,
        parentId: parentId ?? null,
        icon: icon ?? null,
        position,
        createdBy: "api",
        lastEditedBy: "api",
      },
    });

    return Response.json({
      object: "page",
      id: page.id,
      title: page.title,
      icon: page.icon,
      cover: page.cover,
      parent: parentId ? { type: "page_id", page_id: parentId } : { type: "workspace", workspace_id: auth.workspaceId },
      created_time: page.createdAt.toISOString(),
      last_edited_time: page.updatedAt.toISOString(),
      archived: false,
      url: `/pages/${page.id}`,
    });
  } catch {
    return badRequest("Invalid request body");
  }
}

// GET /api/v1/pages?all=true — List all pages
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const pages = await db.page.findMany({
    where: {
      workspaceId: auth.workspaceId,
      isDeleted: false,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      icon: true,
      parentId: true,
      createdAt: true,
      updatedAt: true,
    },
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
