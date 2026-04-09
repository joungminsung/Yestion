import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { router, protectedProcedure, type Context } from "@/server/trpc/init";
import { getEffectivePermission } from "@/lib/permissions";
import { meetingEmitter } from "@/lib/meeting-emitter";
import { normalizeMeetingNotesSnapshot, type MeetingActionItem as MeetingNotesActionItem, type MeetingEvidenceItem } from "@/lib/meeting-notes";
import {
  getSpeakerDisplayName,
  markMeetingSessionError,
  markStaleMeetingParticipantsInactive,
  maybeCreateMeetingSnapshot,
  markMeetingParticipantInactive,
  upsertMeetingParticipant,
} from "@/lib/meeting-service";
import { DEFAULT_ANNOTATION } from "@/types/editor";

async function verifyPageAccess(
  db: Context["db"],
  userId: string,
  pageId: string,
) {
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      title: true,
      workspaceId: true,
      meetingEnabled: true,
    },
  });

  if (!page) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
  }

  const permission = await getEffectivePermission(db, userId, pageId);
  if (permission === "none") {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this page" });
  }

  return {
    ...page,
    permission,
  };
}

async function verifyEditPermission(
  db: Context["db"],
  userId: string,
  pageId: string,
) {
  const permission = await getEffectivePermission(db, userId, pageId);
  if (permission !== "edit") {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have edit permission on this page" });
  }
}

const sessionInclude = Prisma.validator<Prisma.MeetingSessionInclude>()({
  chunkReceipts: {
    orderBy: { createdAt: "desc" as const },
    take: 400,
  },
  participants: {
    orderBy: [
      { status: "asc" as const },
      { joinedAt: "asc" as const },
    ],
  },
  speakers: {
    orderBy: { sortOrder: "asc" as const },
  },
  utterances: {
    orderBy: [{ startMs: "asc" as const }, { createdAt: "asc" as const }],
    take: 200,
  },
  snapshots: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
});

type MeetingSessionWithRelations = Prisma.MeetingSessionGetPayload<{
  include: typeof sessionInclude;
}>;

type SerializedMeetingParticipant = {
  id: string;
  userId: string;
  displayName: string;
  status: string;
  joinedAt: Date;
  lastSeenAt: Date;
  leftAt: Date | null;
};

type SerializedMeetingSpeaker = {
  id: string;
  label: string;
  displayName: string | null;
  resolvedName: string;
  source: string;
};

type SerializedMeetingUtterance = {
  id: string;
  speakerId: string | null;
  speakerLabel: string;
  text: string;
  startMs: number;
  endMs: number;
  chunkIndex: number;
  chunkStartedAtMs: number;
  audioSourceKey: string;
  createdAt: Date;
};

type SerializedMeetingSnapshot = {
  id: string;
  summary: string;
  discussion: string[];
  discussionItems: MeetingEvidenceItem[];
  decisions: string[];
  decisionItems: MeetingEvidenceItem[];
  actionItems: MeetingNotesActionItem[];
  createdAt: Date;
};

type SerializedMeetingSession = {
  id: string;
  pageId: string;
  status: string;
  mode: string;
  title: string | null;
  storeAudio: boolean;
  startedAt: Date;
  endedAt: Date | null;
  lastChunkIndex: number;
  lastProcessedAt: Date | null;
  lastNotesChunkIndex: number;
  lastNotesGeneratedAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  audioAvailable: boolean;
  participants: SerializedMeetingParticipant[];
  speakers: SerializedMeetingSpeaker[];
  utterances: SerializedMeetingUtterance[];
  snapshot: SerializedMeetingSnapshot | null;
};

function extractEvidenceTexts(items: MeetingEvidenceItem[]) {
  return items.map((item) => {
    const title = item.title?.trim();
    if (!title) {
      return item.text;
    }
    return `${title}: ${item.text}`;
  });
}

function formatEvidenceItemBody(item: MeetingEvidenceItem) {
  const lines = [
    item.text.trim(),
    item.detail?.trim() ?? "",
  ].filter(Boolean);

  return lines.join("\n");
}

