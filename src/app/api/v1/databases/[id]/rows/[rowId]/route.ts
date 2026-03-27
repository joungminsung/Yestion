import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { authenticateApiKey, unauthorized, notFound, forbidden, badRequest } from "@/lib/api-auth";

type RouteParams = { params: Promise<{ id: string; rowId: string }> };

// PATCH /api/v1/databases/:id/rows/:rowId — Update database row
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const { id, rowId } = await params;
  const row = await db.row.findUnique({
    where: { id: rowId },
    include: {
      database: { include: { page: { select: { workspaceId: true } } } },
    },
  });

  if (!row) return notFound("Row not found");
  if (row.databaseId !== id) return notFound("Row not found in this database");
  if (row.database.page.workspaceId !== auth.workspaceId) return forbidden();

  try {
    const body = await request.json();
    const { values = {}, title } = body;

    // Merge values
    const existingValues = (row.values as Record<string, unknown>) ?? {};
    const mergedValues = { ...existingValues, ...values };

    const updated = await db.row.update({
      where: { id: rowId },
      data: { values: mergedValues },
      include: {
        page: { select: { id: true, title: true, icon: true, createdAt: true, updatedAt: true } },
      },
    });

    // Update page title if provided
    if (title !== undefined) {
      await db.page.update({ where: { id: row.pageId }, data: { title, lastEditedBy: "api" } });
    }

    return Response.json({
      object: "page",
      id: updated.page.id,
      row_id: updated.id,
      title: title ?? updated.page.title,
      properties: updated.values,
      created_time: updated.page.createdAt.toISOString(),
      last_edited_time: updated.page.updatedAt.toISOString(),
    });
  } catch {
    return badRequest("Invalid request body");
  }
}
