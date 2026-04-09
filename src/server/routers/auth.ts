import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "@/server/trpc/init";
import { generateTotpSecret, generateQrCodeDataUrl, verifyTotp, generateBackupCodes } from "@/lib/totp";
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/email";
import {
  parseTwoFactorData,
  serializeTwoFactorData,
  hasMatchingBackupCode,
  consumeBackupCode,
  type ParsedTwoFactorData,
} from "@/lib/two-factor-storage";

const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

export const authRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1).max(100),
        password: z.string().min(8).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, 12);

      const verifyToken = crypto.randomBytes(32).toString("hex");
      const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const user = await ctx.db.user.create({
        data: {
          email: input.email,
          name: input.name,
          password: hashedPassword,
          verifyToken,
          verifyTokenExp,
        },
      });

      // Send verification + welcome emails (non-blocking)
      sendVerificationEmail(input.email, verifyToken).catch((err) => {
        console.error("[Auth] Failed to send verification email:", err);
      });
      sendWelcomeEmail(input.email, input.name).catch((err) => {
        console.error("[Auth] Failed to send welcome email:", err);
      });

      const workspace = await ctx.db.workspace.create({
        data: {
          name: `${input.name}'s Workspace`,
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });

      await ctx.db.page.create({
        data: {
          workspaceId: workspace.id,
          title: "Getting Started",
          icon: "👋",
          createdBy: user.id,
          lastEditedBy: user.id,
        },
      });

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await ctx.db.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      ctx.headers.set('Set-Cookie', `session-token=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${30 * 24 * 60 * 60}`);

      return {
        user: { id: user.id, email: user.email, name: user.name },
      };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
        totpCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const valid = await bcrypt.compare(input.password, user.password);

      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Check if user has 2FA enabled
      const twoFactorKey = await ctx.db.apiKey.findFirst({
        where: { name: `__2fa_${user.id}` },
      });
      if (twoFactorKey) {
        let totpData: ParsedTwoFactorData;
        try {
          totpData = parseTwoFactorData(twoFactorKey.key);
        } catch (error) {
          console.error("[Auth] Failed to read 2FA configuration:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "2FA configuration is unavailable",
          });
        }
        if (totpData.totpEnabled && totpData.totpSecret) {
          if (!input.totpCode) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "2FA code required",
            });
          }
          const isValidTotp = verifyTotp(input.totpCode, totpData.totpSecret);
          const isValidBackup = hasMatchingBackupCode(totpData, input.totpCode);
          if (!isValidTotp && !isValidBackup) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Invalid 2FA code",
            });
          }
          // Remove used backup code
          if (isValidBackup) {
            await ctx.db.apiKey.update({
              where: { id: twoFactorKey.id },
              data: { key: consumeBackupCode(totpData, input.totpCode) },
            });
          } else if (totpData.needsMigration) {
            await ctx.db.apiKey.update({
              where: { id: twoFactorKey.id },
              data: {
                key: serializeTwoFactorData(
                  totpData.totpSecret,
                  totpData.backupCodes ?? []
                ),
              },
            });
          }
        }
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await ctx.db.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      ctx.headers.set('Set-Cookie', `session-token=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${30 * 24 * 60 * 60}`);

      return {
        user: { id: user.id, email: user.email, name: user.name },
      };
    }),

  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Delete only the current user's session using the token from the cookie
      await ctx.db.session.deleteMany({
        where: { userId: ctx.session.user.id, token: ctx.session.token },
      });
      ctx.headers.set('Set-Cookie', `session-token=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`);
      return { success: true };
    }),

  setup2FA: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });

    const { secret, uri } = generateTotpSecret(user.email);
    const qrCodeUrl = await generateQrCodeDataUrl(uri);

    return { secret, qrCodeUrl };
  }),

  verify2FA: protectedProcedure
    .input(z.object({ token: z.string(), secret: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const valid = verifyTotp(input.token, input.secret);
      if (!valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "인증 코드가 올바르지 않습니다" });
      }

      const backupCodes = generateBackupCodes();

      // Store 2FA data using API key record as metadata store
      const existingKey = await ctx.db.apiKey.findFirst({
        where: { name: `__2fa_${ctx.session.user.id}` },
      });

      const totpData = serializeTwoFactorData(input.secret, backupCodes);

      if (existingKey) {
        await ctx.db.apiKey.update({
          where: { id: existingKey.id },
          data: { key: totpData },
        });
      } else {
        const membership = await ctx.db.workspaceMember.findFirst({
          where: { userId: ctx.session.user.id },
        });
        if (!membership) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No workspace found" });
        }
        await ctx.db.apiKey.create({
          data: {
            workspaceId: membership.workspaceId,
            name: `__2fa_${ctx.session.user.id}`,
            key: totpData,
            createdBy: ctx.session.user.id,
          },
        });
      }

      return { backupCodes };
    }),

  disable2FA: protectedProcedure
    .input(z.object({ password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const valid = await bcrypt.compare(input.password, user.password);
      if (!valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "비밀번호가 올바르지 않습니다" });
      }

      // Remove 2FA data
      await ctx.db.apiKey.deleteMany({
        where: { name: `__2fa_${ctx.session.user.id}` },
      });

      return { success: true };
    }),

  // ── Password Reset ─────────────────────────────────────────

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({ where: { email: input.email } });
      // Always return success to prevent email enumeration
      if (!user) return { success: true };

      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await ctx.db.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExp },
      });

      await sendPasswordResetEmail(input.email, resetToken).catch((err) => {
        console.error("[Auth] Failed to send password reset email:", err);
      });
      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      newPassword: z.string().min(8).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findFirst({
        where: {
          resetToken: input.token,
          resetTokenExp: { gte: new Date() },
        },
      });

      if (!user) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "유효하지 않거나 만료된 링크입니다" });
      }

      const hashedPassword = await bcrypt.hash(input.newPassword, 12);

      await ctx.db.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExp: null,
        },
      });

      // Invalidate all sessions for security
      await ctx.db.session.deleteMany({ where: { userId: user.id } });

      return { success: true };
    }),

  // ── Resend Verification ────────────────────────────────────

  resendVerification: protectedProcedure
    .mutation(async ({ ctx }) => {
      const user = await ctx.db.user.findUnique({ where: { id: ctx.session.user.id } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      if (user.emailVerified) return { success: true, message: "이미 인증됨" };

      const verifyToken = crypto.randomBytes(32).toString("hex");
      const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await ctx.db.user.update({
        where: { id: user.id },
        data: { verifyToken, verifyTokenExp },
      });

      await sendVerificationEmail(user.email, verifyToken);
      return { success: true };
    }),

  // ── Email Verification ────────────────────────────────────

  verifyEmail: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findFirst({
        where: {
          verifyToken: input.token,
          verifyTokenExp: { gte: new Date() },
        },
      });

      if (!user) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "유효하지 않거나 만료된 인증 링크입니다" });
      }

      await ctx.db.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          verifyToken: null,
          verifyTokenExp: null,
        },
      });

      return { success: true };
    }),
});