function formatActionPriorityLabel(priority: string | null) {
  const normalized = priority?.trim().toLowerCase();
  if (!normalized) return "미지정";
  if (normalized === "high") return "높음";
  if (normalized === "medium") return "보통";
  if (normalized === "low") return "낮음";
  return priority ?? "미지정";
}

function createTextNode(text: string) {
  return {
    type: "text",
    text,
  };
}

function createParagraphNode(text: string) {
  return {
    type: "paragraph",
    content: text.trim().length > 0 ? [createTextNode(text)] : [createTextNode(" ")],
  };
}

function tableContent(rows: string[][], options?: { header?: boolean }) {
  return {
    tiptapNode: {
      type: "table",
      content: rows.map((row, rowIndex) => ({
        type: "tableRow",
        content: row.map((cell) => ({
          type: options?.header && rowIndex === 0 ? "tableHeader" : "tableCell",
          content: [createParagraphNode(cell)],
        })),
      })),
    },
  };
}

function calloutContent(text: string, options?: { icon?: string; color?: string }) {
  return {
    icon: options?.icon ?? "📝",
    color: options?.color ?? "blue",
    richText: [
      {
        text,
        annotations: DEFAULT_ANNOTATION,
      },
    ],
  };
}

function normalizeSnapshotForClient(snapshot: {
  id: string;
  summary: string;
  discussion: Prisma.JsonValue;
  decisions: Prisma.JsonValue;
  actionItems: Prisma.JsonValue;
  createdAt: Date;
}): SerializedMeetingSnapshot {
  const normalized = normalizeMeetingNotesSnapshot({
    summary: snapshot.summary,
    discussion: snapshot.discussion,
    decisions: snapshot.decisions,
    actionItems: snapshot.actionItems,
  });

  return {
    id: snapshot.id,
    summary: normalized.summary,
    discussion: extractEvidenceTexts(normalized.discussion),
    discussionItems: normalized.discussion,
    decisions: extractEvidenceTexts(normalized.decisions),
    decisionItems: normalized.decisions,
    actionItems: normalized.actionItems,
    createdAt: snapshot.createdAt,
  };
}

function getAudioSourceKey(mode: string, utterance: { speakerLabel: string }) {
  return mode === "multi_participant" ? utterance.speakerLabel : "single_recorder";
}

function serializeSession(session: MeetingSessionWithRelations | null): SerializedMeetingSession | null {
  if (!session) return null;

  const latestSnapshot = session.snapshots[0] ?? null;
  const chunkReceiptMap = new Map(
    session.chunkReceipts.map((receipt) => [
      `${receipt.sourceKey}:${receipt.chunkIndex}`,
      receipt.chunkStartedAtMs,
    ]),
  );

  return {
    id: session.id,
    pageId: session.pageId,
    status: session.status,
    mode: session.mode,
    title: session.title,
    storeAudio: session.storeAudio,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    lastChunkIndex: session.lastChunkIndex,
    lastProcessedAt: session.lastProcessedAt,
    lastNotesChunkIndex: session.lastNotesChunkIndex,
    lastNotesGeneratedAt: session.lastNotesGeneratedAt,
    lastError: session.lastError,
    lastErrorAt: session.lastErrorAt,
    audioAvailable: session.storeAudio && session.chunkReceipts.length > 0,
    participants: session.participants.map((participant) => ({
      id: participant.id,
      userId: participant.userId,
      displayName: participant.displayName,
      status: participant.status,
      joinedAt: participant.joinedAt,
      lastSeenAt: participant.lastSeenAt,
      leftAt: participant.leftAt,
    })),
    speakers: session.speakers.map((speaker) => ({
      id: speaker.id,
      label: speaker.label,
      displayName: speaker.displayName,
      resolvedName: getSpeakerDisplayName({
        label: speaker.label,
        displayName: speaker.displayName,
      }),
      source: speaker.source,
    })),
    utterances: session.utterances.map((utterance) => ({
      id: utterance.id,
      speakerId: utterance.speakerId,
      speakerLabel: utterance.speakerLabel,
      text: utterance.text,
      startMs: utterance.startMs,
      endMs: utterance.endMs,
      chunkIndex: utterance.chunkIndex,
      chunkStartedAtMs:
        chunkReceiptMap.get(`${getAudioSourceKey(session.mode, utterance)}:${utterance.chunkIndex}`)
        ?? utterance.chunkIndex * 5000,
      audioSourceKey: getAudioSourceKey(session.mode, utterance),
      createdAt: utterance.createdAt,
    })),
    snapshot: latestSnapshot ? normalizeSnapshotForClient(latestSnapshot) : null,
  };
}

