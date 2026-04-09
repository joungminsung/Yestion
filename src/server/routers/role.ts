import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import {
  WORKSPACE_PERMISSION_KEYS,
  requireWorkspaceMembership,
  requireWorkspacePermission,
} from "@/lib/permissions";

const permissionEnum = z.enum(WORKSPACE_PERMISSION_KEYS);

export const roleRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireWorkspaceMembership(ctx.db, ctx.session.user.id, input.workspaceId);
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
        description: z.string().max(200).optional(),
        permissions: z.array(permissionEnum),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireWorkspacePermission(
        ctx.db,
        ctx.session.user.id,
        input.workspaceId,
        "workspace.settings",
        "Workspace settings permission is required",
      );
      return ctx.db.customRole.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          description: input.description,
          permissions: input.permissions,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(50).optional(),
        description: z.string().max(200).nullable().optional(),
        permissions: z.array(permissionEnum).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.db.customRole.findUniqueOrThrow({ where: { id: input.id } });
      await requireWorkspacePermission(
        ctx.db,
        ctx.session.user.id,
        role.workspaceId,
        "workspace.settings",
        "Workspace settings permission is required",
      );
      if (role.isBuiltIn) throw new TRPCError({ code: "FORBIDDEN", message: "Built-in roles cannot be modified" });
      return ctx.db.customRole.update({
        where: { id: input.id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.permissions ? { permissions: input.permissions } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.db.customRole.findUniqueOrThrow({ where: { id: input.id } });
      await requireWorkspacePermission(
        ctx.db,
        ctx.session.user.id,
        role.workspaceId,
        "workspace.settings",
        "Workspace settings permission is required",
      );
      if (role.isBuiltIn) throw new TRPCError({ code: "FORBIDDEN", message: "Built-in roles cannot be deleted" });
      return ctx.db.customRole.delete({ where: { id: input.id } });
    }),

  permissions: protectedProcedure.query(() => {
    return WORKSPACE_PERMISSION_KEYS.map((p) => ({
      key: p,
      category: p.split(".")[0],
      action: p.split(".")[1],
    }));
  }),
});
