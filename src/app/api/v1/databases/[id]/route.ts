import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { authenticateApiKey, unauthorized, notFound, forbidden } from "@/lib/api-auth";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/databases/:id — Get database
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const { id } = await params;
  const database = await db.database.findUnique({
    where: { id },
    include: {
      page: true,
      properties: { orderBy: { position: "asc" } },
      views: { orderBy: { position: "asc" } },
    },
  });

  if (!database) return notFound("Database not found");
  if (database.page.workspaceId !== auth.workspaceId) return forbidden();

  return Response.json({
    object: "database",
    id: database.id,
    title: database.page.title,
    icon: database.page.icon,
    is_inline: database.isInline,
    properties: Object.fromEntries(
      database.properties.map((p) => [
        p.name,
        { id: p.id, name: p.name, type: p.type, config: p.config },
      ])
    ),
    views: database.views.map((v) => ({
      id: v.id,
      name: v.name,
      type: v.type,
    })),
    created_time: database.createdAt.toISOString(),
    last_edited_time: database.updatedAt.toISOString(),
  });
}

// DELETE /api/v1/databases/:id — Delete database and all contents
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const { id } = await params;
  const database = await db.database.findUnique({
    where: { id },
    include: { page: { select: { workspaceId: true, id: true } } },
  });

  if (!database) return notFound("Database not found");
  if (database.page.workspaceId !== auth.workspaceId) return forbidden();

  // Delete all contents in a transaction
  const rows = await db.row.findMany({
    where: { databaseId: id },
    select: { pageId: true },
  });
  const pageIds = rows.map((r) => r.pageId);

  await db.$transaction(async (tx) => {
    await tx.rowTemplate.deleteMany({ where: { databaseId: id } });
    await tx.row.deleteMany({ where: { databaseId: id } });
    await tx.databaseView.deleteMany({ where: { databaseId: id } });
    await tx.property.deleteMany({ where: { databaseId: id } });
    await tx.database.delete({ where: { id } });
    if (pageIds.length > 0) {
      await tx.page.deleteMany({ where: { id: { in: pageIds } } });
    }
    await tx.page.delete({ where: { id: database.page.id } });
  });

  return Response.json({ object: "database", id, deleted: true });
}
