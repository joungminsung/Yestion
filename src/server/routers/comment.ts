import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";
import type { Context } from "@/server/trpc/init";
import { sendCommentNotificationEmail } from "@/lib/email";
import { emitWorkspaceEvent } from "@/lib/events/emit-workspace-event";

async function verifyPageAccess(
  db: Context["db"],
  userId: string,
  pageId: string,
) {
  const page = await db.page.findUnique({ where: { id: pageId } });
  if (!page) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
  }
  const member = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: page.workspaceId } },
  });
  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No access to this workspace" });
  }
  return page;
}

export const commentRouter = router({
  list: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);

      return ctx.db.comment.findMany({
        where: { pageId: input.pageId, parentId: null },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          replies: {
            include: {
              author: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        pageId: z.string(),
        blockId: z.string().nullish(),
        parentId: z.string().nullish(),
        content: z.string().min(1),
        textFrom: z.number().nullish(),
        textTo: z.number().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);

      const comment = await ctx.db.comment.create({
        data: {
          pageId: input.pageId,
          blockId: input.blockId ?? null,
          parentId: input.parentId ?? null,
          content: input.content,
          authorId: ctx.session.user.id,
          textFrom: input.textFrom ?? null,
          textTo: input.textTo ?? null,
        },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      // Create notification + email for the page owner
      const page = await ctx.db.page.findUnique({
        where: { id: input.pageId },
        select: { createdBy: true, title: true, workspaceId: true },
      });
      if (page && page.createdBy !== ctx.session.user.id) {
        await ctx.db.notification.create({
          data: {
            userId: page.createdBy,
            type: "comment",
            title: `${ctx.session.user.name}님이 댓글을 남겼습니다`,
            pageId: input.pageId,
          },
        });
        // Send email notification (non-blocking)
        const owner = await ctx.db.user.findUnique({
          where: { id: page.createdBy },
          select: { email: true, emailNotify: true },
        });
        if (owner && owner.emailNotify !== false) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const pageUrl = `${appUrl}/${page.workspaceId}/${input.pageId}`;
          sendCommentNotificationEmail(
            owner.email,
            ctx.session.user.name,
            page.title || "제목 없음",
            input.content,
            pageUrl,
          ).catch((err) => {
            console.error("[Comment] Failed to send comment notification email:", err);
          });
        }
      }

      // Log activity
      await ctx.db.activityLog.create({
        data: {
          pageId: input.pageId,
          userId: ctx.session.user.id,
          action: "comment",
          metadata: { commentId: comment.id, parentId: input.parentId ?? null },
        },
      });

      if (page) {
        await emitWorkspaceEvent(
          ctx.db,
          page.workspaceId,
          "comment.created",
          {
            entityType: "comment",
            entityId: comment.id,
            commentId: comment.id,
            pageId: input.pageId,
            parentId: input.parentId ?? null,
            authorId: ctx.session.user.id,
            content: input.content,
          },
          ctx.session.user.id,
        );
      }

      return comment;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.comment.findUnique({ where: { id: input.id } });
      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }
      if (comment.authorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own comments" });
      }

      return ctx.db.comment.update({
        where: { id: input.id },
        data: { content: input.content },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.comment.findUnique({ where: { id: input.id } });
      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }
      if (comment.authorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own comments" });
      }

      await ctx.db.comment.delete({ where: { id: input.id } });
      return { success: true };
    }),

  resolve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.comment.findUnique({ where: { id: input.id } });
      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }
      await verifyPageAccess(ctx.db, ctx.session.user.id, comment.pageId);

      return ctx.db.comment.update({
        where: { id: input.id },
        data: { resolved: true },
      });
    }),

  unresolve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.comment.findUnique({ where: { id: input.id } });
      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }
      await verifyPageAccess(ctx.db, ctx.session.user.id, comment.pageId);

      return ctx.db.comment.update({
        where: { id: input.id },
        data: { resolved: false },
      });
    }),

  addReaction: protectedProcedure
    .input(z.object({ commentId: z.string(), emoji: z.string().min(1).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.comment.findUnique({ where: { id: input.commentId } });
      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }
      await verifyPageAccess(ctx.db, ctx.session.user.id, comment.pageId);

      // Use a transaction to prevent race conditions in the toggle
      return ctx.db.$transaction(async (tx) => {
        const existing = await tx.commentReaction.findUnique({
          where: {
            commentId_userId_emoji: {
              commentId: input.commentId,
              userId: ctx.session.user.id,
              emoji: input.emoji,
            },
          },
        });

        if (existing) {
          await tx.commentReaction.delete({ where: { id: existing.id } });
        } else {
          await tx.commentReaction.create({
            data: {
              commentId: input.commentId,
              userId: ctx.session.user.id,
              emoji: input.emoji,
            },
          });
        }

        // Return updated reactions as a map for backward compatibility
        const allReactions = await tx.commentReaction.findMany({
          where: { commentId: input.commentId },
        });
        const reactions: Record<string, string[]> = {};
        for (const r of allReactions) {
          if (!reactions[r.emoji]) reactions[r.emoji] = [];
          reactions[r.emoji]!.push(r.userId);
        }

        return tx.comment.update({
          where: { id: input.commentId },
          data: { reactions },
        });
      });
    }),
});
