import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";

const PERMISSIONS = [
  "page.create", "page.edit", "page.delete", "page.share",
  "member.invite", "member.remove", "member.changeRole",
  "workspace.settings", "workspace.billing",
  "database.create", "database.edit", "database.delete",
  "automation.manage", "webhook.manage", "apikey.manage",
] as const;

async function verifyWorkspaceMember(db: any, workspaceId: string, userId: string) {
  const member = await db.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "Not a workspace member" });
  return member;
}

async function verifyWorkspaceAdmin(db: any, workspaceId: string, userId: string) {
  const member = await verifyWorkspaceMember(db, workspaceId, userId);
  if (!["OWNER", "ADMIN"].includes(member.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Requires OWNER or ADMIN role" });
  }
  return member;
}

export const roleRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyWorkspaceMember(ctx.db, input.workspaceId, ctx.session.user.id);
      return ctx.db.customRole.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: "asc" },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().min(1).max(50),
        permissions: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyWorkspaceAdmin(ctx.db, input.workspaceId, ctx.session.user.id);
      return ctx.db.customRole.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          permissions: input.permissions,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(50).optional(),
        permissions: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.db.customRole.findUniqueOrThrow({ where: { id: input.id } });
      await verifyWorkspaceAdmin(ctx.db, role.workspaceId, ctx.session.user.id);
      if (role.isBuiltIn) throw new TRPCError({ code: "FORBIDDEN", message: "Built-in roles cannot be modified" });
      return ctx.db.customRole.update({
        where: { id: input.id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.permissions ? { permissions: input.permissions } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.db.customRole.findUniqueOrThrow({ where: { id: input.id } });
      await verifyWorkspaceAdmin(ctx.db, role.workspaceId, ctx.session.user.id);
      if (role.isBuiltIn) throw new TRPCError({ code: "FORBIDDEN", message: "Built-in roles cannot be deleted" });
      return ctx.db.customRole.delete({ where: { id: input.id } });
    }),

  permissions: protectedProcedure.query(() => {
    return PERMISSIONS.map((p) => ({
      key: p,
      category: p.split(".")[0],
      action: p.split(".")[1],
    }));
  }),
});
