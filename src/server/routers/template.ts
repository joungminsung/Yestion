import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";

// System default templates — seeded on first query if not present
const SYSTEM_TEMPLATES = [
  {
    name: "Meeting Notes",
    description: "Agenda, discussion points, and action items",
    icon: "📝",
    category: "documents",
    tags: ["meeting", "notes", "agenda"],
    blocks: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Agenda" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Discussion Points" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Action Items" }] },
      { type: "taskList", content: [
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
      ]},
    ],
  },
  {
    name: "Todo List",
    description: "Simple task tracker with sections",
    icon: "☑️",
    category: "personal",
    tags: ["todo", "tasks", "checklist"],
    blocks: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Today" }] },
      { type: "taskList", content: [
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
      ]},
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "This Week" }] },
      { type: "taskList", content: [
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
      ]},
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Later" }] },
      { type: "taskList", content: [
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
      ]},
    ],
  },
  {
    name: "Weekly Plan",
    description: "Weekly goals and daily breakdown",
    icon: "📅",
    category: "personal",
    tags: ["weekly", "plan", "schedule"],
    blocks: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Goals" }] },
      { type: "taskList", content: [
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
      ]},
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Monday" }] },
      { type: "paragraph" },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Tuesday" }] },
      { type: "paragraph" },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Wednesday" }] },
      { type: "paragraph" },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Thursday" }] },
      { type: "paragraph" },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Friday" }] },
      { type: "paragraph" },
    ],
  },
  {
    name: "Project Brief",
    description: "Project overview with goals, scope, and timeline",
    icon: "🎯",
    category: "project",
    tags: ["project", "brief", "plan"],
    blocks: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Overview" }] },
      { type: "paragraph" },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Goals" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Scope" }] },
      { type: "paragraph" },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Timeline" }] },
      { type: "paragraph" },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Team" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
    ],
  },
  {
    name: "Daily Journal",
    description: "Morning check-in and evening reflection",
    icon: "📓",
    category: "personal",
    tags: ["journal", "daily", "reflection"],
    blocks: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Gratitude" }] },
      { type: "bulletList", content: [
        { type: "listItem", content: [{ type: "paragraph" }] },
        { type: "listItem", content: [{ type: "paragraph" }] },
        { type: "listItem", content: [{ type: "paragraph" }] },
      ]},
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Today's Focus" }] },
      { type: "taskList", content: [
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
      ]},
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Reflection" }] },
      { type: "paragraph" },
    ],
  },
  {
    name: "Design Document",
    description: "Technical design with context, goals, and proposed solution",
    icon: "📐",
    category: "documents",
    tags: ["design", "technical", "rfc"],
    blocks: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Context" }] },
      { type: "paragraph" },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Goals" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Proposed Solution" }] },
      { type: "paragraph" },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Alternatives Considered" }] },
      { type: "paragraph" },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Open Questions" }] },
      { type: "taskList", content: [
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
      ]},
    ],
  },
  {
    name: "1:1 Meeting",
    description: "Recurring meeting notes with action items",
    icon: "🤝",
    category: "team",
    tags: ["meeting", "1on1", "one-on-one"],
    blocks: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Updates" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Discussion" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Action Items" }] },
      { type: "taskList", content: [
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
      ]},
    ],
  },
  {
    name: "Sprint Retrospective",
    description: "What went well, what to improve, action items",
    icon: "🔄",
    category: "team",
    tags: ["sprint", "retro", "retrospective", "agile"],
    blocks: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "What went well" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "What could improve" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Action Items" }] },
      { type: "taskList", content: [
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
      ]},
    ],
  },
  {
    name: "Reading Notes",
    description: "Book notes with key ideas, quotes, and action items",
    icon: "📚",
    category: "personal",
    tags: ["reading", "book", "notes"],
    blocks: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Summary" }] },
      { type: "paragraph" },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Key Ideas" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Favorite Quotes" }] },
      { type: "blockquote", content: [{ type: "paragraph" }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Action Items" }] },
      { type: "taskList", content: [
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] },
      ]},
    ],
  },
  {
    name: "Bug Report",
    description: "Bug tracking with steps to reproduce",
    icon: "🐛",
    category: "engineering",
    tags: ["bug", "report", "issue"],
    blocks: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Description" }] },
      { type: "paragraph" },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Steps to Reproduce" }] },
      { type: "orderedList", content: [
        { type: "listItem", content: [{ type: "paragraph" }] },
        { type: "listItem", content: [{ type: "paragraph" }] },
      ]},
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Expected Behavior" }] },
      { type: "paragraph" },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Actual Behavior" }] },
      { type: "paragraph" },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Environment" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
    ],
  },
];

export const templateRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string(), category: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        OR: [
          { isDefault: true },
          { workspaceId: input.workspaceId },
        ],
      };
      if (input.category) {
        where.category = input.category;
      }
      return ctx.db.template.findMany({
        where,
        orderBy: [{ isDefault: "desc" }, { usageCount: "desc" }, { name: "asc" }],
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.template.findUnique({ where: { id: input.id } });
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      name: z.string(),
      description: z.string().optional(),
      icon: z.string().optional(),
      category: z.string().default("custom"),
      blocks: z.array(z.record(z.string(), z.unknown())).default([]),
      tags: z.array(z.string()).default([]),
      isPublic: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.template.create({
        data: {
          ...input,
          creatorId: ctx.session.user.id,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.template.findUnique({ where: { id: input.id } });
      if (!template || template.isDefault) {
        throw new Error("Cannot delete system template");
      }
      if (template.creatorId && template.creatorId !== ctx.session.user.id) {
        throw new Error("Not authorized to delete this template");
      }
      return ctx.db.template.delete({ where: { id: input.id } });
    }),

  incrementUsage: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.template.update({
        where: { id: input.id },
        data: { usageCount: { increment: 1 } },
      });
    }),

  seed: protectedProcedure
    .mutation(async ({ ctx }) => {
      const existing = await ctx.db.template.count({ where: { isDefault: true } });
      if (existing > 0) return { seeded: false, count: existing };

      const created = await ctx.db.template.createMany({
        data: SYSTEM_TEMPLATES.map((t) => ({
          ...t,
          blocks: t.blocks,
          isDefault: true,
          isPublic: true,
        })),
      });
      return { seeded: true, count: created.count };
    }),
});
