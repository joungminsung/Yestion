import { Prisma, PrismaClient } from "@prisma/client";
import { generateMeetingNotesSnapshot, normalizeMeetingNotesSnapshot, type MeetingNotesSnapshot } from "@/lib/meeting-notes";

type DbLike = PrismaClient | Prisma.TransactionClient;
type MeetingSnapshotSource = {
  summary: string;
  discussion: Prisma.JsonValue;
  decisions: Prisma.JsonValue;
  actionItems: Prisma.JsonValue;
};
type MeetingSessionForSnapshot = Prisma.MeetingSessionGetPayload<{
  include: {
    speakers: true;
    utterances: true;
    snapshots: true;
  };
}>;
type MeetingSpeakerRecord = MeetingSessionForSnapshot["speakers"][number];
type MeetingUtteranceRecord = MeetingSessionForSnapshot["utterances"][number];

const DEFAULT_NOTES_DEBOUNCE_MS = 30_000;
export const MEETING_PARTICIPANT_STALE_MS = 25_000;

function getMeetingNotesDebounceMs() {
  const configured = Number.parseInt(process.env.MEETING_NOTES_DEBOUNCE_MS ?? "", 10);
  if (Number.isFinite(configured) && configured >= 0) {
    return configured;
  }
  return DEFAULT_NOTES_DEBOUNCE_MS;
}

export function getSpeakerDisplayName(input: {
  displayName?: string | null;
  label: string;
}) {
  return input.displayName?.trim() || input.label.replace(/_/g, " ");
}

export function buildMeetingChunkSourceKey(params: {
  mode: string;
  participantLabel?: string | null;
  userId?: string | null;
}) {
  if (params.mode === "multi_participant") {
    if (params.userId?.trim()) {
      return `participant_user_${params.userId.trim()}`;
    }

    const displayName = params.participantLabel?.trim() || "participant";
    const slug = displayName
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "_")
      .replace(/^_+|_+$/g, "");

    return `participant_${slug || "speaker"}`;
  }

  return "single_recorder";
}

export async function upsertMeetingParticipant(
  db: DbLike,
  input: {
    sessionId: string;
    userId: string;
    displayName: string;
  },
) {
  const displayName = input.displayName.trim() || "참가자";

  const existing = await db.meetingParticipant.findUnique({
    where: {
      sessionId_userId: {
        sessionId: input.sessionId,
        userId: input.userId,
      },
    },
  });

  if (existing) {
    return db.meetingParticipant.update({
      where: { id: existing.id },
      data: {
        displayName,
        status: "active",
        leftAt: null,
        lastSeenAt: new Date(),
      },
    });
  }

  return db.meetingParticipant.create({
    data: {
      sessionId: input.sessionId,
      userId: input.userId,
      displayName,
      status: "active",
      lastSeenAt: new Date(),
    },
  });
}

export async function markMeetingParticipantInactive(
  db: DbLike,
  input: {
    sessionId: string;
    userId: string;
  },
) {
  const existing = await db.meetingParticipant.findUnique({
    where: {
      sessionId_userId: {
        sessionId: input.sessionId,
        userId: input.userId,
      },
    },
  });

  if (!existing) return null;

  return db.meetingParticipant.update({
    where: { id: existing.id },
    data: {
      status: "inactive",
      lastSeenAt: new Date(),
      leftAt: new Date(),
    },
  });
}

export async function markStaleMeetingParticipantsInactive(
  db: DbLike,
  input: {
    sessionId: string;
    staleMs?: number;
  },
) {
  const threshold = new Date(Date.now() - (input.staleMs ?? MEETING_PARTICIPANT_STALE_MS));

  const result = await db.meetingParticipant.updateMany({
    where: {
      sessionId: input.sessionId,
      status: "active",
      lastSeenAt: {
        lt: threshold,
      },
    },
    data: {
      status: "inactive",
      leftAt: new Date(),
    },
  });

  return result.count;
}

