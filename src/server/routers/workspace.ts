import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";

export const workspaceRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.workspaceMember.findMany({
      where: { userId: ctx.session.user.id },
      include: { workspace: true },
      orderBy: { joinedAt: "asc" },
    });
  }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        icon: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.id,
          },
        },
      });

      if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.workspace.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.icon !== undefined && { icon: input.icon }),
        },
      });
    }),

  members: protectedProcedure
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

      return ctx.db.workspaceMember.findMany({
        where: { workspaceId: input.workspaceId },
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      });
    }),

  inviteMember: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        email: z.string().email(),
        role: z.enum(["ADMIN", "MEMBER", "GUEST"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const callerMembership = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
        },
      });

      if (!callerMembership || !["OWNER", "ADMIN"].includes(callerMembership.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const targetUser = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return ctx.db.workspaceMember.create({
        data: {
          userId: targetUser.id,
          workspaceId: input.workspaceId,
          role: input.role,
        },
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      });
    }),
});
