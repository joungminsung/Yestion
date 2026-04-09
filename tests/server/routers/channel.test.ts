import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "@/server/db/client";
import { workspaceChannelEmitter } from "@/lib/channel-emitter";
import { appRouter } from "@/server/trpc/router";
import { createCallerFactory } from "@/server/trpc/init";

const createCaller = createCallerFactory(appRouter);

async function setup() {
  const owner = await db.user.create({
    data: {
      email: "channel-owner@test.com",
      name: "Channel Owner",
      password: await bcrypt.hash("password123", 12),
    },
  });

  const workspace = await db.workspace.create({
    data: {
      name: "Channel Workspace",
      members: {
        create: {
          userId: owner.id,
          role: "OWNER",
        },
      },
    },
  });

  const teamspace = await db.teamspace.create({
    data: {
      workspaceId: workspace.id,
      name: "Realtime Squad",
      createdBy: owner.id,
      members: {
        create: {
          userId: owner.id,
          role: "owner",
        },
      },
    },
  });

  return {
    owner,
    workspace,
    teamspace,
  };
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

describe("channel router", () => {
  beforeEach(async () => {
    await db.workspaceChannelAuditLog.deleteMany();
    await db.workspaceChannelReadState.deleteMany();
    await db.workspaceChannelBrowserTab.deleteMany();
    await db.workspaceChannelBrowserSession.deleteMany();
    await db.workspaceChannelVoicePresence.deleteMany();
    await db.workspaceChannelMessage.deleteMany();
    await db.workspaceChannel.deleteMany();
    await db.meetingChunkReceipt.deleteMany();
    await db.meetingParticipant.deleteMany();
    await db.meetingSnapshot.deleteMany();
    await db.meetingUtterance.deleteMany();
    await db.meetingSpeaker.deleteMany();
    await db.meetingSession.deleteMany();
    await db.activityLog.deleteMany();
    await db.notification.deleteMany();
    await db.pagePermission.deleteMany();
    await db.block.deleteMany();
    await db.favorite.deleteMany();
    await db.page.deleteMany();
    await db.teamspaceMember.deleteMany();
    await db.teamspace.deleteMany();
    await db.workspaceMember.deleteMany();
    await db.workspace.deleteMany();
    await db.session.deleteMany();
    await db.user.deleteMany();
  });

  it("creates workspace and teamspace channels and lists both scopes", async () => {
    const { owner, workspace, teamspace } = await setup();
    const caller = getCaller({
      id: owner.id,
      email: owner.email,
      name: owner.name,
    });

    const general = await caller.channel.create({
      workspaceId: workspace.id,
      name: "general",
      type: "text",
    });

    const voice = await caller.channel.create({
      workspaceId: workspace.id,
      teamspaceId: teamspace.id,
      name: "squad sync",
      type: "voice",
    });

    const channels = await caller.channel.list({ workspaceId: workspace.id });

    expect(general.slug).toBe("general");
    expect(voice.type).toBe("voice");
    expect(channels).toHaveLength(2);
    expect(channels.some((channel) => channel.teamspaceId === null)).toBe(true);
    expect(channels.some((channel) => channel.teamspaceId === teamspace.id)).toBe(true);
  });

  it("stores and returns text channel messages in order", async () => {
    const { owner, workspace } = await setup();
    const caller = getCaller({
      id: owner.id,
      email: owner.email,
      name: owner.name,
    });

    const channel = await caller.channel.create({
      workspaceId: workspace.id,
      name: "research",
      type: "text",
    });

    await caller.channel.sendMessage({
      channelId: channel.id,
      content: "첫 번째 메시지",
    });
    await caller.channel.sendMessage({
      channelId: channel.id,
      content: "두 번째 메시지",
    });

    const result = await caller.channel.listMessages({
      channelId: channel.id,
      limit: 20,
    });

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]?.content).toBe("첫 번째 메시지");
    expect(result.messages[1]?.content).toBe("두 번째 메시지");
  });

  it("tracks active participants in voice rooms", async () => {
    const { owner, workspace } = await setup();
    const caller = getCaller({
      id: owner.id,
      email: owner.email,
      name: owner.name,
    });

    const channel = await caller.channel.create({
      workspaceId: workspace.id,
      name: "war room",
      type: "voice",
    });

    const joined = await caller.channel.joinVoice({
      channelId: channel.id,
      displayName: "Owner Mic",
    });

    expect(joined.activeVoiceParticipants).toHaveLength(1);
    expect(joined.activeVoiceParticipants[0]?.displayName).toBe("Owner Mic");

    await caller.channel.leaveVoice({
      channelId: channel.id,
    });

    const afterLeave = await caller.channel.get({ id: channel.id });
    expect(afterLeave.activeVoiceParticipants).toHaveLength(0);
  });

  it("emits targeted signaling events for joined voice participants", async () => {
    const { owner, workspace } = await setup();
    const caller = getCaller({
      id: owner.id,
      email: owner.email,
      name: owner.name,
    });

    const channel = await caller.channel.create({
      workspaceId: workspace.id,
      name: "call sync",
      type: "voice",
    });

    await caller.channel.joinVoice({
      channelId: channel.id,
      displayName: "Owner Mic",
    });

    const received = await new Promise<{
      fromUserId: string;
      targetUserId: string | null;
      signalType: string;
      data: unknown;
    }>((resolve) => {
      const unsubscribe = workspaceChannelEmitter.subscribe(channel.id, (event) => {
        if (event.kind !== "voice.signal") {
          return;
        }
        unsubscribe();
        resolve(event.payload);
      });

      void caller.channel.sendSignal({
        channelId: channel.id,
        targetUserId: "peer-user-id",
        signalType: "offer",
        data: { sdp: "test-sdp" },
      });
    });

    expect(received.fromUserId).toBe(owner.id);
    expect(received.targetUserId).toBe("peer-user-id");
    expect(received.signalType).toBe("offer");
    expect(received.data).toEqual({ sdp: "test-sdp" });
  });

  it("creates and updates a shared browser session for a voice room", async () => {
    const { owner, workspace } = await setup();
    const caller = getCaller({
      id: owner.id,
      email: owner.email,
      name: owner.name,
    });

    const channel = await caller.channel.create({
      workspaceId: workspace.id,
      name: "research room",
      type: "voice",
    });

    await caller.channel.joinVoice({
      channelId: channel.id,
      displayName: "Owner Mic",
    });

    await caller.channel.navigateBrowser({
      channelId: channel.id,
      url: "example.com/docs",
    });
    await caller.channel.createBrowserTab({
      channelId: channel.id,
      url: "https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API",
      title: "MDN WebRTC",
    });

    const session = await caller.channel.getBrowserSession({
      channelId: channel.id,
    });

    expect(session).not.toBeNull();
    expect(session?.tabs).toHaveLength(2);
    expect(session?.activeUrl).toBe("https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API");
    expect(session?.activeTitle).toBe("MDN WebRTC");
    expect(session?.controllerUserId).toBe(owner.id);
  });

  it("supports browser control handoff and research artifact capture", async () => {
    const { owner, workspace } = await setup();
    const collaborator = await db.user.create({
      data: {
        email: "channel-collaborator@test.com",
        name: "Channel Collaborator",
        password: await bcrypt.hash("password123", 12),
      },
    });
    await db.workspaceMember.create({
      data: {
        userId: collaborator.id,
        workspaceId: workspace.id,
        role: "MEMBER",
      },
    });

    const ownerCaller = getCaller({
      id: owner.id,
      email: owner.email,
      name: owner.name,
    });
    const collaboratorCaller = getCaller({
      id: collaborator.id,
      email: collaborator.email,
      name: collaborator.name,
    });

    const channel = await ownerCaller.channel.create({
      workspaceId: workspace.id,
      name: "co-browse room",
      type: "voice",
    });

    await ownerCaller.channel.joinVoice({
      channelId: channel.id,
      displayName: "Owner Mic",
    });
    await collaboratorCaller.channel.joinVoice({
      channelId: channel.id,
      displayName: "Collaborator Mic",
    });

    await ownerCaller.channel.navigateBrowser({
      channelId: channel.id,
      url: "https://example.com",
    });
    await collaboratorCaller.channel.requestBrowserControl({
      channelId: channel.id,
    });

    const granted = await ownerCaller.channel.grantBrowserControl({
      channelId: channel.id,
      userId: collaborator.id,
    });

    expect(granted.controllerUserId).toBe(collaborator.id);
    expect(granted.requestedControllerUserId).toBeNull();

    const artifact = await collaboratorCaller.channel.saveBrowserArtifact({
      channelId: channel.id,
      note: "경쟁사 레퍼런스 링크 저장",
      url: "docs.example.com/reference",
      title: "Reference",
    });

    expect(artifact.content).toBe("경쟁사 레퍼런스 링크 저장");
    expect((artifact.metadata as Record<string, unknown>).kind).toBe("browser-artifact");
    expect((artifact.metadata as Record<string, unknown>).url).toBe("https://docs.example.com/reference");
  });

  it("tracks unread state and resets it when a channel is marked as read", async () => {
    const { owner, workspace } = await setup();
    const collaborator = await db.user.create({
      data: {
        email: "channel-reader@test.com",
        name: "Channel Reader",
        password: await bcrypt.hash("password123", 12),
      },
    });
    await db.workspaceMember.create({
      data: {
        userId: collaborator.id,
        workspaceId: workspace.id,
        role: "MEMBER",
      },
    });

    const ownerCaller = getCaller({
      id: owner.id,
      email: owner.email,
      name: owner.name,
    });
    const collaboratorCaller = getCaller({
      id: collaborator.id,
      email: collaborator.email,
      name: collaborator.name,
    });

    const channel = await ownerCaller.channel.create({
      workspaceId: workspace.id,
      name: "updates",
      type: "text",
    });

    await ownerCaller.channel.sendMessage({
      channelId: channel.id,
      content: "새 공지입니다",
    });

    const listBeforeRead = await collaboratorCaller.channel.list({
      workspaceId: workspace.id,
    });
    expect(listBeforeRead[0]?.unreadMessageCount).toBe(1);

    await collaboratorCaller.channel.markRead({
      channelId: channel.id,
    });

    const listAfterRead = await collaboratorCaller.channel.list({
      workspaceId: workspace.id,
    });
    expect(listAfterRead[0]?.unreadMessageCount).toBe(0);
  });

  it("stores presenter state when screen sharing starts and clears it when it stops", async () => {
    const { owner, workspace } = await setup();
    const caller = getCaller({
      id: owner.id,
      email: owner.email,
      name: owner.name,
    });

    const channel = await caller.channel.create({
      workspaceId: workspace.id,
      name: "present-room",
      type: "voice",
    });

    await caller.channel.joinVoice({
      channelId: channel.id,
      displayName: "Owner Mic",
    });

    const started = await caller.channel.setScreenShareState({
      channelId: channel.id,
      isSharing: true,
      resolutionLabel: "3840x2160",
    });
    expect(started.roomState.screenShare.activePresenterUserId).toBe(owner.id);
    expect(started.roomState.screenShare.resolutionLabel).toBe("3840x2160");

    const stopped = await caller.channel.setScreenShareState({
      channelId: channel.id,
      isSharing: false,
    });
    expect(stopped.roomState.screenShare.activePresenterUserId).toBeNull();
  });
});
