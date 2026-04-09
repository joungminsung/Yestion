import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";
import { parseTwoFactorData } from "@/lib/two-factor-storage";

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { id: true, email: true, name: true, avatarUrl: true, locale: true, theme: true, emailVerified: true, emailNotify: true },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });

    // Check if 2FA is enabled
    const twoFactorKey = await ctx.db.apiKey.findFirst({
      where: { name: `__2fa_${ctx.session.user.id}` },
    });
    let totpEnabled = false;
    if (twoFactorKey) {
      try {
        const data = parseTwoFactorData(twoFactorKey.key);
        totpEnabled = data.totpEnabled === true;
      } catch {
        // ignore
      }
    }

    return { ...user, totpEnabled };
  }),

  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100).optional(),
      avatarUrl: z.string().url().nullable().optional(),
      locale: z.enum(["ko", "en"]).optional(),
      theme: z.enum(["light", "dark", "system"]).optional(),
      emailNotify: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: input,
        select: { id: true, email: true, name: true, avatarUrl: true, locale: true, theme: true, emailVerified: true, emailNotify: true },
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
