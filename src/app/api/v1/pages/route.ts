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

    if (parentId) {
      const parentPage = await db.page.findUnique({
        where: { id: parentId },
        select: {
          id: true,
          workspaceId: true,
          isDeleted: true,
        },
      });

      if (!parentPage || parentPage.isDeleted) {
        return badRequest("Parent page not found");
      }

      if (parentPage.workspaceId !== auth.workspaceId) {
        return badRequest("Parent page must belong to the same workspace");
      }
    }

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
        createdBy: auth.createdBy,
        lastEditedBy: auth.createdBy,
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

// GET /api/v1/pages — List pages with pagination
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("page_size") || "100", 10) || 100, 100);
  const cursor = url.searchParams.get("start_cursor");

  const pages = await db.page.findMany({
    where: {
      workspaceId: auth.workspaceId,
      isDeleted: false,
    },
    orderBy: { updatedAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      icon: true,
      parentId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const hasMore = pages.length > limit;
  const results = hasMore ? pages.slice(0, limit) : pages;
  const lastResult = results[results.length - 1];
  const nextCursor = hasMore && lastResult ? lastResult.id : null;

  return Response.json({
    object: "list",
    results: results.map((p) => ({
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
    has_more: hasMore,
    next_cursor: nextCursor,
  });
}
