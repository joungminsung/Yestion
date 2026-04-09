import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes, createHash } from "crypto";
import { router, protectedProcedure } from "@/server/trpc/init";
import {
  requireWorkspaceMembership,
  requireWorkspacePermission,
} from "@/lib/permissions";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export const apiKeyRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireWorkspacePermission(
        ctx.db,
        ctx.session.user.id,
        input.workspaceId,
        "apikey.manage",
        "API key management permission is required",
      );

      const rawKey = `nclone_${randomBytes(32).toString("hex")}`;
      const hashedKey = hashKey(rawKey);

      const apiKey = await ctx.db.apiKey.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          key: hashedKey,
          createdBy: ctx.session.user.id,
        },
      });

      // Return the raw key only on creation (one-time); the stored value is hashed
      return { ...apiKey, key: rawKey };
    }),

  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireWorkspaceMembership(ctx.db, ctx.session.user.id, input.workspaceId);

      const keys = await ctx.db.apiKey.findMany({
        where: {
          workspaceId: input.workspaceId,
          NOT: { name: { startsWith: "__2fa_" } }, // Exclude internal 2FA entries
        },
        orderBy: { createdAt: "desc" },
      });

      // Keys are stored as hashes; mask them in the listing
      return keys.map((k) => ({
        ...k,
        key: k.key.slice(0, 8) + "...",
      }));
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string(), workspaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireWorkspacePermission(
        ctx.db,
        ctx.session.user.id,
        input.workspaceId,
        "apikey.manage",
        "API key management permission is required",
      );

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
