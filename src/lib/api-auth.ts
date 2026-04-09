import { db } from "@/server/db/client";
import crypto from "crypto";

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function authenticateApiKey(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const rawKey = authHeader.slice(7);
  const hashedKey = hashKey(rawKey);
  const apiKey = await db.apiKey.findUnique({
    where: { key: hashedKey },
    include: { workspace: true },
  });
  if (!apiKey) return null;

  // Verify the workspace still exists (FK may have been broken if workspace deleted)
  if (!apiKey.workspace) return null;

  return { workspaceId: apiKey.workspaceId, apiKeyId: apiKey.id, createdBy: apiKey.createdBy };
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function notFound(message = "Not found") {
  return Response.json({ error: message }, { status: 404 });
}

export function badRequest(message = "Bad request") {
  return Response.json({ error: message }, { status: 400 });
}

export function forbidden(message = "Forbidden") {
  return Response.json({ error: message }, { status: 403 });
}
