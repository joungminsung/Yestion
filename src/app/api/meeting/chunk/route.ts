import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { db } from "@/server/db/client";
import { getServerSession } from "@/server/auth/session";
import { getEffectivePermission } from "@/lib/permissions";
import {
  buildMeetingTranscriptionPrompt,
  buildMergedUtteranceText,
  stabilizeTranscriptSegments,
  transcribeMeetingChunk,
} from "@/lib/meeting-transcription";
import {
  buildMeetingChunkSourceKey,
  claimMeetingChunkReceipt,
  ensureMeetingSpeaker,
  failMeetingChunkReceipt,
  finalizeMeetingChunkReceipt,
  markMeetingSessionError,
  maybeCreateMeetingSnapshot,
  upsertMeetingParticipant,
} from "@/lib/meeting-service";
import { meetingEmitter } from "@/lib/meeting-emitter";

const PRIVATE_MEETING_DIR = path.join(process.cwd(), "private_uploads", "meetings");

function emitSessionUpdated(pageId: string, sessionId: string) {
  meetingEmitter.emit({
    type: "session.updated",
    pageId,
    sessionId,
    timestamp: new Date().toISOString(),
  });
}

function emitUtteranceCreated(pageId: string, sessionId: string, utteranceId: string) {
  meetingEmitter.emit({
    type: "utterance.created",
    pageId,
    sessionId,
    utteranceId,
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

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const sessionId = formData.get("sessionId");
  const chunkIndexRaw = formData.get("chunkIndex");
  const chunkStartedAtMsRaw = formData.get("chunkStartedAtMs");
  const chunkEndedAtMsRaw = formData.get("chunkEndedAtMs");
  const participantLabelRaw = formData.get("participantLabel");

  if (!(file instanceof File) || typeof sessionId !== "string" || typeof chunkIndexRaw !== "string") {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const chunkIndex = Number.parseInt(chunkIndexRaw, 10);
  const chunkStartedAtMs = typeof chunkStartedAtMsRaw === "string" ? Number.parseInt(chunkStartedAtMsRaw, 10) : chunkIndex * 5000;
  const chunkEndedAtMs = typeof chunkEndedAtMsRaw === "string" ? Number.parseInt(chunkEndedAtMsRaw, 10) : chunkStartedAtMs + 5000;

  if (!Number.isFinite(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: "Invalid chunk index" }, { status: 400 });
  }

  const meetingSession = await db.meetingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      pageId: true,
      status: true,
      mode: true,
      storeAudio: true,
      audioStoragePath: true,
      lastChunkIndex: true,
      page: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!meetingSession) {
    return NextResponse.json({ error: "Meeting session not found" }, { status: 404 });
  }

  const permission = await getEffectivePermission(db, session.user.id, meetingSession.pageId);
  if (permission !== "edit") {
    return NextResponse.json({ error: "No edit permission" }, { status: 403 });
  }

  if (meetingSession.status !== "active") {
    return NextResponse.json({ error: "Meeting session is not active" }, { status: 400 });
  }

  const participantDisplayName = typeof participantLabelRaw === "string"
    ? participantLabelRaw.trim()
    : session.user.name?.trim() || "참가자";
  const sourceKey = buildMeetingChunkSourceKey({
    mode: meetingSession.mode,
    participantLabel: meetingSession.mode === "multi_participant" ? participantDisplayName : null,
    userId: meetingSession.mode === "multi_participant" ? session.user.id : null,
  });

  if (meetingSession.mode === "multi_participant") {
    await upsertMeetingParticipant(db, {
      sessionId: meetingSession.id,
      userId: session.user.id,
      displayName: participantDisplayName,
    });
  }

  const claimedReceipt = await claimMeetingChunkReceipt(db, {
    sessionId: meetingSession.id,
    sourceKey,
    chunkIndex,
    chunkStartedAtMs,
    chunkEndedAtMs,
  });

  if (!claimedReceipt.shouldProcess) {
    return NextResponse.json({ success: true, skipped: true });
  }

  let audioStoragePath = meetingSession.audioStoragePath;
  if (meetingSession.storeAudio) {
    audioStoragePath = path.join(PRIVATE_MEETING_DIR, meetingSession.id);
    const chunkDir = path.join(audioStoragePath, sourceKey);
    await mkdir(chunkDir, { recursive: true });
    const ext = path.extname(file.name) || ".webm";
    const chunkPath = path.join(chunkDir, `${String(chunkIndex).padStart(5, "0")}${ext}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(chunkPath, buffer);
  }

  const recentUtterances = await db.meetingUtterance.findMany({
    where: { sessionId: meetingSession.id },
    orderBy: { endMs: "desc" },
    take: 6,
    select: {
      id: true,
      speakerId: true,
      speakerLabel: true,
      text: true,
      startMs: true,
      endMs: true,
      speaker: {
        select: {
          displayName: true,
        },
      },
    },
  });
  const recentTranscriptContext = [...recentUtterances].reverse().map((utterance) => ({
    id: utterance.id,
    speakerLabel: utterance.speakerLabel,
    displayName: utterance.speaker?.displayName ?? null,
    text: utterance.text,
    startMs: utterance.startMs,
    endMs: utterance.endMs,
  }));
  const transcriptionPrompt = buildMeetingTranscriptionPrompt(recentTranscriptContext);

  let segments;
  try {
    segments = await transcribeMeetingChunk({
      file,
      prompt: transcriptionPrompt,
    });
  } catch (error) {
    console.error("[meeting.chunk] transcription failed", {
      sessionId: meetingSession.id,
      chunkIndex,
      sourceKey,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      error,
    });
    await db.meetingSession.update({
      where: { id: meetingSession.id },
      data: {
        lastChunkIndex: chunkIndex,
        lastProcessedAt: new Date(),
        ...(audioStoragePath ? { audioStoragePath } : {}),
      },
    });
    await markMeetingSessionError(
      db,
      meetingSession.id,
      error instanceof Error ? error.message : "Transcription failed",
    );
    await failMeetingChunkReceipt(db, {
      sessionId: meetingSession.id,
      sourceKey,
      chunkIndex,
      error: error instanceof Error ? error.message : "Transcription failed",
    });

    emitSessionUpdated(meetingSession.pageId, meetingSession.id);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Transcription failed",
      },
      { status: 500 },
    );
  }

  const stabilizedSegments = stabilizeTranscriptSegments(
    segments,
    recentTranscriptContext,
    chunkStartedAtMs,
  );

  const createdUtterances: string[] = [];
  const normalizedParticipant = meetingSession.mode === "multi_participant"
    ? {
        label: sourceKey,
        displayName: participantDisplayName.slice(0, 120),
      }
    : null;

  await db.$transaction(async (tx) => {
    let previousUtterance = normalizedParticipant ? null : recentTranscriptContext[recentTranscriptContext.length - 1] ?? null;

    for (let index = 0; index < stabilizedSegments.length; index += 1) {
      const segment = stabilizedSegments[index]!;
      const absoluteStartMs = chunkStartedAtMs + Math.round(segment.start * 1000);
      const absoluteEndMs = chunkStartedAtMs + Math.round(segment.end * 1000);

      if (previousUtterance) {
        const mergedText = buildMergedUtteranceText(previousUtterance, segment, chunkStartedAtMs);
        if (mergedText) {
          await tx.meetingUtterance.update({
            where: { id: previousUtterance.id! },
            data: {
              text: mergedText,
              endMs: Math.max(previousUtterance.endMs, absoluteEndMs),
              rawJson: {
                mergedAt: new Date().toISOString(),
                appendedSegment: segment,
              },
            },
          });
          previousUtterance = {
            ...previousUtterance,
            text: mergedText,
            endMs: Math.max(previousUtterance.endMs, absoluteEndMs),
          };
          continue;
        }
      }

      const speaker = normalizedParticipant
        ? await ensureMeetingSpeaker(tx, meetingSession.id, normalizedParticipant.label, {
            displayName: normalizedParticipant.displayName,
            source: "participant",
          })
        : await ensureMeetingSpeaker(tx, meetingSession.id, segment.speaker);
      const utterance = await tx.meetingUtterance.create({
        data: {
          sessionId: meetingSession.id,
          speakerId: speaker.id,
          speakerLabel: speaker.label,
          text: segment.text,
          startMs: absoluteStartMs,
          endMs: absoluteEndMs,
          chunkIndex,
          rawJson: segment,
        },
      });
      createdUtterances.push(utterance.id);
      previousUtterance = {
        id: utterance.id,
        speakerLabel: speaker.label,
        displayName: speaker.displayName,
        text: segment.text,
        startMs: absoluteStartMs,
        endMs: absoluteEndMs,
      };
    }

    await tx.meetingSession.update({
      where: { id: meetingSession.id },
      data: {
        lastChunkIndex: Math.max(meetingSession.lastChunkIndex, chunkIndex),
        lastProcessedAt: new Date(),
        lastError: null,
        lastErrorAt: null,
        ...(audioStoragePath ? { audioStoragePath } : {}),
      },
    });
  });

  let snapshotId: string | null = null;
  if (createdUtterances.length > 0) {
    try {
      const snapshot = await maybeCreateMeetingSnapshot(db, meetingSession.id, {
        latestChunkIndex: Math.max(meetingSession.lastChunkIndex, chunkIndex),
      });
      snapshotId = snapshot?.id ?? null;
    } catch (error) {
      await markMeetingSessionError(
        db,
        meetingSession.id,
        error instanceof Error ? error.message : "회의록 생성에 실패했습니다",
      );
    }
  }

  await finalizeMeetingChunkReceipt(db, {
    sessionId: meetingSession.id,
    sourceKey,
    chunkIndex,
  });

  emitSessionUpdated(meetingSession.pageId, meetingSession.id);
  createdUtterances.forEach((utteranceId) => {
    emitUtteranceCreated(meetingSession.pageId, meetingSession.id, utteranceId);
  });
  if (snapshotId) {
    emitSnapshotUpdated(meetingSession.pageId, meetingSession.id, snapshotId);
  }

  return NextResponse.json({
    success: true,
    sessionId: meetingSession.id,
    chunkIndex,
    utteranceCount: createdUtterances.length,
    chunkStartedAtMs,
    chunkEndedAtMs,
  });
}
