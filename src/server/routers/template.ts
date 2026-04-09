// src/server/routers/template.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";

const TEMPLATE_CATEGORIES = [
  "documents",
  "personal",
  "team",
  "engineering",
  "design",
  "marketing",
  "hr",
  "custom",
] as const;

const TEMPLATE_SORTS = ["popular", "latest", "alphabetical"] as const;

function normalizeTemplateCategory(category: string | null | undefined) {
  if (category === "education") {
    return "design";
  }
  if (category === "project") {
    return "team";
  }
  return category ?? "custom";
}

export const templateRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        category: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
        sort: z.enum(TEMPLATE_SORTS).default("popular"),
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
        where.category =
          input.category === "design"
            ? { in: ["design", "education"] }
            : input.category;
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
      const orderBy =
        input.sort === "latest"
          ? [{ updatedAt: "desc" as const }, { usageCount: "desc" as const }]
          : input.sort === "alphabetical"
            ? [{ name: "asc" as const }, { usageCount: "desc" as const }]
            : [{ isDefault: "desc" as const }, { usageCount: "desc" as const }, { name: "asc" as const }];
      const templates = await ctx.db.template.findMany({
        where,
        orderBy,
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (templates.length > input.limit) {
        const next = templates.pop();
        nextCursor = next?.id;
      }

      return {
        templates: templates.map((template) => ({
          ...template,
          category: normalizeTemplateCategory(template.category),
        })),
        nextCursor,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.template.findUnique({
        where: { id: input.id },
      });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });

      // For workspace-specific (non-public) templates, verify workspace access
      if (template.workspaceId && !template.isPublic) {
        const member = await ctx.db.workspaceMember.findUnique({
          where: { userId_workspaceId: { userId: ctx.session.user.id, workspaceId: template.workspaceId } },
        });
        if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "No access to this template" });
      }

      return {
        ...template,
        category: normalizeTemplateCategory(template.category),
      };
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
      // Verify workspace membership
      const member = await ctx.db.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: ctx.session.user.id, workspaceId: input.workspaceId } },
      });
      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No access to this workspace" });
      }

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
      if (template.creatorId !== ctx.session.user.id) {
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
      if (template.creatorId !== ctx.session.user.id) {
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

      const member = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
        },
      });
      if (!member) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No access to the target workspace",
        });
      }

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
    // Only workspace owners can seed templates
    const membership = await ctx.db.workspaceMember.findFirst({
      where: { userId: ctx.session.user.id, role: { in: ["OWNER", "ADMIN"] } },
    });
    if (!membership) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only owners and admins can seed templates" });
    }

    const existingDefaults = await ctx.db.template.findMany({
      where: { isDefault: true },
      select: { id: true, name: true },
    });
    const existingByName = new Map(existingDefaults.map((template) => [template.name, template]));

    const { SEED_TEMPLATES } = await import("@/../prisma/seed-templates");
    let created = 0;
    let updated = 0;

    for (const template of SEED_TEMPLATES) {
      const existing = existingByName.get(template.name);
      const data = {
        nameKo: template.nameKo,
        description: template.description,
        descriptionKo: template.descriptionKo,
        icon: template.icon,
        category: normalizeTemplateCategory(template.category),
        tags: template.tags,
        blocks: template.blocks as unknown as object,
        isDefault: true,
        isPublic: true,
      };

      if (existing) {
        await ctx.db.template.update({
          where: { id: existing.id },
          data,
        });
        updated += 1;
      } else {
        await ctx.db.template.create({
          data: {
            name: template.name,
            ...data,
          },
        });
        created += 1;
      }
    }

    return { seeded: true, count: created + updated, created, updated };
  }),
});
