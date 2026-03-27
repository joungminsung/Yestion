import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { authenticateApiKey, unauthorized, notFound, forbidden, badRequest } from "@/lib/api-auth";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/v1/blocks/:id — Update block
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const { id } = await params;
  const block = await db.block.findUnique({
    where: { id },
    include: { page: { select: { workspaceId: true } } },
  });
  if (!block) return notFound("Block not found");
  if (block.page.workspaceId !== auth.workspaceId) return forbidden();

  try {
    const body = await request.json();
    const updated = await db.block.update({
      where: { id },
      data: {
        ...(body.type !== undefined && { type: body.type }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body[block.type] !== undefined && { content: body[block.type] }),
      },
    });

    await db.page.update({ where: { id: block.pageId }, data: { lastEditedBy: "api" } });

    return Response.json({
      object: "block",
      id: updated.id,
      type: updated.type,
      [updated.type]: updated.content,
    });
  } catch {
    return badRequest("Invalid request body");
  }
}

// DELETE /api/v1/blocks/:id — Delete block
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const { id } = await params;
  const block = await db.block.findUnique({
    where: { id },
    include: { page: { select: { workspaceId: true } } },
  });
  if (!block) return notFound("Block not found");
  if (block.page.workspaceId !== auth.workspaceId) return forbidden();

  await db.block.delete({ where: { id } });
  await db.page.update({ where: { id: block.pageId }, data: { lastEditedBy: "api" } });

  return Response.json({ object: "block", id, archived: true });
}
