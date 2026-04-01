import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";

async function verifyWorkspaceMembership(db: any, workspaceId: string, userId: string) {
  const member = await db.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!member) throw new Error("Not authorized: not a workspace member");
}

export const projectRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyWorkspaceMembership(ctx.db, input.workspaceId, ctx.session.user.id);
      return ctx.db.project.findMany({
        where: { workspaceId: input.workspaceId },
        include: { members: true, _count: { select: { tasks: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.project.findUnique({
        where: { id: input.id },
        include: { members: true, _count: { select: { tasks: true } } },
      });
      if (!project) throw new Error("Not found");
      if (!project.members.some((m: any) => m.userId === ctx.session.user.id)) {
        throw new Error("Not authorized");
      }
      return project;
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
      icon: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.project.create({
        data: {
          ...input,
          ownerId: ctx.session.user.id,
          members: {
            create: { userId: ctx.session.user.id, role: "owner" },
          },
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      status: z.enum(["active", "paused", "completed", "archived"]).optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const project = await ctx.db.project.findUnique({ where: { id } });
      if (!project) throw new Error("Project not found");
      const member = await ctx.db.projectMember.findFirst({
        where: { projectId: id, userId: ctx.session.user.id },
      });
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        throw new Error("Not authorized");
      }
      return ctx.db.project.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.project.findUnique({ where: { id: input.id } });
      if (!project || project.ownerId !== ctx.session.user.id) {
        throw new Error("Not authorized");
      }
      return ctx.db.project.delete({ where: { id: input.id } });
    }),

  stats: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.project.findUnique({ where: { id: input.id }, select: { workspaceId: true } });
      if (!project) throw new Error("Not found");
      await verifyWorkspaceMembership(ctx.db, project.workspaceId, ctx.session.user.id);

      const [total, byStatus] = await Promise.all([
        ctx.db.task.count({ where: { projectId: input.id } }),
        ctx.db.task.groupBy({
          by: ["status"],
          where: { projectId: input.id },
          _count: true,
        }),
      ]);
      const statusMap: Record<string, number> = {};
      for (const s of byStatus) {
        statusMap[s.status] = s._count;
      }
      return { total, byStatus: statusMap };
    }),
});
