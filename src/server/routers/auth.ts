import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "@/server/trpc/init";

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

      const user = await ctx.db.user.create({
        data: {
          email: input.email,
          name: input.name,
          password: hashedPassword,
        },
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

      return {
        user: { id: user.id, email: user.email, name: user.name },
        token,
      };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
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

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await ctx.db.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      return {
        user: { id: user.id, email: user.email, name: user.name },
        token,
      };
    }),

  logout: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.session.deleteMany({
        where: { token: input.token },
      });
      return { success: true };
    }),
});
