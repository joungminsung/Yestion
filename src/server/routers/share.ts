import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { router, protectedProcedure } from "@/server/trpc/init";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyPageOwnership(db: any, userId: string, pageId: string) {
  const page = await db.page.findUnique({ where: { id: pageId }, select: { workspaceId: true } });
  if (!page) throw new TRPCError({ code: "NOT_FOUND" });
  const membership = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: page.workspaceId } },
  });
  if (!membership || !["OWNER", "ADMIN", "MEMBER"].includes(membership.role)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

export const shareRouter = router({
  listPermissions: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.pagePermission.findMany({
        where: { pageId: input.pageId },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      });
    }),

  sharePage: protectedProcedure
    .input(z.object({ pageId: z.string(), email: z.string().email(), level: z.enum(["edit", "comment", "view"]) }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageOwnership(ctx.db, ctx.session.user.id, input.pageId);
      const targetUser = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      return ctx.db.pagePermission.upsert({
        where: { pageId_userId: { pageId: input.pageId, userId: targetUser.id } },
        create: { pageId: input.pageId, userId: targetUser.id, level: input.level },
        update: { level: input.level },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      });
    }),

  updatePermission: protectedProcedure
    .input(z.object({ id: z.string(), level: z.enum(["edit", "comment", "view"]) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.pagePermission.update({ where: { id: input.id }, data: { level: input.level } });
    }),

  removePermission: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.pagePermission.delete({ where: { id: input.id } });
      return { success: true };
    }),

  enablePublicLink: protectedProcedure
    .input(z.object({ pageId: z.string(), level: z.enum(["view", "comment", "edit"]).default("view") }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageOwnership(ctx.db, ctx.session.user.id, input.pageId);
      const token = crypto.randomBytes(16).toString("hex");
      return ctx.db.page.update({
        where: { id: input.pageId },
        data: { publicAccessToken: token, publicAccessLevel: input.level },
        select: { publicAccessToken: true, publicAccessLevel: true },
      });
    }),

  disablePublicLink: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageOwnership(ctx.db, ctx.session.user.id, input.pageId);
      return ctx.db.page.update({
        where: { id: input.pageId },
        data: { publicAccessToken: null, publicAccessLevel: null },
      });
    }),

  getPublicPage: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .query(async ({ ctx, input }) => {
      const page = await ctx.db.page.findUnique({
        where: { id: input.pageId },
        select: { publicAccessToken: true, publicAccessLevel: true },
      });
      return page;
    }),
});
