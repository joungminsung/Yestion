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
