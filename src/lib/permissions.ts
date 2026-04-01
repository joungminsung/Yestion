import type { PrismaClient } from "@prisma/client";

export type EffectivePermission = "edit" | "comment" | "view" | "none";

export async function getEffectivePermission(
  db: PrismaClient,
  userId: string,
  pageId: string,
  depth: number = 0
): Promise<EffectivePermission> {
  if (depth > 20) return "none";

  // 1. Check direct page permission
  const directPerm = await db.pagePermission.findUnique({
    where: { pageId_userId: { pageId, userId } },
  });
  if (directPerm) return directPerm.level as EffectivePermission;

  // 2. Check workspace membership
  const page = await db.page.findUnique({ where: { id: pageId }, select: { workspaceId: true, parentId: true } });
  if (!page) return "none";

  const membership = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: page.workspaceId } },
  });

  if (membership) {
    if (["OWNER", "ADMIN"].includes(membership.role)) return "edit";
    if (membership.role === "MEMBER") return "edit";
    if (membership.role === "GUEST") {
      // Guests: check parent chain for inherited permission
      if (page.parentId) {
        return getEffectivePermission(db, userId, page.parentId, depth + 1);
      }
      return "none";
    }
  }

  // 3. Check parent page permission (inheritance)
  if (page.parentId) {
    return getEffectivePermission(db, userId, page.parentId, depth + 1);
  }

  return "none";
}
