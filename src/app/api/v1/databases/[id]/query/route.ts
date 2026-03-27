import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { authenticateApiKey, unauthorized, notFound, forbidden } from "@/lib/api-auth";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/databases/:id/query — Query database rows
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const { id } = await params;
  const database = await db.database.findUnique({
    where: { id },
    include: { page: { select: { workspaceId: true } } },
  });

  if (!database) return notFound("Database not found");
  if (database.page.workspaceId !== auth.workspaceId) return forbidden();

  const rows = await db.row.findMany({
    where: { databaseId: id },
    include: {
      page: { select: { id: true, title: true, icon: true, createdAt: true, updatedAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({
    object: "list",
    results: rows.map((row) => ({
      object: "page",
      id: row.page.id,
      row_id: row.id,
      title: row.page.title,
      icon: row.page.icon,
      properties: row.values,
      created_time: row.page.createdAt.toISOString(),
      last_edited_time: row.page.updatedAt.toISOString(),
    })),
    has_more: false,
  });
}