function emitSessionUpdated(pageId: string, sessionId: string) {
  meetingEmitter.emit({
    type: "session.updated",
    pageId,
    sessionId,
    timestamp: new Date().toISOString(),
  });
}

function emitSnapshotUpdated(pageId: string, sessionId: string, snapshotId: string) {
  meetingEmitter.emit({
    type: "snapshot.updated",
    pageId,
    sessionId,
    snapshotId,
    timestamp: new Date().toISOString(),
  });
}

function plainRichText(text: string) {
  return {
    richText: [
      {
        text,
        annotations: DEFAULT_ANNOTATION,
      },
    ],
  };
}

function todoContent(text: string) {
  return {
    richText: [
      {
        text,
        annotations: DEFAULT_ANNOTATION,
      },
    ],
    checked: false,
  };
}

function buildActionItemPromotionDescription(params: {
  sessionTitle: string | null;
  summary: string;
  actionItem: MeetingNotesActionItem;
  evidenceLines: string[];
}) {
  const lines = [
    params.summary.trim() ? `회의 요약: ${params.summary.trim()}` : "",
    params.sessionTitle?.trim() ? `회의 제목: ${params.sessionTitle.trim()}` : "",
    params.actionItem.owner ? `담당자 메모: ${params.actionItem.owner}` : "",
    params.actionItem.status ? `원본 상태: ${params.actionItem.status}` : "",
    params.actionItem.priority ? `우선순위: ${params.actionItem.priority}` : "",
    params.actionItem.dueDate ? `희망 기한: ${params.actionItem.dueDate}` : "",
    params.evidenceLines.length > 0 ? "근거 발화:" : "",
    ...params.evidenceLines.map((line) => `- ${line}`),
  ].filter(Boolean);

  return lines.join("\n");
}

async function verifyWorkspaceMembership(
  db: Context["db"],
  userId: string,
  workspaceId: string,
) {
  const member = await db.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
  });

  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No access to this workspace" });
  }

  return member;
}

