import { z } from "zod";
import { cookies } from "next/headers";
import { router, protectedProcedure } from "@/server/trpc/init";

export const sessionRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const cookieStore = await cookies();
    const currentToken = cookieStore.get("session-token")?.value;

    const sessions = await ctx.db.session.findMany({
      where: {
        userId: ctx.session.user.id,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        token: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return sessions.map((s: { id: string; token: string; createdAt: Date; expiresAt: Date }) => ({
      id: s.id,
      isCurrent: s.token === currentToken,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      // Token is partially masked for display
      tokenPreview: `${s.token.slice(0, 6)}...${s.token.slice(-4)}`,
    }));
  }),

  revoke: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the session belongs to the current user
      const session = await ctx.db.session.findFirst({
        where: {
          id: input.sessionId,
          userId: ctx.session.user.id,
        },
      });

      if (!session) {
        return { success: false };
      }

      await ctx.db.session.delete({ where: { id: input.sessionId } });
      return { success: true };
    }),

  revokeAll: protectedProcedure.mutation(async ({ ctx }) => {
    const cookieStore = await cookies();
    const currentToken = cookieStore.get("session-token")?.value;

    // Delete all sessions except the current one
    await ctx.db.session.deleteMany({
      where: {
        userId: ctx.session.user.id,
        ...(currentToken ? { token: { not: currentToken } } : {}),
      },
    });

    return { success: true };
  }),
});
