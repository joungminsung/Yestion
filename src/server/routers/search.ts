import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";

export const searchRouter = router({
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        workspaceId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify workspace access
      const member = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
        },
      });
      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No access to this workspace" });
      }

      const pages = await ctx.db.page.findMany({
        where: {
          workspaceId: input.workspaceId,
          isDeleted: false,
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          title: true,
          icon: true,
          parentId: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      });

      return pages;
    }),

  recent: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const member = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
        },
      });
      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No access to this workspace" });
      }

      return ctx.db.page.findMany({
        where: {
          workspaceId: input.workspaceId,
          isDeleted: false,
        },
        select: {
          id: true,
          title: true,
          icon: true,
          parentId: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });
    }),
});
