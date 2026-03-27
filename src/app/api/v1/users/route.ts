import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { authenticateApiKey, unauthorized } from "@/lib/api-auth";

// GET /api/v1/users — List workspace users
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const members = await db.workspaceMember.findMany({
    where: { workspaceId: auth.workspaceId },
    include: {
      user: {
        select: { id: true, email: true, name: true, avatarUrl: true },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  return Response.json({
    object: "list",
    results: members.map((m) => ({
      object: "user",
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatar_url: m.user.avatarUrl,
      role: m.role,
    })),
    has_more: false,
  });
}
