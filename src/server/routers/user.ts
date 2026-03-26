import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { id: true, email: true, name: true, avatarUrl: true, locale: true, theme: true },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    return user;
  }),

  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100).optional(),
      avatarUrl: z.string().url().nullable().optional(),
      locale: z.enum(["ko", "en"]).optional(),
      theme: z.enum(["light", "dark", "system"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: input,
        select: { id: true, email: true, name: true, avatarUrl: true, locale: true, theme: true },
      });
    }),

  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({ where: { id: ctx.session.user.id } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const valid = await bcrypt.compare(input.currentPassword, user.password);
      if (!valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is incorrect" });
      const hashed = await bcrypt.hash(input.newPassword, 12);
      await ctx.db.user.update({ where: { id: ctx.session.user.id }, data: { password: hashed } });
      return { success: true };
    }),
});
