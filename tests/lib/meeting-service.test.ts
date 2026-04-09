import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "@/server/db/client";
import {
  buildMeetingChunkSourceKey,
  claimMeetingChunkReceipt,
  failMeetingChunkReceipt,
  finalizeMeetingChunkReceipt,
  markStaleMeetingParticipantsInactive,
} from "@/lib/meeting-service";

let ownerId: string;
let workspaceId: string;
let pageId: string;
let sessionId: string;

async function setup() {
  const owner = await db.user.create({
    data: {
      email: "meeting-service@test.com",
      name: "Meeting Service",
      password: await bcrypt.hash("password123", 12),
    },
  });
  ownerId = owner.id;

  const workspace = await db.workspace.create({
    data: {
      name: "Meeting Service Workspace",
      members: {
        create: {
          userId: owner.id,
          role: "OWNER",
        },
      },
    },
  });
  workspaceId = workspace.id;

  const page = await db.page.create({
    data: {
      workspaceId,
      title: "회의 서비스 페이지",
      createdBy: owner.id,
      lastEditedBy: owner.id,
      meetingEnabled: true,
    },
  });
  pageId = page.id;

  const session = await db.meetingSession.create({
    data: {
      pageId,
      workspaceId,
      createdBy: owner.id,
      title: "서비스 테스트 회의",
      mode: "multi_participant",
    },
  });
  sessionId = session.id;
}

describe("meeting-service", () => {
  beforeEach(async () => {
    await db.activityLog.deleteMany();
    await db.notification.deleteMany();
    await db.pagePermission.deleteMany();
    await db.meetingChunkReceipt.deleteMany();
    await db.meetingParticipant.deleteMany();
    await db.meetingSnapshot.deleteMany();
    await db.meetingUtterance.deleteMany();
    await db.meetingSpeaker.deleteMany();
    await db.meetingSession.deleteMany();
    await db.workspaceChannelAuditLog.deleteMany();
    await db.workspaceChannelReadState.deleteMany();
    await db.workspaceChannelBrowserTab.deleteMany();
    await db.workspaceChannelBrowserSession.deleteMany();
    await db.workspaceChannelVoicePresence.deleteMany();
    await db.workspaceChannelMessage.deleteMany();
    await db.workspaceChannel.deleteMany();
    await db.block.deleteMany();
    await db.favorite.deleteMany();
    await db.session.deleteMany();
    await db.page.deleteMany();
    await db.workspaceMember.deleteMany();
    await db.workspace.deleteMany();
    await db.user.deleteMany();
    await setup();
  });

  it("builds stable source keys for multi participant mode", () => {
    expect(buildMeetingChunkSourceKey({
      mode: "multi_participant",
      participantLabel: "Alice Kim",
    })).toBe("participant_alice_kim");

    expect(buildMeetingChunkSourceKey({
      mode: "single_recorder",
      participantLabel: "ignored",
    })).toBe("single_recorder");
  });

  it("skips already processed chunk receipts from the same source", async () => {
    const sourceKey = buildMeetingChunkSourceKey({
      mode: "multi_participant",
      participantLabel: "Alice Kim",
    });

    const first = await claimMeetingChunkReceipt(db as any, {
      sessionId,
      sourceKey,
      chunkIndex: 3,
      chunkStartedAtMs: 15_000,
      chunkEndedAtMs: 20_000,
    });
    expect(first.shouldProcess).toBe(true);

    await finalizeMeetingChunkReceipt(db as any, {
      sessionId,
      sourceKey,
      chunkIndex: 3,
    });

    const second = await claimMeetingChunkReceipt(db as any, {
      sessionId,
      sourceKey,
      chunkIndex: 3,
      chunkStartedAtMs: 15_000,
      chunkEndedAtMs: 20_000,
    });
    expect(second.shouldProcess).toBe(false);

    const otherSource = await claimMeetingChunkReceipt(db as any, {
      sessionId,
      sourceKey: buildMeetingChunkSourceKey({
        mode: "multi_participant",
        participantLabel: "Bob Lee",
      }),
      chunkIndex: 3,
      chunkStartedAtMs: 15_000,
      chunkEndedAtMs: 20_000,
    });
    expect(otherSource.shouldProcess).toBe(true);
  });

  it("allows retrying a failed chunk receipt", async () => {
    const sourceKey = buildMeetingChunkSourceKey({
      mode: "multi_participant",
      participantLabel: "Retry User",
    });

    await claimMeetingChunkReceipt(db as any, {
      sessionId,
      sourceKey,
      chunkIndex: 4,
      chunkStartedAtMs: 20_000,
      chunkEndedAtMs: 25_000,
    });

    await failMeetingChunkReceipt(db as any, {
      sessionId,
      sourceKey,
      chunkIndex: 4,
      error: "temporary failure",
    });

    const retried = await claimMeetingChunkReceipt(db as any, {
      sessionId,
      sourceKey,
      chunkIndex: 4,
      chunkStartedAtMs: 20_000,
      chunkEndedAtMs: 25_000,
    });

    expect(retried.shouldProcess).toBe(true);
  });

  it("marks stale meeting participants inactive", async () => {
    await db.meetingParticipant.create({
      data: {
        sessionId,
        userId: ownerId,
        displayName: "Meeting Service",
        status: "active",
        lastSeenAt: new Date(Date.now() - 60_000),
      },
    });

    const changedCount = await markStaleMeetingParticipantsInactive(db as any, {
      sessionId,
      staleMs: 10_000,
    });

    expect(changedCount).toBe(1);

    const participant = await db.meetingParticipant.findFirst({
      where: { sessionId, userId: ownerId },
    });

    expect(participant?.status).toBe("inactive");
    expect(participant?.leftAt).toBeTruthy();
  });
});
