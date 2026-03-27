import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { authenticateApiKey, unauthorized, notFound, forbidden, badRequest } from "@/lib/api-auth";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/pages/:id
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const { id } = await params;
  const page = await db.page.findUnique({
    where: { id },
    include: {
      blocks: {
        where: { parentId: null },
        orderBy: { position: "asc" },
        include: {
          children: { orderBy: { position: "asc" } },
        },
      },
    },
  });

  if (!page) return notFound("Page not found");
  if (page.workspaceId !== auth.workspaceId) return forbidden();

  return Response.json({
    object: "page",
    id: page.id,
    title: page.title,
    icon: page.icon,
    cover: page.cover,
    parent: page.parentId
      ? { type: "page_id", page_id: page.parentId }
      : { type: "workspace", workspace_id: page.workspaceId },
    created_time: page.createdAt.toISOString(),
    last_edited_time: page.updatedAt.toISOString(),
    archived: page.isDeleted,
    properties: {},
    children: page.blocks.map(formatBlock),
  });
}

// PATCH /api/v1/pages/:id
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const { id } = await params;
  const page = await db.page.findUnique({ where: { id } });
  if (!page) return notFound("Page not found");
  if (page.workspaceId !== auth.workspaceId) return forbidden();

  try {
    const body = await request.json();
    const updated = await db.page.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.icon !== undefined && { icon: body.icon }),
        ...(body.cover !== undefined && { cover: body.cover }),
        lastEditedBy: "api",
      },
    });

    return Response.json({
      object: "page",
      id: updated.id,
      title: updated.title,
      icon: updated.icon,
      cover: updated.cover,
      last_edited_time: updated.updatedAt.toISOString(),
      archived: updated.isDeleted,
    });
  } catch {
    return badRequest("Invalid request body");
  }
}

// DELETE /api/v1/pages/:id — Move to trash
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const { id } = await params;
  const page = await db.page.findUnique({ where: { id } });
  if (!page) return notFound("Page not found");
  if (page.workspaceId !== auth.workspaceId) return forbidden();

  await db.page.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date(), lastEditedBy: "api" },
  });

  return Response.json({ object: "page", id, archived: true });
}

function formatBlock(block: { id: string; type: string; content: unknown; children?: { id: string; type: string; content: unknown }[] }) {
  return {
    object: "block",
    id: block.id,
    type: block.type,
    [block.type]: block.content,
    has_children: (block.children?.length ?? 0) > 0,
    children: block.children?.map((c) => ({
      object: "block",
      id: c.id,
      type: c.type,
      [c.type]: c.content,
      has_children: false,
    })),
  };
}
