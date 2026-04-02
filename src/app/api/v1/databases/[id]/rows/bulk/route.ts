import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { authenticateApiKey, unauthorized, notFound, forbidden, badRequest } from "@/lib/api-auth";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/databases/:id/rows/bulk — Bulk operations on rows
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

  try {
    const body = await request.json();
    const { action, row_ids, values } = body;

    if (!action || !Array.isArray(row_ids) || row_ids.length === 0) {
      return badRequest("action and row_ids are required");
    }

    if (row_ids.length > 500) {
      return badRequest("Maximum 500 rows per bulk operation");
    }

    const rows = await db.row.findMany({
      where: { id: { in: row_ids }, databaseId: id },
      select: { id: true, pageId: true, values: true },
    });

    switch (action) {
      case "delete": {
        const pageIds = rows.map((r) => r.pageId);
        await db.$transaction(async (tx) => {
          await tx.row.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
          await tx.page.deleteMany({ where: { id: { in: pageIds } } });
        });
        return Response.json({
          object: "bulk_operation",
          action: "delete",
          affected_count: rows.length,
        });
      }

      case "update": {
        if (!values || typeof values !== "object") {
          return badRequest("values object is required for update action");
        }
        await Promise.all(
          rows.map((row) => {
            const existingValues = (row.values as Record<string, unknown>) ?? {};
            const mergedValues = { ...existingValues, ...values };
            return db.row.update({
              where: { id: row.id },
              data: { values: mergedValues },
            });
          }),
        );
        return Response.json({
          object: "bulk_operation",
          action: "update",
          affected_count: rows.length,
        });
      }

      default:
        return badRequest(`Unknown action: ${action}. Supported: delete, update`);
    }
  } catch {
    return badRequest("Invalid request body");
  }
}
