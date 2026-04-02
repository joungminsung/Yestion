import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";

const PERMISSIONS = [
  "page.create", "page.edit", "page.delete", "page.share",
  "member.invite", "member.remove", "member.changeRole",
  "workspace.settings", "workspace.billing",
  "database.create", "database.edit", "database.delete",
  "automation.manage", "webhook.manage", "apikey.manage",
] as const;

export const roleRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
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
      if (role.isBuiltIn) throw new Error("Built-in roles cannot be modified");
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
      if (role.isBuiltIn) throw new Error("Built-in roles cannot be deleted");
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
