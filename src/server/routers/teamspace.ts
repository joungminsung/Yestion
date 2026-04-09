import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";
import type { Context } from "@/server/trpc/init";

async function verifyWorkspaceAccess(
  db: Context["db"],
  userId: string,
  workspaceId: string,
) {
  const member = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No access to this workspace" });
  }
  return member;
}

async function verifyTeamspaceAccess(
  db: Context["db"],
  userId: string,
  teamspaceId: string,
) {
  const teamspace = await db.teamspace.findUnique({
    where: { id: teamspaceId },
    include: { members: true },
  });
  if (!teamspace) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Teamspace not found" });
  }
  const isMember = teamspace.members.some((m) => m.userId === userId);
  if (!isMember) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this teamspace" });
  }
  return teamspace;
}

export const teamspaceRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        icon: z.string().max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, input.workspaceId);

      const teamspace = await ctx.db.teamspace.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          description: input.description,
          icon: input.icon,
          createdBy: ctx.session.user.id,
          members: {
            create: {
              userId: ctx.session.user.id,
              role: "owner",
            },
          },
        },
        include: { members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } } },
      });

      return teamspace;
    }),

  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyWorkspaceAccess(ctx.db, ctx.session.user.id, input.workspaceId);

      return ctx.db.teamspace.findMany({
        where: {
          workspaceId: input.workspaceId,
          members: { some: { userId: ctx.session.user.id } },
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
          _count: { select: { pages: { where: { isDeleted: false } } } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyTeamspaceAccess(ctx.db, ctx.session.user.id, input.id);
      return ctx.db.teamspace.findUnique({
        where: { id: input.id },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).nullish(),
        icon: z.string().max(50).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const teamspace = await verifyTeamspaceAccess(ctx.db, ctx.session.user.id, input.id);
      const member = teamspace.members.find((m) => m.userId === ctx.session.user.id);
      if (member?.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only teamspace owner can update" });
      }

      const { id, ...data } = input;
      return ctx.db.teamspace.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const teamspace = await verifyTeamspaceAccess(ctx.db, ctx.session.user.id, input.id);
      const member = teamspace.members.find((m) => m.userId === ctx.session.user.id);
      if (member?.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only teamspace owner can delete" });
      }

      // Pages are automatically set to teamspaceId=null via onDelete: SetNull in schema
      return ctx.db.teamspace.delete({ where: { id: input.id } });
    }),

  addMember: protectedProcedure
    .input(
      z.object({
        teamspaceId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const teamspace = await verifyTeamspaceAccess(ctx.db, ctx.session.user.id, input.teamspaceId);
      const member = teamspace.members.find((m) => m.userId === ctx.session.user.id);
      if (member?.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only teamspace owner can add members" });
      }

      // Verify the target user is in the workspace
      const ts = await ctx.db.teamspace.findUnique({ where: { id: input.teamspaceId }, select: { workspaceId: true } });
      if (!ts) throw new TRPCError({ code: "NOT_FOUND" });
      await verifyWorkspaceAccess(ctx.db, input.userId, ts.workspaceId);

      return ctx.db.teamspaceMember.create({
        data: {
          teamspaceId: input.teamspaceId,
          userId: input.userId,
          role: "member",
        },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        teamspaceId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const teamspace = await verifyTeamspaceAccess(ctx.db, ctx.session.user.id, input.teamspaceId);
      const member = teamspace.members.find((m) => m.userId === ctx.session.user.id);

      // Only owner can remove others; anyone can remove themselves
      if (input.userId !== ctx.session.user.id && member?.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only teamspace owner can remove members" });
      }

      // Can't remove the owner
      const target = teamspace.members.find((m) => m.userId === input.userId);
      if (target?.role === "owner") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove the teamspace owner" });
      }

      return ctx.db.teamspaceMember.delete({
        where: {
          teamspaceId_userId: {
            teamspaceId: input.teamspaceId,
            userId: input.userId,
          },
        },
      });
    }),
});
