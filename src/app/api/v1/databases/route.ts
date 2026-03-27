import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { authenticateApiKey, unauthorized } from "@/lib/api-auth";

// GET /api/v1/databases — List all databases in workspace
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const databases = await db.database.findMany({
    where: {
      page: {
        workspaceId: auth.workspaceId,
        isDeleted: false,
      },
    },
    include: {
      page: { select: { id: true, title: true, icon: true, createdAt: true, updatedAt: true } },
      properties: { orderBy: { position: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return Response.json({
    object: "list",
    results: databases.map((d) => ({
      object: "database",
      id: d.id,
      title: d.page.title,
      icon: d.page.icon,
      is_inline: d.isInline,
      properties: Object.fromEntries(
        d.properties.map((p) => [
          p.name,
          { id: p.id, name: p.name, type: p.type },
        ])
      ),
      created_time: d.page.createdAt.toISOString(),
      last_edited_time: d.page.updatedAt.toISOString(),
    })),
    has_more: false,
  });
}
