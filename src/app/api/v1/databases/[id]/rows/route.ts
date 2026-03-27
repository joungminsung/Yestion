import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { authenticateApiKey, unauthorized, notFound, forbidden, badRequest } from "@/lib/api-auth";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/databases/:id/rows — Create database row
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const { id } = await params;
  const database = await db.database.findUnique({
    where: { id },
    include: { page: { select: { workspaceId: true, id: true } } },
  });

  if (!database) return notFound("Database not found");
  if (database.page.workspaceId !== auth.workspaceId) return forbidden();

  try {
    const body = await request.json();
    const { values = {}, title = "" } = body;

    // Create a page for this row
    const page = await db.page.create({
      data: {
        workspaceId: auth.workspaceId,
        title,
        parentId: database.pageId,
        createdBy: "api",
        lastEditedBy: "api",
      },
    });

    const row = await db.row.create({
      data: {
        databaseId: id,
        pageId: page.id,
        values,
      },
      include: {
        page: { select: { id: true, title: true, icon: true, createdAt: true, updatedAt: true } },
      },
    });

    return Response.json({
      object: "page",
      id: row.page.id,
      row_id: row.id,
      title: row.page.title,
      properties: row.values,
      created_time: row.page.createdAt.toISOString(),
      last_edited_time: row.page.updatedAt.toISOString(),
    });
  } catch {
    return badRequest("Invalid request body");
  }
}
