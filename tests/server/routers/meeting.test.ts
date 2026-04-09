import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "@/server/db/client";
import { appRouter } from "@/server/trpc/router";
import { createCallerFactory } from "@/server/trpc/init";

const createCaller = createCallerFactory(appRouter);

let ownerId: string;
let viewerId: string;
let workspaceId: string;
let pageId: string;

async function setup() {
  const owner = await db.user.create({
    data: {
      email: "meeting-owner@test.com",
      name: "Meeting Owner",
      password: await bcrypt.hash("password123", 12),
    },
  });
  ownerId = owner.id;

  const viewer = await db.user.create({
    data: {
      email: "meeting-viewer@test.com",
      name: "Meeting Viewer",
      password: await bcrypt.hash("password123", 12),
    },
  });
  viewerId = viewer.id;

  const workspace = await db.workspace.create({
    data: {
      name: "Meeting Workspace",
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
      title: "회의 페이지",
      createdBy: owner.id,
      lastEditedBy: owner.id,
    },
  });
  pageId = page.id;

  await db.pagePermission.create({
    data: {
      pageId,
      userId: viewer.id,
      level: "view",
    },
  });
}

function getCaller(user: { id: string; email: string; name: string }) {
  return createCaller({
    db,
    session: {
      user,
      token: "test-token",
    },
    headers: new Headers(),
  });
}

