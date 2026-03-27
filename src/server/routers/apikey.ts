import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { router, protectedProcedure } from "@/server/trpc/init";

export const apiKeyRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify OWNER or ADMIN
      const membership = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
        },
      });
      if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const key = `nclone_${randomBytes(32).toString("hex")}`;

      const apiKey = await ctx.db.apiKey.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          key,
          createdBy: ctx.session.user.id,
        },
      });

      // Return the full key only on creation
      return { ...apiKey, key };
    }),

  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const membership = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
        },
      });
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const keys = await ctx.db.apiKey.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: "desc" },
      });

      // Mask keys: show only first 10 chars + ...
      return keys.map((k) => ({
        ...k,
        key: k.key.slice(0, 14) + "..." + k.key.slice(-4),
      }));
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string(), workspaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
        },
      });
      if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const apiKey = await ctx.db.apiKey.findUnique({
        where: { id: input.id },
      });
      if (!apiKey || apiKey.workspaceId !== input.workspaceId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.db.apiKey.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