export async function claimMeetingChunkReceipt(
  db: DbLike,
  input: {
    sessionId: string;
    sourceKey: string;
    chunkIndex: number;
    chunkStartedAtMs: number;
    chunkEndedAtMs: number;
  },
) {
  const existing = await db.meetingChunkReceipt.findUnique({
    where: {
      sessionId_sourceKey_chunkIndex: {
        sessionId: input.sessionId,
        sourceKey: input.sourceKey,
        chunkIndex: input.chunkIndex,
      },
    },
  });

  if (!existing) {
    await db.meetingChunkReceipt.create({
      data: {
        sessionId: input.sessionId,
        sourceKey: input.sourceKey,
        chunkIndex: input.chunkIndex,
        chunkStartedAtMs: input.chunkStartedAtMs,
        chunkEndedAtMs: input.chunkEndedAtMs,
        status: "processing",
      },
    });

    return {
      shouldProcess: true,
      sourceKey: input.sourceKey,
    };
  }

  if (existing.status === "failed") {
    await db.meetingChunkReceipt.update({
      where: { id: existing.id },
      data: {
        status: "processing",
        error: null,
        processedAt: null,
        chunkStartedAtMs: input.chunkStartedAtMs,
        chunkEndedAtMs: input.chunkEndedAtMs,
      },
    });

    return {
      shouldProcess: true,
      sourceKey: input.sourceKey,
    };
  }

  return {
    shouldProcess: false,
    sourceKey: input.sourceKey,
  };
}

export async function finalizeMeetingChunkReceipt(
  db: DbLike,
  input: {
    sessionId: string;
    sourceKey: string;
    chunkIndex: number;
  },
) {
  await db.meetingChunkReceipt.update({
    where: {
      sessionId_sourceKey_chunkIndex: {
        sessionId: input.sessionId,
        sourceKey: input.sourceKey,
        chunkIndex: input.chunkIndex,
      },
    },
    data: {
      status: "processed",
      processedAt: new Date(),
      error: null,
    },
  });
}

export async function failMeetingChunkReceipt(
  db: DbLike,
  input: {
    sessionId: string;
    sourceKey: string;
    chunkIndex: number;
    error: string;
  },
) {
  await db.meetingChunkReceipt.update({
    where: {
      sessionId_sourceKey_chunkIndex: {
        sessionId: input.sessionId,
        sourceKey: input.sourceKey,
        chunkIndex: input.chunkIndex,
      },
    },
    data: {
      status: "failed",
      processedAt: null,
      error: input.error.slice(0, 500),
    },
  });
}

export async function ensureMeetingSpeaker(
  db: DbLike,
  sessionId: string,
  label: string,
  options?: {
    displayName?: string | null;
    source?: string;
  },
) {
  const existing = await db.meetingSpeaker.findUnique({
    where: {
      sessionId_label: {
        sessionId,
        label,
      },
    },
  });

  if (existing) {
    const nextDisplayName = options?.displayName?.trim() || null;
    const nextSource = options?.source;

    if (nextDisplayName && existing.displayName !== nextDisplayName) {
      return db.meetingSpeaker.update({
        where: { id: existing.id },
        data: {
          displayName: nextDisplayName,
          ...(nextSource ? { source: nextSource } : {}),
        },
      });
    }

    if (nextSource && existing.source !== nextSource) {
      return db.meetingSpeaker.update({
        where: { id: existing.id },
        data: {
          source: nextSource,
        },
      });
    }

    return existing;
  }

  const count = await db.meetingSpeaker.count({
    where: { sessionId },
  });

  return db.meetingSpeaker.create({
    data: {
      sessionId,
      label,
      displayName: options?.displayName?.trim() || null,
      source: options?.source ?? "diarization",
      sortOrder: count,
    },
  });
}

function snapshotToNotesSnapshot(snapshot: MeetingSnapshotSource | null): MeetingNotesSnapshot | null {
  if (!snapshot) return null;
  return normalizeMeetingNotesSnapshot({
    summary: snapshot.summary,
    discussion: snapshot.discussion,
    decisions: snapshot.decisions,
    actionItems: snapshot.actionItems,
  });
}

export async function markMeetingSessionError(
  db: DbLike,
  sessionId: string,
  message: string,
) {
  return db.meetingSession.update({
    where: { id: sessionId },
    data: {
      lastError: message.slice(0, 500),
      lastErrorAt: new Date(),
    },
  });
}

export async function clearMeetingSessionError(
  db: DbLike,
  sessionId: string,
) {
  return db.meetingSession.update({
    where: { id: sessionId },
    data: {
      lastError: null,
      lastErrorAt: null,
    },
  });
}