describe("meeting router", () => {
  beforeEach(async () => {
    await db.webhookDelivery.deleteMany();
    await db.commentReaction.deleteMany();
    await db.activityLog.deleteMany();
    await db.notification.deleteMany();
    await db.pagePermission.deleteMany();
    await db.meetingChunkReceipt.deleteMany();
    await db.meetingParticipant.deleteMany();
    await db.meetingSnapshot.deleteMany();
    await db.meetingUtterance.deleteMany();
    await db.meetingSpeaker.deleteMany();
    await db.meetingSession.deleteMany();
    await db.rowTemplate.deleteMany();
    await db.row.deleteMany();
    await db.databaseView.deleteMany();
    await db.property.deleteMany();
    await db.database.deleteMany();
    await db.block.deleteMany();
    await db.favorite.deleteMany();
    await db.session.deleteMany();
    await db.page.deleteMany();
    await db.workspaceChannelAuditLog.deleteMany();
    await db.workspaceChannelReadState.deleteMany();
    await db.workspaceChannelBrowserTab.deleteMany();
    await db.workspaceChannelBrowserSession.deleteMany();
    await db.workspaceChannelVoicePresence.deleteMany();
    await db.workspaceChannelMessage.deleteMany();
    await db.workspaceChannel.deleteMany();
    await db.workspaceMember.deleteMany();
    await db.workspace.deleteMany();
    await db.user.deleteMany();
    await setup();
  });

  it("allows shared viewers to read page meeting state but not edit it", async () => {
    const viewerCaller = getCaller({
      id: viewerId,
      email: "meeting-viewer@test.com",
      name: "Meeting Viewer",
    });

    const state = await viewerCaller.meeting.getPageState({ pageId });

    expect(state.page.permission).toBe("view");
    expect(state.page.canEdit).toBe(false);
    await expect(
      viewerCaller.meeting.startSession({
        pageId,
        storeAudio: false,
        mode: "single_recorder",
      }),
    ).rejects.toThrow();
  });

  it("starts a session and prevents disabling the feature while active", async () => {
    const ownerCaller = getCaller({
      id: ownerId,
      email: "meeting-owner@test.com",
      name: "Meeting Owner",
    });

    const started = await ownerCaller.meeting.startSession({
      pageId,
      storeAudio: true,
      mode: "single_recorder",
    });

    expect(started.session?.status).toBe("active");
    expect(started.session?.storeAudio).toBe(true);
    expect(started.reusedExisting).toBe(false);

    const page = await db.page.findUnique({
      where: { id: pageId },
      select: { meetingEnabled: true },
    });

    expect(page?.meetingEnabled).toBe(true);

    await expect(
      ownerCaller.meeting.togglePageEnabled({ pageId, enabled: false }),
    ).rejects.toThrow();

    const stopped = await ownerCaller.meeting.stopSession({
      sessionId: started.session!.id,
    });
    expect(stopped.session?.status).toBe("completed");
  });

  it("reuses an active multi-participant session instead of creating a second one", async () => {
    const ownerCaller = getCaller({
      id: ownerId,
      email: "meeting-owner@test.com",
      name: "Meeting Owner",
    });

    const first = await ownerCaller.meeting.startSession({
      pageId,
      storeAudio: false,
      mode: "multi_participant",
    });
    const second = await ownerCaller.meeting.startSession({
      pageId,
      storeAudio: true,
      mode: "multi_participant",
    });

    expect(first.session?.mode).toBe("multi_participant");
    expect(second.session?.id).toBe(first.session?.id);
    expect(second.reusedExisting).toBe(true);

    const sessionCount = await db.meetingSession.count({
      where: {
        pageId,
      },
    });

    expect(sessionCount).toBe(1);
  });

  it("tracks participant join and leave state for multi-participant audio", async () => {
    const ownerCaller = getCaller({
      id: ownerId,
      email: "meeting-owner@test.com",
      name: "Meeting Owner",
    });

    const started = await ownerCaller.meeting.startSession({
      pageId,
      storeAudio: false,
      mode: "multi_participant",
    });

    const joined = await ownerCaller.meeting.joinSessionAudio({
      sessionId: started.session!.id,
      displayName: "Owner Mic",
    });

    expect(joined.session?.participants).toHaveLength(1);
    expect(joined.session?.participants[0]?.displayName).toBe("Owner Mic");
    expect(joined.session?.participants[0]?.status).toBe("active");

    const left = await ownerCaller.meeting.leaveSessionAudio({
      sessionId: started.session!.id,
    });

    expect(left.session?.participants).toHaveLength(1);
    expect(left.session?.participants[0]?.status).toBe("inactive");
    expect(left.session?.participants[0]?.leftAt).toBeTruthy();
  });

  it("marks active participants inactive when the session stops", async () => {
    const ownerCaller = getCaller({
      id: ownerId,
      email: "meeting-owner@test.com",
      name: "Meeting Owner",
    });

    const started = await ownerCaller.meeting.startSession({
      pageId,
      storeAudio: false,
      mode: "multi_participant",
    });

    await ownerCaller.meeting.joinSessionAudio({
      sessionId: started.session!.id,
      displayName: "Meeting Owner",
    });

    const stopped = await ownerCaller.meeting.stopSession({
      sessionId: started.session!.id,
    });

    expect(stopped.session?.status).toBe("completed");
    expect(stopped.session?.participants).toHaveLength(1);
    expect(stopped.session?.participants[0]?.status).toBe("inactive");
    expect(stopped.session?.participants[0]?.leftAt).toBeTruthy();
  });

  it("lists workspace databases as promotion targets", async () => {
    const ownerCaller = getCaller({
      id: ownerId,
      email: "meeting-owner@test.com",
      name: "Meeting Owner",
    });

    const databasePage = await db.page.create({
      data: {
        workspaceId,
        title: "회의 액션 대상",
        createdBy: ownerId,
        lastEditedBy: ownerId,
      },
    });

    const database = await db.database.create({
      data: {
        pageId: databasePage.id,
        properties: {
          create: {
            name: "Title",
            type: "title",
            position: 0,
          },
        },
      },
    });

    const targets = await ownerCaller.meeting.getWorkspaceTargets({ pageId });
    expect(targets.databases.some((item) => item.id === database.id)).toBe(true);
  });

  it("promotes an action item to a database row", async () => {
    const ownerCaller = getCaller({
      id: ownerId,
      email: "meeting-owner@test.com",
      name: "Meeting Owner",
    });

    const databasePage = await db.page.create({
      data: {
        workspaceId,
        title: "회의 액션 DB",
        createdBy: ownerId,
        lastEditedBy: ownerId,
      },
    });

    const database = await db.database.create({
      data: {
        pageId: databasePage.id,
        properties: {
          create: {
            name: "Title",
            type: "title",
            position: 0,
          },
        },
        views: {
          create: {
            name: "Table View",
            type: "table",
            position: 0,
          },
        },
      },
      include: {
        properties: true,
      },
    });

    const session = await db.meetingSession.create({
      data: {
        pageId,
        workspaceId,
        createdBy: ownerId,
        title: "DB 액션 회의",
        status: "completed",
        startedAt: new Date("2026-04-08T11:00:00.000Z"),
        endedAt: new Date("2026-04-08T11:05:00.000Z"),
      },
    });

    await db.meetingSnapshot.create({
      data: {
        sessionId: session.id,
        summary: "후속 데이터 정리가 필요하다.",
        discussion: [],
        decisions: [],
        actionItems: [
          {
            text: "고객 인터뷰 요약 row를 추가한다.",
            owner: "Research",
            status: "open",
            evidenceUtteranceIds: [],
          },
        ],
        rawJson: {},
      },
    });

    const result = await ownerCaller.meeting.promoteActionItem({
      sessionId: session.id,
      actionItemIndex: 0,
      targetType: "database_row",
      targetId: database.id,
    });

    expect(result.targetType).toBe("database_row");

    const row = await db.row.findUnique({
      where: { id: result.recordId },
      include: {
        page: true,
      },
    });

    expect(row?.page.title).toBe("고객 인터뷰 요약 row를 추가한다.");
    expect(row?.databaseId).toBe(database.id);
  });

  it("exports the latest meeting snapshot into top-level page blocks", async () => {
    const ownerCaller = getCaller({
      id: ownerId,
      email: "meeting-owner@test.com",
      name: "Meeting Owner",
    });

    const existingBlock = await db.block.create({
      data: {
        pageId,
        type: "paragraph",
        position: 0,
        content: {
          richText: [
            {
              text: "기존 문서",
              annotations: {},
            },
          ],
        },
      },
    });

    const session = await db.meetingSession.create({
      data: {
        pageId,
        workspaceId,
        createdBy: ownerId,
        title: "주간 회의",
        status: "completed",
        startedAt: new Date("2026-04-08T10:00:00.000Z"),
        endedAt: new Date("2026-04-08T10:10:00.000Z"),
      },
    });

    await db.meetingSnapshot.create({
      data: {
        sessionId: session.id,
        summary: "이번 주 진행 상황과 배포 일정을 정리했다.",
        discussion: ["배포 일정을 금요일로 조정할지 논의했다."],
        decisions: ["이번 배포는 금요일 오후에 진행한다."],
        actionItems: [
          {
            text: "배포 체크리스트를 업데이트한다.",
            owner: "PM",
            status: "open",
          },
        ],
        rawJson: {},
      },
    });

    const result = await ownerCaller.meeting.exportSessionToPage({
      sessionId: session.id,
    });

    expect(result.success).toBe(true);
    expect(result.createdBlockCount).toBe(11);

    const blocks = await db.block.findMany({
      where: {
        pageId,
        parentId: null,
      },
      orderBy: {
        position: "asc",
      },
    });

    expect(blocks[0]?.type).toBe("heading_2");
    expect(blocks[1]?.type).toBe("table");
    expect(blocks[2]?.type).toBe("callout");
    expect(blocks[0]?.position).toBe(0);
    expect(blocks[blocks.length - 1]?.id).toBe(existingBlock.id);
    expect(blocks[blocks.length - 1]?.position).toBeGreaterThan(0);
  });
});
