// src/server/routers/template.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";

const TEMPLATE_CATEGORIES = [
  "documents",
  "personal",
  "team",
  "project",
  "engineering",
  "education",
  "marketing",
  "custom",
] as const;

export const templateRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        category: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        OR: [
          { isDefault: true },
          { workspaceId: input.workspaceId },
          { isPublic: true },
        ],
      };
      if (input.category && input.category !== "all") {
        where.category = input.category;
      }
      if (input.search?.trim()) {
        const q = input.search.trim();
        where.AND = [
          where.OR ? { OR: where.OR } : {},
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { nameKo: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { descriptionKo: { contains: q, mode: "insensitive" } },
              { tags: { has: q.toLowerCase() } },
            ],
          },
        ];
        delete where.OR;
      }
      const templates = await ctx.db.template.findMany({
        where,
        orderBy: [{ isDefault: "desc" }, { usageCount: "desc" }, { name: "asc" }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (templates.length > input.limit) {
        const next = templates.pop();
        nextCursor = next?.id;
      }

      return { templates, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.template.findUnique({
        where: { id: input.id },
      });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      return template;
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().min(1).max(100),
        nameKo: z.string().optional(),
        description: z.string().max(500).optional(),
        descriptionKo: z.string().max(500).optional(),
        icon: z.string().optional(),
        coverImage: z.string().url().optional(),
        category: z.enum(TEMPLATE_CATEGORIES).default("custom"),
        blocks: z.array(z.record(z.string(), z.unknown())).default([]),
        tags: z.array(z.string()).default([]),
        isPublic: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.template.create({
        data: {
          ...input,
          blocks: input.blocks as unknown as object,
          creatorId: ctx.session.user.id,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        nameKo: z.string().optional(),
        description: z.string().max(500).optional(),
        descriptionKo: z.string().max(500).optional(),
        icon: z.string().optional(),
        coverImage: z.string().url().nullable().optional(),
        category: z.enum(TEMPLATE_CATEGORIES).optional(),
        blocks: z.array(z.record(z.string(), z.unknown())).optional(),
        tags: z.array(z.string()).optional(),
        isPublic: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.template.findUnique({
        where: { id: input.id },
      });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      if (template.isDefault) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot edit system templates",
        });
      }
      if (template.creatorId && template.creatorId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized",
        });
      }
      const { id, ...data } = input;
      const updateData = {
        ...data,
        ...(data.blocks ? { blocks: data.blocks as unknown as object } : {}),
      };
      return ctx.db.template.update({ where: { id }, data: updateData });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.template.findUnique({
        where: { id: input.id },
      });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      if (template.isDefault) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete system templates",
        });
      }
      if (template.creatorId && template.creatorId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized",
        });
      }
      return ctx.db.template.delete({ where: { id: input.id } });
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string(), workspaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.db.template.findUnique({
        where: { id: input.id },
      });
      if (!source) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.template.create({
        data: {
          workspaceId: input.workspaceId,
          creatorId: ctx.session.user.id,
          name: `${source.name} (복사)`,
          nameKo: source.nameKo ? `${source.nameKo} (복사)` : null,
          description: source.description,
          descriptionKo: source.descriptionKo,
          icon: source.icon,
          coverImage: source.coverImage,
          category: "custom",
          blocks: source.blocks as object[],
          tags: source.tags,
          isPublic: false,
          isDefault: false,
        },
      });
    }),

  incrementUsage: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.template.update({
        where: { id: input.id },
        data: { usageCount: { increment: 1 } },
      });
    }),

  seed: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.db.template.count({
      where: { isDefault: true },
    });
    if (existing > 0) return { seeded: false, count: existing };

    // Import seed data
    const { SEED_TEMPLATES } = await import("@/../prisma/seed-templates");
    const created = await ctx.db.template.createMany({
      data: SEED_TEMPLATES.map((t: Record<string, unknown>) => ({
        ...t,
        blocks: t.blocks as object,
        isDefault: true,
        isPublic: true,
      })),
      skipDuplicates: true,
    });
    return { seeded: true, count: created.count };
  }),
});
