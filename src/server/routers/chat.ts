import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { router, protectedProcedure } from "@/server/trpc/init";
import { chatEmitter } from "@/lib/chat-emitter";

async function verifyPageAccess(
  db: Parameters<Parameters<typeof protectedProcedure.query>[0]>["0"]["ctx"]["db"],
  userId: string,
  pageId: string,
) {
  const page = await db.page.findUnique({ where: { id: pageId }, select: { workspaceId: true } });
  if (!page) throw new TRPCError({ code: "NOT_FOUND" });
  const member = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: page.workspaceId } },
  });
  if (!member) throw new TRPCError({ code: "FORBIDDEN" });
}

function broadcastMsg(msg: {
  id: string; pageId: string; userId: string; content: string;
  type: string; metadata: Prisma.JsonValue; createdAt: Date;
  user: { id: string; name: string; avatarUrl: string | null };
}) {
  chatEmitter.emit({
    id: msg.id,
    pageId: msg.pageId,
    userId: msg.userId,
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
    user: msg.user,
    type: msg.type,
    metadata: (msg.metadata ?? {}) as Record<string, unknown>,
  });
}

export const chatRouter = router({
  list: protectedProcedure
    .input(z.object({
      pageId: z.string(),
      cursor: z.string().nullish(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);
      const messages = await ctx.db.chatMessage.findMany({
        where: { pageId: input.pageId },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });
      let nextCursor: string | undefined;
      if (messages.length > input.limit) {
        const next = messages.pop();
        nextCursor = next?.id;
      }
      return { messages: messages.reverse(), nextCursor };
    }),

  /** 일반 메시지 전송 (텍스트, @멘션 포함) */
  send: protectedProcedure
    .input(z.object({
      pageId: z.string(),
      content: z.string().min(1).max(2000),
      type: z.enum(["text", "block_ref", "system", "poll", "task"]).default("text"),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);
      const msg = await ctx.db.chatMessage.create({
        data: {
          pageId: input.pageId,
          userId: ctx.session.user.id,
          content: input.content,
          type: input.type,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });
      broadcastMsg(msg);
      return msg;
    }),

  /** 블록 참조 전송 — 문서의 특정 블록을 채팅에 첨부 */
  sendBlockRef: protectedProcedure
    .input(z.object({
      pageId: z.string(),
      blockId: z.string(),
      blockType: z.string().optional(),
      blockPreview: z.string().optional(),
      comment: z.string().default(""),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);

      let blockType = input.blockType ?? "unknown";
      let preview = input.blockPreview ?? "";

      // If client didn't provide metadata, try to look up from DB
      if (!input.blockType) {
        const block = await ctx.db.block.findUnique({
          where: { id: input.blockId },
          select: { type: true, content: true },
        });
        if (block) {
          blockType = block.type;
          const content = (block.content ?? {}) as Record<string, unknown>;
          const richText = content.richText as { text: string }[] | undefined;
          preview = richText?.map((r) => r.text).join("") || String(content.text ?? content.code ?? content.url ?? "");
          preview = preview.slice(0, 200);
        }
      }

      const msg = await ctx.db.chatMessage.create({
        data: {
          pageId: input.pageId,
          userId: ctx.session.user.id,
          content: input.comment || "블록 참조",
          type: "block_ref",
          metadata: {
            blockId: input.blockId,
            blockType,
            blockPreview: preview.slice(0, 200),
          },
        },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });
      broadcastMsg(msg);
      return msg;
    }),

  /** /poll 명령어 — 투표 생성 */
  createPoll: protectedProcedure
    .input(z.object({
      pageId: z.string(),
      question: z.string().min(1),
      options: z.array(z.string().min(1)).min(2).max(10),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);
      const msg = await ctx.db.chatMessage.create({
        data: {
          pageId: input.pageId,
          userId: ctx.session.user.id,
          content: input.question,
          type: "poll",
          metadata: {
            options: input.options.map((o) => ({ text: o, voters: [] as string[] })),
          },
        },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });
      broadcastMsg(msg);
      return msg;
    }),

  /** 투표하기 */
  votePoll: protectedProcedure
    .input(z.object({ messageId: z.string(), optionIndex: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const msg = await ctx.db.chatMessage.findUnique({ where: { id: input.messageId } });
      if (!msg || msg.type !== "poll") throw new TRPCError({ code: "NOT_FOUND" });
      await verifyPageAccess(ctx.db, ctx.session.user.id, msg.pageId);

      const meta = msg.metadata as { options: { text: string; voters: string[] }[] };
      const opt = meta.options[input.optionIndex];
      if (!opt) throw new TRPCError({ code: "BAD_REQUEST" });

      // Toggle vote
      const idx = opt.voters.indexOf(ctx.session.user.id);
      if (idx >= 0) opt.voters.splice(idx, 1);
      else opt.voters.push(ctx.session.user.id);

      const updated = await ctx.db.chatMessage.update({
        where: { id: input.messageId },
        data: { metadata: meta },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });
      broadcastMsg(updated);
      return updated;
    }),

  /** /task 명령어 — 할일 생성 */
  createTask: protectedProcedure
    .input(z.object({
      pageId: z.string(),
      task: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);
      const msg = await ctx.db.chatMessage.create({
        data: {
          pageId: input.pageId,
          userId: ctx.session.user.id,
          content: input.task,
          type: "task",
          metadata: { done: false, assignee: null },
        },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });
      broadcastMsg(msg);
      return msg;
    }),

  /** 할일 완료 토글 */
  toggleTask: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const msg = await ctx.db.chatMessage.findUnique({ where: { id: input.messageId } });
      if (!msg || msg.type !== "task") throw new TRPCError({ code: "NOT_FOUND" });
      await verifyPageAccess(ctx.db, ctx.session.user.id, msg.pageId);
      const meta = msg.metadata as { done: boolean; assignee: string | null };
      const updated = await ctx.db.chatMessage.update({
        where: { id: input.messageId },
        data: { metadata: { ...meta, done: !meta.done } },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });
      broadcastMsg(updated);
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const msg = await ctx.db.chatMessage.findUnique({ where: { id: input.id } });
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
      if (msg.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "본인의 메시지만 삭제할 수 있습니다" });
      }
      await ctx.db.chatMessage.delete({ where: { id: input.id } });
      chatEmitter.emit({
        id: `__delete__${msg.id}`,
        pageId: msg.pageId,
        userId: msg.userId,
        content: "",
        createdAt: new Date().toISOString(),
        user: { id: msg.userId, name: "", avatarUrl: null },
        type: "system",
        metadata: {},
      });
      return { success: true };
    }),
});