function shouldGenerateNotes(params: {
  force: boolean;
  lastProcessedAt: Date | null;
  lastNotesGeneratedAt: Date | null;
}) {
  if (params.force) return true;
  if (!params.lastProcessedAt) return false;
  if (params.lastNotesGeneratedAt && params.lastProcessedAt <= params.lastNotesGeneratedAt) return false;
  if (!params.lastNotesGeneratedAt) return true;
  return Date.now() - params.lastNotesGeneratedAt.getTime() >= getMeetingNotesDebounceMs();
}

export async function createMeetingSnapshot(
  db: DbLike,
  sessionId: string,
  options?: {
    latestChunkIndex?: number;
  },
) {
  const session = await db.meetingSession.findUnique({
    where: { id: sessionId },
    include: {
      speakers: {
        orderBy: { sortOrder: "asc" },
      },
      utterances: {
        orderBy: [{ startMs: "desc" }, { createdAt: "desc" }],
        take: 150,
      },
      snapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!session) {
    throw new Error("Meeting session not found");
  }

  const latestChunkIndex = options?.latestChunkIndex
    ?? session.utterances[0]?.chunkIndex
    ?? session.lastNotesChunkIndex;

  const speakerNameById = new Map(
    session.speakers.map((speaker: MeetingSpeakerRecord) => [
      speaker.id,
      getSpeakerDisplayName({
        label: speaker.label,
        displayName: speaker.displayName,
      }),
    ]),
  );

  const transcript = [...session.utterances]
    .sort((left, right) => left.startMs - right.startMs)
    .map((utterance: MeetingUtteranceRecord) => {
      const speakerName = utterance.speakerId
        ? speakerNameById.get(utterance.speakerId) ?? utterance.speakerLabel
        : utterance.speakerLabel;
      const minutes = Math.floor(utterance.startMs / 60000);
      const seconds = Math.floor((utterance.startMs % 60000) / 1000);
      const timeLabel = `${minutes}:${String(seconds).padStart(2, "0")}`;
      return `[${utterance.id}] [${timeLabel}] ${speakerName}: ${utterance.text}`;
    })
    .join("\n");

  const previousSnapshot = snapshotToNotesSnapshot(session.snapshots[0] ?? null);
  const generated = await generateMeetingNotesSnapshot({
    transcript,
    previousSnapshot,
    availableUtteranceIds: session.utterances.map((utterance: MeetingUtteranceRecord) => utterance.id),
    sessionTitle: session.title,
    speakerNames: session.speakers.map((speaker: MeetingSpeakerRecord) =>
      getSpeakerDisplayName({
        label: speaker.label,
        displayName: speaker.displayName,
      })),
  });

  const snapshot = await db.meetingSnapshot.create({
    data: {
      sessionId,
      summary: generated.summary,
      discussion: generated.discussion as Prisma.InputJsonValue,
      decisions: generated.decisions as Prisma.InputJsonValue,
      actionItems: generated.actionItems as Prisma.InputJsonValue,
      rawJson: generated as Prisma.InputJsonValue,
    },
  });

  await db.meetingSession.update({
    where: { id: sessionId },
    data: {
      lastNotesGeneratedAt: new Date(),
      lastNotesChunkIndex: latestChunkIndex,
      lastError: null,
      lastErrorAt: null,
    },
  });

  return snapshot;
}

export async function maybeCreateMeetingSnapshot(
  db: DbLike,
  sessionId: string,
  options?: {
    latestChunkIndex?: number;
    force?: boolean;
  },
) {
  const session = await db.meetingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      lastProcessedAt: true,
      lastNotesGeneratedAt: true,
      lastNotesChunkIndex: true,
      utterances: {
        orderBy: [{ startMs: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          chunkIndex: true,
        },
      },
    },
  });

  if (!session) {
    throw new Error("Meeting session not found");
  }

  const latestChunkIndex = options?.latestChunkIndex
    ?? session.utterances[0]?.chunkIndex
    ?? -1;

  if (latestChunkIndex < 0) {
    return null;
  }

  if (!shouldGenerateNotes({
    force: options?.force ?? false,
    lastProcessedAt: session.lastProcessedAt,
    lastNotesGeneratedAt: session.lastNotesGeneratedAt,
  })) {
    return null;
  }

  return createMeetingSnapshot(db, sessionId, { latestChunkIndex });
}
