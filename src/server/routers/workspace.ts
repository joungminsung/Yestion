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

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.workspace.findUniqueOrThrow({ where: { id: input.id } });
    }),

  updateMemberRole: protectedProcedure
    .input(z.object({ workspaceId: z.string(), memberId: z.string(), role: z.enum(["ADMIN", "MEMBER", "GUEST"]) }))
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

      return ctx.db.workspaceMember.update({
        where: { id: input.memberId },
        data: { role: input.role },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ workspaceId: z.string(), memberId: z.string() }))
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

      return ctx.db.workspaceMember.delete({ where: { id: input.memberId } });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        icon: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ctx.db.workspace.create({
        data: {
          name: input.name,
          icon: input.icon ?? null,
        },
      });

      // Add creator as OWNER
      await ctx.db.workspaceMember.create({
        data: {
          userId: ctx.session.user.id,
          workspaceId: workspace.id,
          role: "OWNER",
        },
      });

      // Create a welcome page
      await ctx.db.page.create({
        data: {
          workspaceId: workspace.id,
          title: "시작하기",
          icon: "👋",
          createdBy: ctx.session.user.id,
          lastEditedBy: ctx.session.user.id,
          position: 0,
        },
      });

      return workspace;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.id,
          },
        },
      });

      if (!membership || membership.role !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "워크스페이스 삭제는 소유자만 가능합니다",
        });
      }

      // Check this isn't the user's last workspace
      const membershipCount = await ctx.db.workspaceMember.count({
        where: { userId: ctx.session.user.id },
      });
      if (membershipCount <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "마지막 워크스페이스는 삭제할 수 없습니다",
        });
      }

      // Delete workspace (cascade deletes members, pages, etc.)
      await ctx.db.workspace.delete({ where: { id: input.id } });
      return { success: true };
    }),

  leave: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
        },
      });

      if (!membership) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (membership.role === "OWNER") {
        // Check if there's another owner
        const otherOwners = await ctx.db.workspaceMember.count({
          where: {
            workspaceId: input.workspaceId,
            role: "OWNER",
            NOT: { userId: ctx.session.user.id },
          },
        });
        if (otherOwners === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "소유자가 나가려면 먼저 다른 멤버를 소유자로 지정하세요",
          });
        }
      }

      await ctx.db.workspaceMember.delete({
        where: { id: membership.id },
      });
      return { success: true };
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
