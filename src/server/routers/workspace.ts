import { router, protectedProcedure } from "@/server/trpc/init";

export const workspaceRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.workspaceMember.findMany({
      where: { userId: ctx.session.user.id },
      include: { workspace: true },
    });
  }),
});