export const meetingRouter = router({
  getPageState: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .query(async ({ ctx, input }) => {
      const page = await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);
      let activeSession = await ctx.db.meetingSession.findFirst({
        where: {
          pageId: input.pageId,
          status: "active",
        },
        orderBy: { startedAt: "desc" },
        include: sessionInclude,
      });

      if (activeSession?.mode === "multi_participant") {
        const changedCount = await markStaleMeetingParticipantsInactive(ctx.db, {
          sessionId: activeSession.id,
        });

        if (changedCount > 0) {
          activeSession = await ctx.db.meetingSession.findUnique({
            where: { id: activeSession.id },
            include: sessionInclude,
          });
        }
      }

      const session = activeSession
        ?? await ctx.db.meetingSession.findFirst({
          where: {
            pageId: input.pageId,
          },
          orderBy: { startedAt: "desc" },
          include: sessionInclude,
        });

      return {
        page: {
          id: page.id,
          title: page.title,
          workspaceId: page.workspaceId,
          meetingEnabled: page.meetingEnabled,
          permission: page.permission,
          canEdit: page.permission === "edit",
        },
        session: serializeSession(session),
      };
    }),

  getWorkspaceTargets: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .query(async ({ ctx, input }) => {
      const page = await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);

      const workspaceMember = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.session.user.id,
            workspaceId: page.workspaceId,
          },
        },
      });

      const databases = workspaceMember
        ? await ctx.db.database.findMany({
            where: {
              page: {
                workspaceId: page.workspaceId,
                isDeleted: false,
              },
            },
            select: {
              id: true,
              isLocked: true,
              page: {
                select: {
                  id: true,
                  title: true,
                  icon: true,
                },
              },
            },
            orderBy: {
              page: {
                updatedAt: "desc",
              },
            },
          })
        : [];

      return {
        databases: databases.map((database) => ({
          id: database.id,
          title: database.page.title,
          icon: database.page.icon,
          isLocked: database.isLocked,
        })),
      };
    }),

  togglePageEnabled: protectedProcedure
    .input(z.object({ pageId: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);
      await verifyEditPermission(ctx.db, ctx.session.user.id, input.pageId);

      if (!input.enabled) {
        const activeSession = await ctx.db.meetingSession.findFirst({
          where: {
            pageId: input.pageId,
            status: "active",
          },
          select: { id: true },
        });

        if (activeSession) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "활성 회의가 끝난 뒤에만 회의 기능을 끌 수 있습니다",
          });
        }
      }

      const updated = await ctx.db.page.update({
        where: { id: input.pageId },
        data: {
          meetingEnabled: input.enabled,
          lastEditedBy: ctx.session.user.id,
        },
      });

      return {
        id: updated.id,
        meetingEnabled: updated.meetingEnabled,
      };
    }),

  startSession: protectedProcedure
    .input(
      z.object({
        pageId: z.string(),
        storeAudio: z.boolean().default(false),
        mode: z.enum(["single_recorder", "multi_participant"]).default("single_recorder"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const page = await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);
      await verifyEditPermission(ctx.db, ctx.session.user.id, input.pageId);

      const existing = await ctx.db.meetingSession.findFirst({
        where: {
          pageId: input.pageId,
          status: "active",
        },
        orderBy: { startedAt: "desc" },
        include: sessionInclude,
      });

      if (existing) {
        return {
          session: serializeSession(existing),
          reusedExisting: true,
        };
      }

      if (!page.meetingEnabled) {
        await ctx.db.page.update({
          where: { id: input.pageId },
          data: {
            meetingEnabled: true,
            lastEditedBy: ctx.session.user.id,
          },
        });
      }

      const created = await ctx.db.meetingSession.create({
        data: {
          pageId: input.pageId,
          workspaceId: page.workspaceId,
          createdBy: ctx.session.user.id,
          title: `${page.title || "제목 없음"} 회의`,
          storeAudio: input.storeAudio,
          mode: input.mode,
        },
        include: sessionInclude,
      });

      emitSessionUpdated(input.pageId, created.id);

      return {
        session: serializeSession(created),
        reusedExisting: false,
      };
    }),

  stopSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.meetingSession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meeting session not found" });
      }

      await verifyPageAccess(ctx.db, ctx.session.user.id, session.pageId);
      await verifyEditPermission(ctx.db, ctx.session.user.id, session.pageId);

      let snapshotId: string | null = null;

      const utteranceCount = await ctx.db.meetingUtterance.count({
        where: { sessionId: input.sessionId },
      });

      if (utteranceCount > 0) {
        try {
          const snapshot = await maybeCreateMeetingSnapshot(ctx.db, input.sessionId, { force: true });
          snapshotId = snapshot?.id ?? null;
        } catch (error) {
          await markMeetingSessionError(
            ctx.db,
            input.sessionId,
            error instanceof Error ? error.message : "회의록 생성에 실패했습니다",
          );
        }
      }

      const updated = await ctx.db.meetingSession.update({
        where: { id: input.sessionId },
        data: {
          status: "completed",
          endedAt: new Date(),
          participants: {
            updateMany: {
              where: {
                status: "active",
              },
              data: {
                status: "inactive",
                lastSeenAt: new Date(),
                leftAt: new Date(),
              },
            },
          },
        },
        include: sessionInclude,
      });

      emitSessionUpdated(updated.pageId, updated.id);
      if (snapshotId) {
        emitSnapshotUpdated(updated.pageId, updated.id, snapshotId);
      }

      return {
        session: serializeSession(updated),
      };
    }),

  joinSessionAudio: protectedProcedure
    .input(z.object({ sessionId: z.string(), displayName: z.string().trim().min(1).max(120).optional() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.meetingSession.findUnique({
        where: { id: input.sessionId },
        include: sessionInclude,
      });

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meeting session not found" });
      }

      await verifyPageAccess(ctx.db, ctx.session.user.id, session.pageId);
      await verifyEditPermission(ctx.db, ctx.session.user.id, session.pageId);

      if (session.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "활성 회의에서만 참여할 수 있습니다" });
      }

      if (session.mode !== "multi_participant") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "참여자별 마이크 세션에서만 참여할 수 있습니다" });
      }

      await upsertMeetingParticipant(ctx.db, {
        sessionId: session.id,
        userId: ctx.session.user.id,
        displayName: input.displayName?.trim() || ctx.session.user.name || "참가자",
      });

      const updated = await ctx.db.meetingSession.findUnique({
        where: { id: session.id },
        include: sessionInclude,
      });

      emitSessionUpdated(session.pageId, session.id);

      return {
        session: serializeSession(updated),
      };
    }),

  heartbeatSessionAudio: protectedProcedure
    .input(z.object({ sessionId: z.string(), displayName: z.string().trim().min(1).max(120).optional() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.meetingSession.findUnique({
        where: { id: input.sessionId },
        include: sessionInclude,
      });

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meeting session not found" });
      }

      await verifyPageAccess(ctx.db, ctx.session.user.id, session.pageId);
      await verifyEditPermission(ctx.db, ctx.session.user.id, session.pageId);

      if (session.status !== "active" || session.mode !== "multi_participant") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "활성 참여자별 마이크 세션에서만 heartbeat를 보낼 수 있습니다" });
      }

      await upsertMeetingParticipant(ctx.db, {
        sessionId: session.id,
        userId: ctx.session.user.id,
        displayName: input.displayName?.trim() || ctx.session.user.name || "참가자",
      });

      return { success: true };
    }),

  leaveSessionAudio: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.meetingSession.findUnique({
        where: { id: input.sessionId },
        include: sessionInclude,
      });

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meeting session not found" });
      }

      await verifyPageAccess(ctx.db, ctx.session.user.id, session.pageId);
      await verifyEditPermission(ctx.db, ctx.session.user.id, session.pageId);

      if (session.mode !== "multi_participant") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "참여자별 마이크 세션에서만 참여 상태를 변경할 수 있습니다" });
      }

      await markMeetingParticipantInactive(ctx.db, {
        sessionId: session.id,
        userId: ctx.session.user.id,
      });

      const updated = await ctx.db.meetingSession.findUnique({
        where: { id: session.id },
        include: sessionInclude,
      });

      emitSessionUpdated(session.pageId, session.id);

      return {
        session: serializeSession(updated),
      };
    }),

  renameSpeaker: protectedProcedure
    .input(z.object({ speakerId: z.string(), displayName: z.string().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const speaker = await ctx.db.meetingSpeaker.findUnique({
        where: { id: input.speakerId },
        include: {
          session: true,
        },
      });

      if (!speaker) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Speaker not found" });
      }

      await verifyPageAccess(ctx.db, ctx.session.user.id, speaker.session.pageId);
      await verifyEditPermission(ctx.db, ctx.session.user.id, speaker.session.pageId);

      const updated = await ctx.db.meetingSpeaker.update({
        where: { id: input.speakerId },
        data: {
          displayName: input.displayName.trim(),
          source: "manual",
        },
      });

      emitSessionUpdated(speaker.session.pageId, speaker.sessionId);

      return updated;
    }),

  promoteActionItem: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      actionItemIndex: z.number().int().min(0),
      targetType: z.literal("database_row"),
      targetId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.meetingSession.findUnique({
        where: { id: input.sessionId },
        include: {
          speakers: {
            orderBy: { sortOrder: "asc" },
          },
          utterances: {
            orderBy: [{ startMs: "asc" }, { createdAt: "asc" }],
          },
          snapshots: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meeting session not found" });
      }

      await verifyPageAccess(ctx.db, ctx.session.user.id, session.pageId);
      await verifyEditPermission(ctx.db, ctx.session.user.id, session.pageId);

      const latestSnapshot = session.snapshots[0];
      if (!latestSnapshot) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "회의록 스냅샷이 없습니다" });
      }

      const normalizedSnapshot = normalizeMeetingNotesSnapshot({
        summary: latestSnapshot.summary,
        discussion: latestSnapshot.discussion,
        decisions: latestSnapshot.decisions,
        actionItems: latestSnapshot.actionItems,
      });
      const actionItem = normalizedSnapshot.actionItems[input.actionItemIndex];

      if (!actionItem) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "선택한 액션 아이템을 찾을 수 없습니다" });
      }

      const speakerNameById = new Map(
        session.speakers.map((speaker) => [
          speaker.id,
          getSpeakerDisplayName({
            label: speaker.label,
            displayName: speaker.displayName,
          }),
        ]),
      );
      const evidenceUtterances = session.utterances.filter((utterance) =>
        actionItem.evidenceUtteranceIds.includes(utterance.id),
      );
      const evidenceLines = evidenceUtterances.map((utterance) => {
        const speakerName = utterance.speakerId
          ? speakerNameById.get(utterance.speakerId) ?? utterance.speakerLabel
          : utterance.speakerLabel;
        return `${speakerName}: ${utterance.text}`;
      });
      const description = buildActionItemPromotionDescription({
        sessionTitle: session.title,
        summary: normalizedSnapshot.summary,
        actionItem,
        evidenceLines,
      });

      await verifyWorkspaceMembership(ctx.db, ctx.session.user.id, session.workspaceId);

      const database = await ctx.db.database.findUnique({
        where: { id: input.targetId },
        include: {
          page: {
            select: {
              id: true,
              workspaceId: true,
              title: true,
            },
          },
          properties: {
            where: { type: "title" },
            orderBy: { position: "asc" },
            take: 1,
          },
        },
      });

      if (!database || database.page.workspaceId !== session.workspaceId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "선택한 데이터베이스에 항목을 만들 수 없습니다" });
      }

      if (database.isLocked) {
        throw new TRPCError({ code: "FORBIDDEN", message: "선택한 데이터베이스가 잠겨 있습니다" });
      }

      const titleProperty = database.properties[0];
      if (!titleProperty) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "데이터베이스에 title 속성이 없습니다" });
      }

      const rowPage = await ctx.db.page.create({
        data: {
          workspaceId: database.page.workspaceId,
          parentId: database.page.id,
          title: actionItem.text,
          createdBy: ctx.session.user.id,
          lastEditedBy: ctx.session.user.id,
        },
      });

      const row = await ctx.db.row.create({
        data: {
          databaseId: database.id,
          pageId: rowPage.id,
          values: {
            [titleProperty.id]: actionItem.text,
          },
        },
        include: {
          page: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      return {
        targetType: "database_row" as const,
        recordId: row.id,
        label: row.page.title,
      };
    }),

  exportSessionToPage: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.meetingSession.findUnique({
        where: { id: input.sessionId },
        include: {
          snapshots: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meeting session not found" });
      }

      await verifyPageAccess(ctx.db, ctx.session.user.id, session.pageId);
      await verifyEditPermission(ctx.db, ctx.session.user.id, session.pageId);

      const snapshot = session.snapshots[0];
      if (!snapshot) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No meeting snapshot to export" });
      }

      const normalizedSnapshot = normalizeMeetingNotesSnapshot({
        summary: snapshot.summary,
        discussion: snapshot.discussion,
        decisions: snapshot.decisions,
        actionItems: snapshot.actionItems,
      });
      const discussionItems = normalizedSnapshot.discussion;
      const decisionItems = normalizedSnapshot.decisions;
      const actionItems = normalizedSnapshot.actionItems;

      const startedLabel = session.startedAt.toLocaleString("ko-KR");

      const blocksToCreate: Array<{
        id: string;
        pageId: string;
        type: string;
        content: Prisma.InputJsonValue;
        position: number;
        parentId: string | null;
      }> = [];

      const pushBlock = (type: string, content: Prisma.InputJsonValue) => {
        blocksToCreate.push({
          id: crypto.randomUUID(),
          pageId: session.pageId,
          type,
          content,
          position: blocksToCreate.length,
          parentId: null,
        });
      };

      const pushParagraph = (text: string) => {
        if (!text.trim()) return;
        pushBlock("paragraph", plainRichText(text.trim()) as Prisma.InputJsonValue);
      };

      const pushHeading = (text: string, level: 2 | 3 = 2) => {
        pushBlock(
          level === 2 ? "heading_2" : "heading_3",
          {
            ...plainRichText(text),
            level,
          } as Prisma.InputJsonValue,
        );
      };

      const pushCallout = (text: string, options?: { icon?: string; color?: string }) => {
        if (!text.trim()) return;
        pushBlock("callout", calloutContent(text.trim(), options) as Prisma.InputJsonValue);
      };

      const pushTable = (rows: string[][], options?: { header?: boolean }) => {
        if (rows.length === 0 || rows.every((row) => row.every((cell) => !cell.trim()))) return;
        pushBlock("table", tableContent(rows, options) as Prisma.InputJsonValue);
      };

      pushHeading(`회의록 - ${startedLabel}`, 2);
      pushTable([
        ["항목", "내용"],
        ["회의명", session.title?.trim() || "제목 없음"],
        ["기록 시각", startedLabel],
        ["회의 상태", session.status === "completed" ? "종료됨" : "진행 중"],
        ["기록 방식", session.mode === "multi_participant" ? "참여자별 마이크" : "룸 마이크"],
      ], { header: true });

      pushCallout(normalizedSnapshot.summary, { icon: "🗂️", color: "blue" });

      pushHeading("논의 안건", 3);
      if (discussionItems.length > 0) {
        discussionItems.forEach((item, index) => {
          pushHeading(`${index + 1}. ${item.title?.trim() || item.text}`, 3);
          pushParagraph(formatEvidenceItemBody(item));
        });
      } else {
        pushParagraph("아직 정리된 논의 안건이 없습니다.");
      }

      pushHeading("결정 사항", 3);
      pushTable(
        [
          ["결정 주제", "결정 내용", "상세"],
          ...(decisionItems.length > 0
            ? decisionItems.map((item) => [
              item.title?.trim() || item.text,
              item.text,
              item.detail?.trim() || "-",
            ])
            : [["-", "아직 정리된 결정 사항이 없습니다.", "-"]]),
        ],
        { header: true },
      );

      pushHeading("액션 아이템", 3);
      if (actionItems.length > 0) {
        pushTable(
          [
            ["할 일", "담당", "상태", "우선순위", "기한"],
            ...actionItems.map((item) => [
              item.text,
              item.owner?.trim() || "미지정",
              item.status?.trim() || "todo",
              formatActionPriorityLabel(item.priority),
              item.dueDate?.trim() || "-",
            ]),
          ],
          { header: true },
        );

        actionItems.forEach((item) => {
          const statusLabel = item.status?.trim() || "todo";
          const suffixParts = [
            item.owner?.trim() ? `담당: ${item.owner.trim()}` : "",
            statusLabel ? `상태: ${statusLabel}` : "",
            item.priority?.trim() ? `우선순위: ${formatActionPriorityLabel(item.priority)}` : "",
            item.dueDate?.trim() ? `기한: ${item.dueDate.trim()}` : "",
          ].filter(Boolean);
          const fullText = suffixParts.length > 0 ? `${item.text} (${suffixParts.join(", ")})` : item.text;
          pushBlock("to_do", todoContent(fullText) as Prisma.InputJsonValue);
        });
      } else {
        pushParagraph("아직 생성된 액션 아이템이 없습니다.");
      }

      await ctx.db.$transaction(async (tx) => {
        if (blocksToCreate.length > 0) {
          await tx.block.updateMany({
            where: {
              pageId: session.pageId,
              parentId: null,
            },
            data: {
              position: {
                increment: blocksToCreate.length,
              },
            },
          });

          await tx.block.createMany({
            data: blocksToCreate,
          });
        }

        await tx.page.update({
          where: { id: session.pageId },
          data: {
            lastEditedBy: ctx.session.user.id,
          },
        });
      });

      return {
        success: true,
        createdBlockCount: blocksToCreate.length,
      };
    }),
});
