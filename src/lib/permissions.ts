import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient, Role } from "@prisma/client";

export type EffectivePermission = "edit" | "comment" | "view" | "none";

export const WORKSPACE_PERMISSION_KEYS = [
  "page.create",
  "page.edit",
  "page.delete",
  "page.share",
  "member.invite",
  "member.remove",
  "member.changeRole",
  "workspace.settings",
  "workspace.billing",
  "database.create",
  "database.edit",
  "database.delete",
  "webhook.manage",
  "apikey.manage",
  "integration.manage",
  "backup.manage",
] as const;

export type WorkspacePermissionKey = (typeof WORKSPACE_PERMISSION_KEYS)[number];

type WorkspaceMembership = Awaited<ReturnType<typeof getWorkspaceMembership>>;

const DEFAULT_ROLE_PERMISSIONS: Record<Role, WorkspacePermissionKey[]> = {
  OWNER: [...WORKSPACE_PERMISSION_KEYS],
  ADMIN: [...WORKSPACE_PERMISSION_KEYS],
  MEMBER: [
    "page.create",
    "page.edit",
    "database.create",
    "database.edit",
  ],
  GUEST: [],
};

function normalizePermissionList(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function getMembershipPermissionSet(membership: WorkspaceMembership | null): Set<string> {
  if (!membership) {
    return new Set();
  }

  if (membership.role === "OWNER") {
    return new Set(WORKSPACE_PERMISSION_KEYS);
  }

  const customPermissions = normalizePermissionList(membership.customRole?.permissions as Prisma.JsonValue | undefined);
  if (membership.customRole && customPermissions.length > 0) {
    return new Set(customPermissions);
  }

  return new Set(DEFAULT_ROLE_PERMISSIONS[membership.role]);
}

export async function getWorkspaceMembership(
  db: PrismaClient,
  userId: string,
  workspaceId: string,
) {
  return db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: {
      customRole: {
        select: {
          id: true,
          name: true,
          permissions: true,
          isBuiltIn: true,
        },
      },
    },
  });
}

export function hasWorkspacePermissionForMembership(
  membership: WorkspaceMembership | null,
  permission: WorkspacePermissionKey,
): boolean {
  return getMembershipPermissionSet(membership).has(permission);
}

export async function hasWorkspacePermission(
  db: PrismaClient,
  userId: string,
  workspaceId: string,
  permission: WorkspacePermissionKey,
): Promise<boolean> {
  const membership = await getWorkspaceMembership(db, userId, workspaceId);
  return hasWorkspacePermissionForMembership(membership, permission);
}

export async function requireWorkspaceMembership(
  db: PrismaClient,
  userId: string,
  workspaceId: string,
) {
  const membership = await getWorkspaceMembership(db, userId, workspaceId);
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a workspace member" });
  }

  return membership;
}

export async function requireWorkspacePermission(
  db: PrismaClient,
  userId: string,
  workspaceId: string,
  permission: WorkspacePermissionKey,
  message = "You do not have permission to perform this action",
) {
  const membership = await requireWorkspaceMembership(db, userId, workspaceId);
  if (!hasWorkspacePermissionForMembership(membership, permission)) {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }

  return membership;
}

export async function getEffectivePermission(
  db: PrismaClient,
  userId: string,
  pageId: string,
  depth: number = 0
): Promise<EffectivePermission> {
  if (depth > 20) return "none";

  const directPerm = await db.pagePermission.findUnique({
    where: { pageId_userId: { pageId, userId } },
  });
  if (directPerm) return directPerm.level as EffectivePermission;

  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { workspaceId: true, parentId: true },
  });
  if (!page) return "none";

  const membership = await getWorkspaceMembership(db, userId, page.workspaceId);
  const canEditWorkspacePages = hasWorkspacePermissionForMembership(membership, "page.edit");
  const canViewWorkspacePages = membership?.role !== "GUEST";

  if (membership) {
    if (canEditWorkspacePages) {
      if (page.parentId) {
        const parentPerm = await getEffectivePermission(db, userId, page.parentId, depth + 1);
        if (parentPerm !== "edit") return parentPerm;
      }
      return "edit";
    }

    if (page.parentId) {
      const parentPerm = await getEffectivePermission(db, userId, page.parentId, depth + 1);
      if (parentPerm === "comment" || parentPerm === "view") {
        return parentPerm;
      }
      if (parentPerm === "edit") {
        return canViewWorkspacePages ? "view" : "none";
      }
    }

    if (canViewWorkspacePages) {
      return "view";
    }
  }

  if (page.parentId) {
    return getEffectivePermission(db, userId, page.parentId, depth + 1);
  }

  return "none";
}
