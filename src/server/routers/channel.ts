import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { recordChannelAuditEvent } from "@/lib/channel-audit";
import { workspaceChannelEmitter } from "@/lib/channel-emitter";
import { enforceChannelRateLimit } from "@/lib/channel-rate-limit";
import { getCollaborationFlags } from "@/lib/collaboration-flags";
import {
  requireWorkspaceMembership,
  requireWorkspacePermission,
} from "@/lib/permissions";
import { getSerializedIceServers } from "@/lib/webrtc";
import { router, protectedProcedure, type Context } from "@/server/trpc/init";

const CHANNEL_SLUG_LIMIT = 48;
const VOICE_PRESENCE_STALE_MS = 25_000;
const BROWSER_URL_LIMIT = 2_048;
const BROWSER_TAB_TITLE_LIMIT = 160;
const BROWSER_ARTIFACT_NOTE_LIMIT = 1_000;
const MESSAGE_RATE_LIMIT = { limit: 12, windowMs: 15_000 };
const VOICE_JOIN_RATE_LIMIT = { limit: 8, windowMs: 30_000 };
const CONTROL_REQUEST_RATE_LIMIT = { limit: 6, windowMs: 60_000 };

type DbContext = Context["db"];
type BrowserDbContext = Context["db"] | Prisma.TransactionClient;

function slugifyChannelName(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return (normalized || "channel").slice(0, CHANNEL_SLUG_LIMIT);
}

async function resolveUniqueChannelSlug(
  db: DbContext,
  workspaceId: string,
  name: string,
) {
  const baseSlug = slugifyChannelName(name);

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const slug = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
    const existing = await db.workspaceChannel.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId,
          slug,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }
  }

  throw new TRPCError({
    code: "CONFLICT",
    message: "Unable to create a unique channel slug",
  });
}

async function verifyTeamspaceAccess(
  db: DbContext,
  userId: string,
  teamspaceId: string,
) {
  const teamspace = await db.teamspace.findUnique({
    where: { id: teamspaceId },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      members: {
        where: { userId },
        select: { id: true },
      },
    },
  });

  if (!teamspace) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Teamspace not found" });
  }

  if (teamspace.members.length === 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No access to this teamspace" });
  }

  return teamspace;
}

async function verifyChannelAccess(
  db: DbContext,
  userId: string,
  channelId: string,
) {
  const channel = await db.workspaceChannel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      workspaceId: true,
      teamspaceId: true,
      createdBy: true,
      name: true,
      slug: true,
      type: true,
      description: true,
      topic: true,
      icon: true,
      metadata: true,
      teamspace: {
        select: {
          id: true,
          name: true,
          icon: true,
        },
      },
    },
  });

  if (!channel) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found" });
  }

  await requireWorkspaceMembership(db, userId, channel.workspaceId);
  if (channel.teamspaceId) {
    await verifyTeamspaceAccess(db, userId, channel.teamspaceId);
  }

  return channel;
}

async function verifyVoiceChannelAccess(
  db: DbContext,
  userId: string,
  channelId: string,
) {
  const channel = await verifyChannelAccess(db, userId, channelId);
  if (channel.type !== "voice") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This channel is not a voice room" });
  }

  return channel;
}

function requireChannelFeature(feature: keyof ReturnType<typeof getCollaborationFlags>) {
  const flags = getCollaborationFlags();
  if (flags[feature]) {
    return flags;
  }

  const messageByFeature: Record<keyof ReturnType<typeof getCollaborationFlags>, string> = {
    channelsEnabled: "Channels are currently disabled",
    voiceEnabled: "Voice rooms are currently disabled",
    screenShareEnabled: "Screen sharing is currently disabled",
    cobrowseEnabled: "Shared browsing is currently disabled",
  };

  throw new TRPCError({
    code: "FORBIDDEN",
    message: messageByFeature[feature],
  });
}

function getChannelMetadata(metadata: Prisma.JsonValue | null | undefined) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {} as Record<string, unknown>;
  }

  return metadata as Record<string, unknown>;
}

function getScreenShareState(metadata: Prisma.JsonValue | null | undefined) {
  const channelMetadata = getChannelMetadata(metadata);
  const screenShare =
    channelMetadata.screenShare &&
    typeof channelMetadata.screenShare === "object" &&
    !Array.isArray(channelMetadata.screenShare)
      ? (channelMetadata.screenShare as Record<string, unknown>)
      : null;

  return {
    activePresenterUserId:
      typeof screenShare?.activePresenterUserId === "string"
        ? screenShare.activePresenterUserId
        : null,
    resolutionLabel:
      typeof screenShare?.resolutionLabel === "string" ? screenShare.resolutionLabel : null,
    startedAt: typeof screenShare?.startedAt === "string" ? screenShare.startedAt : null,
    endedAt: typeof screenShare?.endedAt === "string" ? screenShare.endedAt : null,
    updatedAt: typeof screenShare?.updatedAt === "string" ? screenShare.updatedAt : null,
    lastPresenterUserId:
      typeof screenShare?.lastPresenterUserId === "string"
        ? screenShare.lastPresenterUserId
        : null,
  };
}

function mergeChannelMetadata(
  metadata: Prisma.JsonValue | null | undefined,
  patch: Record<string, unknown>,
) : Prisma.InputJsonValue {
  return {
    ...getChannelMetadata(metadata),
    ...patch,
  } as Prisma.InputJsonValue;
}

function getRoomHostUserId(
  participants: Array<{ userId: string; joinedAt: Date }>,
  fallbackUserId: string,
) {
  return participants[0]?.userId ?? fallbackUserId;
}

function serializeVoiceRoomState(input: {
  channel: { createdBy: string; metadata: Prisma.JsonValue };
  participants: Array<{ userId: string; joinedAt: Date }>;
}) {
  const hostUserId = getRoomHostUserId(input.participants, input.channel.createdBy);
  const screenShare = getScreenShareState(input.channel.metadata);

  return {
    hostUserId,
    screenShare,
  };
}

async function getUnreadStateByChannel(
  db: DbContext,
  userId: string,
  channelIds: string[],
) {
  if (channelIds.length === 0) {
    return new Map<string, {
      unreadMessageCount: number;
      lastReadAt: Date | null;
      lastReadMessageId: string | null;
    }>();
  }

  const readStates = await db.workspaceChannelReadState.findMany({
    where: {
      userId,
      channelId: { in: channelIds },
    },
  });
  const readStateMap = new Map(
    readStates.map((state) => [
      state.channelId,
      {
        lastReadAt: state.lastReadAt,
        lastReadMessageId: state.lastReadMessageId,
      },
    ]),
  );

  const result = new Map<
    string,
    {
      unreadMessageCount: number;
      lastReadAt: Date | null;
      lastReadMessageId: string | null;
    }
  >();

  await Promise.all(
    channelIds.map(async (channelId) => {
      const readState = readStateMap.get(channelId);
      const unreadMessageCount = await db.workspaceChannelMessage.count({
        where: {
          channelId,
          userId: { not: userId },
          ...(readState?.lastReadAt
            ? {
                createdAt: {
                  gt: readState.lastReadAt,
                },
              }
            : {}),
        },
      });

      result.set(channelId, {
        unreadMessageCount,
        lastReadAt: readState?.lastReadAt ?? null,
        lastReadMessageId: readState?.lastReadMessageId ?? null,
      });
    }),
  );

  return result;
}

async function verifyActiveVoicePresence(
  db: DbContext,
  userId: string,
  channelId: string,
) {
  const presence = await db.workspaceChannelVoicePresence.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
  });

  if (!presence || presence.status !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Join the voice room before controlling shared browsing",
    });
  }

  return presence;
}

function normalizeBrowserUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "URL is required" });
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid URL" });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only http and https URLs can be shared",
    });
  }

  return {
    url: parsed.toString(),
    domain: parsed.hostname.replace(/^www\./, "") || null,
  };
}

function getBrowserTabTitle(input: {
  title?: string | null;
  normalizedUrl: string;
  domain: string | null;
}) {
  const fallback = input.domain || input.normalizedUrl;
  return (input.title?.trim() || fallback).slice(0, BROWSER_TAB_TITLE_LIMIT);
}

async function getBrowserSessionRecord(
  db: BrowserDbContext,
  channelId: string,
) {
  return db.workspaceChannelBrowserSession.findUnique({
    where: { channelId },
    include: {
      tabs: {
        orderBy: { position: "asc" },
      },
    },
  });
}

type BrowserSessionRecord = NonNullable<
  Awaited<ReturnType<typeof getBrowserSessionRecord>>
>;

async function getOrCreateBrowserSession(
  db: BrowserDbContext,
  channelId: string,
  userId: string,
) {
  await db.workspaceChannelBrowserSession.upsert({
    where: { channelId },
    update: {},
    create: {
      channelId,
      ownerUserId: userId,
      controllerUserId: userId,
    },
  });

  const session = await getBrowserSessionRecord(db, channelId);
  if (!session) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to create shared browser session",
    });
  }

  return session;
}

async function serializeBrowserSession(
  db: BrowserDbContext,
  session: BrowserSessionRecord,
) {
  const userIds = Array.from(
    new Set(
      [
        session.ownerUserId,
        session.controllerUserId,
        session.requestedControllerUserId,
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      })
    : [];
  const userMap = new Map(users.map((user) => [user.id, user]));

  return {
    id: session.id,
    channelId: session.channelId,
    ownerUserId: session.ownerUserId,
    controllerUserId: session.controllerUserId,
    requestedControllerUserId: session.requestedControllerUserId,
    activeUrl: session.activeUrl,
    activeTitle: session.activeTitle,
    activeDomain: session.activeDomain,
    lastNavigatedAt: session.lastNavigatedAt,
    lastControlRequestedAt: session.lastControlRequestedAt,
    lastControlGrantedAt: session.lastControlGrantedAt,
    metadata: (session.metadata ?? {}) as Record<string, unknown>,
    owner:
      userMap.get(session.ownerUserId) ?? {
        id: session.ownerUserId,
        name: "Unknown",
        avatarUrl: null,
      },
    controller:
      userMap.get(session.controllerUserId) ?? {
        id: session.controllerUserId,
        name: "Unknown",
        avatarUrl: null,
      },
    requestedController: session.requestedControllerUserId
      ? userMap.get(session.requestedControllerUserId) ?? {
          id: session.requestedControllerUserId,
          name: "Unknown",
          avatarUrl: null,
        }
      : null,
    tabs: session.tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
      domain: tab.domain,
      position: tab.position,
      isActive: tab.isActive,
      createdByUserId: tab.createdByUserId,
      createdAt: tab.createdAt,
      updatedAt: tab.updatedAt,
    })),
  };
}

async function markStaleVoicePresencesInactive(
  db: DbContext,
  channelId: string,
) {
  const threshold = new Date(Date.now() - VOICE_PRESENCE_STALE_MS);

  await db.workspaceChannelVoicePresence.updateMany({
    where: {
      channelId,
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
}

async function getActiveVoiceParticipants(
  db: DbContext,
  channelId: string,
) {
  await markStaleVoicePresencesInactive(db, channelId);

  return db.workspaceChannelVoicePresence.findMany({
    where: {
      channelId,
      status: "active",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
}

function emitMessageEvent(message: {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  type: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  user: { id: string; name: string; avatarUrl: string | null };
}) {
  workspaceChannelEmitter.emit({
    kind: "message.created",
    channelId: message.channelId,
    payload: {
      id: message.id,
      channelId: message.channelId,
      userId: message.userId,
      content: message.content,
      type: message.type,
      metadata: (message.metadata ?? {}) as Record<string, unknown>,
      createdAt: message.createdAt.toISOString(),
      user: message.user,
    },
  });
}

async function emitVoicePresenceUpdated(
  db: DbContext,
  channelId: string,
) {
  const participants = await getActiveVoiceParticipants(db, channelId);
  workspaceChannelEmitter.emit({
    kind: "voice.presence.updated",
    channelId,
    payload: {
      channelId,
      activeParticipantCount: participants.length,
    },
  });
}

function emitVoiceSignal(params: {
  channelId: string;
  fromUserId: string;
  targetUserId: string | null;
  signalType: "offer" | "answer" | "ice-candidate" | "peer-left";
  data: unknown;
}) {
  workspaceChannelEmitter.emit({
    kind: "voice.signal",
    channelId: params.channelId,
    payload: {
      channelId: params.channelId,
      fromUserId: params.fromUserId,
      targetUserId: params.targetUserId,
      signalType: params.signalType,
      data: params.data,
      timestamp: new Date().toISOString(),
    },
  });
}

function emitBrowserSessionUpdated(channelId: string) {
  workspaceChannelEmitter.emit({
    kind: "browser.session.updated",
    channelId,
    payload: {
      channelId,
      updatedAt: new Date().toISOString(),
    },
  });
}

export const channelRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const flags = getCollaborationFlags();
      if (!flags.channelsEnabled) {
        return [];
      }

      await requireWorkspaceMembership(ctx.db, ctx.session.user.id, input.workspaceId);

      const channels = await ctx.db.workspaceChannel.findMany({
        where: {
          workspaceId: input.workspaceId,
          OR: [
            { teamspaceId: null },
            {
              teamspace: {
                members: {
                  some: { userId: ctx.session.user.id },
                },
              },
            },
          ],
        },
        include: {
          teamspace: {
            select: {
              id: true,
              name: true,
              icon: true,
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { id: true, createdAt: true },
          },
          voicePresences: {
            where: { status: "active" },
            select: { id: true },
          },
        },
        orderBy: [
          { teamspaceId: "asc" },
          { position: "asc" },
          { createdAt: "asc" },
        ],
      });

      const unreadByChannel = await getUnreadStateByChannel(
        ctx.db,
        ctx.session.user.id,
        channels.map((channel) => channel.id),
      );

      return channels.map((channel) => ({
        id: channel.id,
        workspaceId: channel.workspaceId,
        teamspaceId: channel.teamspaceId,
        name: channel.name,
        slug: channel.slug,
        description: channel.description,
        icon: channel.icon,
        type: channel.type,
        topic: channel.topic,
        position: channel.position,
        isDefault: channel.isDefault,
        metadata: channel.metadata,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
        teamspace: channel.teamspace,
        activeVoiceParticipantCount: channel.voicePresences.length,
        lastMessageAt: channel.messages[0]?.createdAt ?? null,
        unreadMessageCount: unreadByChannel.get(channel.id)?.unreadMessageCount ?? 0,
        lastReadAt: unreadByChannel.get(channel.id)?.lastReadAt ?? null,
        lastReadMessageId: unreadByChannel.get(channel.id)?.lastReadMessageId ?? null,
      }));
    }),

  getCapabilities: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireWorkspaceMembership(ctx.db, ctx.session.user.id, input.workspaceId);
      return getCollaborationFlags();
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      requireChannelFeature("channelsEnabled");
      const channel = await verifyChannelAccess(ctx.db, ctx.session.user.id, input.id);
      const activeVoiceParticipants = await getActiveVoiceParticipants(ctx.db, input.id);
      const unreadByChannel = await getUnreadStateByChannel(ctx.db, ctx.session.user.id, [input.id]);

      return {
        ...channel,
        metadata: channel.metadata as Record<string, unknown>,
        roomState: serializeVoiceRoomState({
          channel,
          participants: activeVoiceParticipants,
        }),
        unreadMessageCount: unreadByChannel.get(input.id)?.unreadMessageCount ?? 0,
        lastReadAt: unreadByChannel.get(input.id)?.lastReadAt ?? null,
        lastReadMessageId: unreadByChannel.get(input.id)?.lastReadMessageId ?? null,
        activeVoiceParticipants: activeVoiceParticipants.map((participant) => ({
          id: participant.id,
          userId: participant.userId,
          displayName: participant.displayName,
          status: participant.status,
          joinedAt: participant.joinedAt,
          lastSeenAt: participant.lastSeenAt,
          leftAt: participant.leftAt,
          user: participant.user,
        })),
      };
    }),

  getVoiceConfig: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .query(async ({ ctx, input }) => {
      requireChannelFeature("voiceEnabled");
      await verifyVoiceChannelAccess(ctx.db, ctx.session.user.id, input.channelId);

      return {
        channelId: input.channelId,
        topology: "mesh" as const,
        maxRecommendedParticipants: 4,
        iceServers: getSerializedIceServers(),
      };
    }),

  getBrowserSession: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .query(async ({ ctx, input }) => {
      requireChannelFeature("cobrowseEnabled");
      await verifyVoiceChannelAccess(ctx.db, ctx.session.user.id, input.channelId);

      const session = await getBrowserSessionRecord(ctx.db, input.channelId);
      if (!session) {
        return null;
      }

      return serializeBrowserSession(ctx.db, session);
    }),

  navigateBrowser: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        url: z.string().min(1).max(BROWSER_URL_LIMIT),
        title: z.string().max(BROWSER_TAB_TITLE_LIMIT).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("cobrowseEnabled");
      await verifyVoiceChannelAccess(ctx.db, ctx.session.user.id, input.channelId);
      await verifyActiveVoicePresence(ctx.db, ctx.session.user.id, input.channelId);

      const normalized = normalizeBrowserUrl(input.url);
      const browserSession = await ctx.db.$transaction(async (tx) => {
        const session = await getOrCreateBrowserSession(tx, input.channelId, ctx.session.user.id);
        if (session.controllerUserId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the current browser controller can navigate",
          });
        }

        const title = getBrowserTabTitle({
          title: input.title,
          normalizedUrl: normalized.url,
          domain: normalized.domain,
        });
        const activeTab = session.tabs.find((tab) => tab.isActive) ?? session.tabs[0] ?? null;

        if (activeTab) {
          await tx.workspaceChannelBrowserTab.update({
            where: { id: activeTab.id },
            data: {
              title,
              url: normalized.url,
              domain: normalized.domain,
              isActive: true,
            },
          });
        } else {
          await tx.workspaceChannelBrowserTab.create({
            data: {
              sessionId: session.id,
              createdByUserId: ctx.session.user.id,
              title,
              url: normalized.url,
              domain: normalized.domain,
              position: 0,
              isActive: true,
            },
          });
        }

        await tx.workspaceChannelBrowserSession.update({
          where: { id: session.id },
          data: {
            activeUrl: normalized.url,
            activeTitle: title,
            activeDomain: normalized.domain,
            lastNavigatedAt: new Date(),
          },
        });

        const nextSession = await getBrowserSessionRecord(tx, input.channelId);
        if (!nextSession) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to update shared browser session",
          });
        }

        return serializeBrowserSession(tx, nextSession);
      });

      emitBrowserSessionUpdated(input.channelId);
      const channel = await verifyChannelAccess(ctx.db, ctx.session.user.id, input.channelId);
      await recordChannelAuditEvent(ctx.db, {
        workspaceId: channel.workspaceId,
        channelId: input.channelId,
        userId: ctx.session.user.id,
        action: "browser.navigated",
        metadata: {
          url: normalized.url,
          title: input.title?.trim() || null,
        },
      });
      return browserSession;
    }),

  createBrowserTab: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        url: z.string().min(1).max(BROWSER_URL_LIMIT),
        title: z.string().max(BROWSER_TAB_TITLE_LIMIT).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("cobrowseEnabled");
      await verifyVoiceChannelAccess(ctx.db, ctx.session.user.id, input.channelId);
      await verifyActiveVoicePresence(ctx.db, ctx.session.user.id, input.channelId);

      const normalized = normalizeBrowserUrl(input.url);
      const browserSession = await ctx.db.$transaction(async (tx) => {
        const session = await getOrCreateBrowserSession(tx, input.channelId, ctx.session.user.id);
        if (session.controllerUserId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the current browser controller can open tabs",
          });
        }

        const title = getBrowserTabTitle({
          title: input.title,
          normalizedUrl: normalized.url,
          domain: normalized.domain,
        });

        await tx.workspaceChannelBrowserTab.updateMany({
          where: { sessionId: session.id },
          data: { isActive: false },
        });

        await tx.workspaceChannelBrowserTab.create({
          data: {
            sessionId: session.id,
            createdByUserId: ctx.session.user.id,
            title,
            url: normalized.url,
            domain: normalized.domain,
            position: session.tabs.length,
            isActive: true,
          },
        });

        await tx.workspaceChannelBrowserSession.update({
          where: { id: session.id },
          data: {
            activeUrl: normalized.url,
            activeTitle: title,
            activeDomain: normalized.domain,
            lastNavigatedAt: new Date(),
          },
        });

        const nextSession = await getBrowserSessionRecord(tx, input.channelId);
        if (!nextSession) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to create a browser tab",
          });
        }

        return serializeBrowserSession(tx, nextSession);
      });

      emitBrowserSessionUpdated(input.channelId);
      const channel = await verifyChannelAccess(ctx.db, ctx.session.user.id, input.channelId);
      await recordChannelAuditEvent(ctx.db, {
        workspaceId: channel.workspaceId,
        channelId: input.channelId,
        userId: ctx.session.user.id,
        action: "browser.tab_created",
        metadata: {
          url: normalized.url,
          title: input.title?.trim() || null,
        },
      });
      return browserSession;
    }),

  activateBrowserTab: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        tabId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("cobrowseEnabled");
      await verifyVoiceChannelAccess(ctx.db, ctx.session.user.id, input.channelId);
      await verifyActiveVoicePresence(ctx.db, ctx.session.user.id, input.channelId);

      const browserSession = await ctx.db.$transaction(async (tx) => {
        const session = await getOrCreateBrowserSession(tx, input.channelId, ctx.session.user.id);
        if (session.controllerUserId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the current browser controller can switch tabs",
          });
        }

        const targetTab = session.tabs.find((tab) => tab.id === input.tabId);
        if (!targetTab) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Browser tab not found" });
        }

        await tx.workspaceChannelBrowserTab.updateMany({
          where: { sessionId: session.id },
          data: { isActive: false },
        });
        await tx.workspaceChannelBrowserTab.update({
          where: { id: targetTab.id },
          data: { isActive: true },
        });
        await tx.workspaceChannelBrowserSession.update({
          where: { id: session.id },
          data: {
            activeUrl: targetTab.url,
            activeTitle: targetTab.title,
            activeDomain: targetTab.domain,
            lastNavigatedAt: new Date(),
          },
        });

        const nextSession = await getBrowserSessionRecord(tx, input.channelId);
        if (!nextSession) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to activate browser tab",
          });
        }

        return serializeBrowserSession(tx, nextSession);
      });

      emitBrowserSessionUpdated(input.channelId);
      const channel = await verifyChannelAccess(ctx.db, ctx.session.user.id, input.channelId);
      await recordChannelAuditEvent(ctx.db, {
        workspaceId: channel.workspaceId,
        channelId: input.channelId,
        userId: ctx.session.user.id,
        action: "browser.tab_activated",
        metadata: {
          tabId: input.tabId,
        },
      });
      return browserSession;
    }),

  closeBrowserTab: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        tabId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("cobrowseEnabled");
      await verifyVoiceChannelAccess(ctx.db, ctx.session.user.id, input.channelId);
      await verifyActiveVoicePresence(ctx.db, ctx.session.user.id, input.channelId);

      const browserSession = await ctx.db.$transaction(async (tx) => {
        const session = await getOrCreateBrowserSession(tx, input.channelId, ctx.session.user.id);
        if (session.controllerUserId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the current browser controller can close tabs",
          });
        }

        const targetTab = session.tabs.find((tab) => tab.id === input.tabId);
        if (!targetTab) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Browser tab not found" });
        }

        await tx.workspaceChannelBrowserTab.delete({
          where: { id: targetTab.id },
        });

        const remainingTabs = session.tabs.filter((tab) => tab.id !== input.tabId);
        let nextActiveTab = remainingTabs.find((tab) => tab.isActive) ?? null;
        if (!nextActiveTab || nextActiveTab.id === targetTab.id) {
          nextActiveTab =
            remainingTabs[Math.max(0, targetTab.position - 1)] ??
            remainingTabs[0] ??
            null;
        }

        for (let index = 0; index < remainingTabs.length; index += 1) {
          const tab = remainingTabs[index]!;
          await tx.workspaceChannelBrowserTab.update({
            where: { id: tab.id },
            data: {
              position: index,
              isActive: nextActiveTab?.id === tab.id,
            },
          });
        }

        await tx.workspaceChannelBrowserSession.update({
          where: { id: session.id },
          data: {
            activeUrl: nextActiveTab?.url ?? null,
            activeTitle: nextActiveTab?.title ?? null,
            activeDomain: nextActiveTab?.domain ?? null,
            lastNavigatedAt: new Date(),
          },
        });

        const nextSession = await getBrowserSessionRecord(tx, input.channelId);
        if (!nextSession) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to close browser tab",
          });
        }

        return serializeBrowserSession(tx, nextSession);
      });

      emitBrowserSessionUpdated(input.channelId);
      const channel = await verifyChannelAccess(ctx.db, ctx.session.user.id, input.channelId);
      await recordChannelAuditEvent(ctx.db, {
        workspaceId: channel.workspaceId,
        channelId: input.channelId,
        userId: ctx.session.user.id,
        action: "browser.tab_closed",
        metadata: {
          tabId: input.tabId,
        },
      });
      return browserSession;
    }),

  requestBrowserControl: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("cobrowseEnabled");
      const channel = await verifyVoiceChannelAccess(ctx.db, ctx.session.user.id, input.channelId);
      await verifyActiveVoicePresence(ctx.db, ctx.session.user.id, input.channelId);
      enforceChannelRateLimit({
        scope: "browser-control-request",
        workspaceId: channel.workspaceId,
        userId: ctx.session.user.id,
        limit: CONTROL_REQUEST_RATE_LIMIT.limit,
        windowMs: CONTROL_REQUEST_RATE_LIMIT.windowMs,
        message: "You are requesting browser control too quickly. Please wait a moment.",
      });

      const browserSession = await ctx.db.$transaction(async (tx) => {
        const session = await getOrCreateBrowserSession(tx, input.channelId, ctx.session.user.id);
        if (session.controllerUserId === ctx.session.user.id) {
          return serializeBrowserSession(tx, session);
        }

        await tx.workspaceChannelBrowserSession.update({
          where: { id: session.id },
          data: {
            requestedControllerUserId: ctx.session.user.id,
            lastControlRequestedAt: new Date(),
          },
        });

        const nextSession = await getBrowserSessionRecord(tx, input.channelId);
        if (!nextSession) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to request browser control",
          });
        }

        return serializeBrowserSession(tx, nextSession);
      });

      emitBrowserSessionUpdated(input.channelId);
      if (browserSession.controllerUserId !== ctx.session.user.id) {
        await ctx.db.notification.create({
          data: {
            userId: browserSession.controllerUserId,
            type: "mention",
            title: "브라우저 제어권 요청",
            message: `${ctx.session.user.name}님이 ${channel.name} 채널에서 브라우저 제어권을 요청했습니다.`,
          },
        });
      }
      await recordChannelAuditEvent(ctx.db, {
        workspaceId: channel.workspaceId,
        channelId: input.channelId,
        userId: ctx.session.user.id,
        action: "browser.control_requested",
      });
      return browserSession;
    }),

  grantBrowserControl: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("cobrowseEnabled");
      const channel = await verifyVoiceChannelAccess(ctx.db, ctx.session.user.id, input.channelId);
      await verifyActiveVoicePresence(ctx.db, ctx.session.user.id, input.channelId);
      await verifyActiveVoicePresence(ctx.db, input.userId, input.channelId);

      const browserSession = await ctx.db.$transaction(async (tx) => {
        const session = await getOrCreateBrowserSession(tx, input.channelId, ctx.session.user.id);
        if (
          session.controllerUserId !== ctx.session.user.id &&
          session.ownerUserId !== ctx.session.user.id
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the current browser controller can grant control",
          });
        }

        await tx.workspaceChannelBrowserSession.update({
          where: { id: session.id },
          data: {
            controllerUserId: input.userId,
            requestedControllerUserId: null,
            lastControlGrantedAt: new Date(),
          },
        });

        const nextSession = await getBrowserSessionRecord(tx, input.channelId);
        if (!nextSession) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to grant browser control",
          });
        }

        return serializeBrowserSession(tx, nextSession);
      });

      emitBrowserSessionUpdated(input.channelId);
      if (input.userId !== ctx.session.user.id) {
        await ctx.db.notification.create({
          data: {
            userId: input.userId,
            type: "mention",
            title: "브라우저 제어권 양도",
            message: `${ctx.session.user.name}님이 ${channel.name} 채널의 브라우저 제어권을 넘겼습니다.`,
          },
        });
      }
      await recordChannelAuditEvent(ctx.db, {
        workspaceId: channel.workspaceId,
        channelId: input.channelId,
        userId: ctx.session.user.id,
        action: "browser.control_granted",
        metadata: {
          grantedToUserId: input.userId,
        },
      });
      return browserSession;
    }),

  saveBrowserArtifact: protectedProcedure
    .input(
      z
        .object({
          channelId: z.string(),
          note: z.string().max(BROWSER_ARTIFACT_NOTE_LIMIT).optional(),
          url: z.string().max(BROWSER_URL_LIMIT).optional(),
          title: z.string().max(BROWSER_TAB_TITLE_LIMIT).optional(),
        })
        .refine((value) => Boolean(value.note?.trim() || value.url?.trim()), {
          message: "Add a note or a URL to save a research artifact",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("cobrowseEnabled");
      const channel = await verifyVoiceChannelAccess(ctx.db, ctx.session.user.id, input.channelId);
      await verifyActiveVoicePresence(ctx.db, ctx.session.user.id, input.channelId);

      const note = input.note?.trim() || null;
      const normalized = input.url?.trim() ? normalizeBrowserUrl(input.url) : null;
      const title = normalized
        ? getBrowserTabTitle({
            title: input.title,
            normalizedUrl: normalized.url,
            domain: normalized.domain,
          })
        : input.title?.trim() || null;

      const message = await ctx.db.workspaceChannelMessage.create({
        data: {
          channelId: input.channelId,
          userId: ctx.session.user.id,
          content: note || title || normalized?.url || "연구 아티팩트",
          type: "text",
          metadata: {
            kind: "browser-artifact",
            source: "shared-browser",
            note,
            url: normalized?.url ?? null,
            title,
            domain: normalized?.domain ?? null,
            capturedAt: new Date().toISOString(),
          } satisfies Prisma.InputJsonValue,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      await recordChannelAuditEvent(ctx.db, {
        workspaceId: channel.workspaceId,
        channelId: input.channelId,
        userId: ctx.session.user.id,
        action: "browser.artifact_saved",
        metadata: {
          title,
          url: normalized?.url ?? null,
        },
      });

      emitMessageEvent(message);
      return {
        ...message,
        metadata: (message.metadata ?? {}) as Record<string, unknown>,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        teamspaceId: z.string().nullable().optional(),
        name: z.string().min(1).max(60),
        description: z.string().max(240).optional(),
        type: z.enum(["text", "voice"]).default("text"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("channelsEnabled");
      if (input.type === "voice") {
        requireChannelFeature("voiceEnabled");
      }
      await requireWorkspacePermission(
        ctx.db,
        ctx.session.user.id,
        input.workspaceId,
        "page.create",
        "Channel creation permission is required",
      );

      if (input.teamspaceId) {
        const teamspace = await verifyTeamspaceAccess(ctx.db, ctx.session.user.id, input.teamspaceId);
        if (teamspace.workspaceId !== input.workspaceId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Teamspace does not belong to this workspace",
          });
        }
      }

      const position = await ctx.db.workspaceChannel.count({
        where: {
          workspaceId: input.workspaceId,
          teamspaceId: input.teamspaceId ?? null,
        },
      });

      const channel = await ctx.db.workspaceChannel.create({
        data: {
          workspaceId: input.workspaceId,
          teamspaceId: input.teamspaceId ?? null,
          createdBy: ctx.session.user.id,
          name: input.name.trim(),
          slug: await resolveUniqueChannelSlug(ctx.db, input.workspaceId, input.name),
          description: input.description?.trim() || null,
          type: input.type,
          position,
          topic:
            input.type === "voice"
              ? "음성, 화면 공유, 공동 브라우징을 위한 실시간 공간"
              : "팀 대화와 자료 맥락을 이어가는 텍스트 채널",
          metadata:
            input.type === "voice"
              ? {
                  screenshareEnabled: true,
                  preferredShareQuality: "4k",
                  cobrowseEnabled: true,
                }
              : {},
        },
        include: {
          teamspace: {
            select: {
              id: true,
              name: true,
              icon: true,
            },
          },
        },
      });

      await recordChannelAuditEvent(ctx.db, {
        workspaceId: input.workspaceId,
        channelId: channel.id,
        userId: ctx.session.user.id,
        action: "channel.created",
        metadata: {
          type: input.type,
          teamspaceId: input.teamspaceId ?? null,
        },
      });

      return {
        ...channel,
        metadata: channel.metadata as Record<string, unknown>,
      };
    }),

  listMessages: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      requireChannelFeature("channelsEnabled");
      await verifyChannelAccess(ctx.db, ctx.session.user.id, input.channelId);

      const messages = await ctx.db.workspaceChannelMessage.findMany({
        where: { channelId: input.channelId },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor
          ? {
              cursor: { id: input.cursor },
              skip: 1,
            }
          : {}),
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (messages.length > input.limit) {
        const next = messages.pop();
        nextCursor = next?.id;
      }

      return {
        messages: messages.reverse().map((message) => ({
          ...message,
          metadata: (message.metadata ?? {}) as Record<string, unknown>,
        })),
        nextCursor,
      };
    }),

  markRead: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("channelsEnabled");
      await verifyChannelAccess(ctx.db, ctx.session.user.id, input.channelId);

      const latestMessage = await ctx.db.workspaceChannelMessage.findFirst({
        where: { channelId: input.channelId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
        },
      });

      await ctx.db.workspaceChannelReadState.upsert({
        where: {
          channelId_userId: {
            channelId: input.channelId,
            userId: ctx.session.user.id,
          },
        },
        update: {
          lastReadMessageId: latestMessage?.id ?? null,
          lastReadAt: latestMessage?.createdAt ?? new Date(),
        },
        create: {
          channelId: input.channelId,
          userId: ctx.session.user.id,
          lastReadMessageId: latestMessage?.id ?? null,
          lastReadAt: latestMessage?.createdAt ?? new Date(),
        },
      });

      return {
        success: true,
        lastReadMessageId: latestMessage?.id ?? null,
        lastReadAt: latestMessage?.createdAt ?? new Date(),
      };
    }),

  listAuditLog: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifyChannelAccess(ctx.db, ctx.session.user.id, input.channelId);

      return ctx.db.workspaceChannelAuditLog.findMany({
        where: { channelId: input.channelId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  setScreenShareState: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        isSharing: z.boolean(),
        resolutionLabel: z.string().max(40).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("screenShareEnabled");
      const channel = await verifyVoiceChannelAccess(ctx.db, ctx.session.user.id, input.channelId);
      await verifyActiveVoicePresence(ctx.db, ctx.session.user.id, input.channelId);
      const activeVoiceParticipants = await getActiveVoiceParticipants(ctx.db, input.channelId);
      const hostUserId = getRoomHostUserId(activeVoiceParticipants, channel.createdBy);
      const currentScreenShare = getScreenShareState(channel.metadata);

      if (
        currentScreenShare.activePresenterUserId &&
        currentScreenShare.activePresenterUserId !== ctx.session.user.id &&
        hostUserId !== ctx.session.user.id
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Another presenter is already sharing a screen",
        });
      }

      const now = new Date().toISOString();
      const nextMetadata = mergeChannelMetadata(channel.metadata, {
        screenShare: input.isSharing
          ? {
              activePresenterUserId: ctx.session.user.id,
              resolutionLabel: input.resolutionLabel ?? null,
              startedAt:
                currentScreenShare.activePresenterUserId === ctx.session.user.id &&
                currentScreenShare.startedAt
                  ? currentScreenShare.startedAt
                  : now,
              endedAt: null,
              updatedAt: now,
              lastPresenterUserId: ctx.session.user.id,
            }
          : {
              activePresenterUserId: null,
              resolutionLabel: null,
              startedAt: null,
              endedAt: now,
              updatedAt: now,
              lastPresenterUserId:
                currentScreenShare.activePresenterUserId ?? ctx.session.user.id,
            },
      });

      const updated = await ctx.db.workspaceChannel.update({
        where: { id: input.channelId },
        data: {
          metadata: nextMetadata,
        },
        select: {
          id: true,
          createdBy: true,
          metadata: true,
        },
      });

      await recordChannelAuditEvent(ctx.db, {
        workspaceId: channel.workspaceId,
        channelId: input.channelId,
        userId: ctx.session.user.id,
        action: input.isSharing ? "screen_share.started" : "screen_share.stopped",
        metadata: {
          resolutionLabel: input.resolutionLabel ?? null,
          hostUserId,
        },
      });

      return {
        channelId: input.channelId,
        roomState: serializeVoiceRoomState({
          channel: updated,
          participants: activeVoiceParticipants,
        }),
      };
    }),

  sendMessage: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        content: z.string().min(1).max(4000),
        type: z.enum(["text", "system"]).default("text"),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("channelsEnabled");
      const channel = await verifyChannelAccess(ctx.db, ctx.session.user.id, input.channelId);
      enforceChannelRateLimit({
        scope: "message",
        workspaceId: channel.workspaceId,
        userId: ctx.session.user.id,
        limit: MESSAGE_RATE_LIMIT.limit,
        windowMs: MESSAGE_RATE_LIMIT.windowMs,
        message: "You are sending messages too quickly. Please slow down.",
      });

      const message = await ctx.db.workspaceChannelMessage.create({
        data: {
          channelId: input.channelId,
          userId: ctx.session.user.id,
          content: input.content.trim(),
          type: input.type,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      await recordChannelAuditEvent(ctx.db, {
        workspaceId: channel.workspaceId,
        channelId: input.channelId,
        userId: ctx.session.user.id,
        action: "message.sent",
        metadata: {
          type: input.type,
        },
      });

      emitMessageEvent(message);
      return {
        ...message,
        metadata: (message.metadata ?? {}) as Record<string, unknown>,
      };
    }),

  editMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        content: z.string().min(1).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("channelsEnabled");
      const message = await ctx.db.workspaceChannelMessage.findUnique({
        where: { id: input.messageId },
        select: { id: true, channelId: true, userId: true, isDeleted: true },
      });
      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }
      if (message.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own messages" });
      }
      if (message.isDeleted) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot edit a deleted message" });
      }
      await verifyChannelAccess(ctx.db, ctx.session.user.id, message.channelId);

      const updated = await ctx.db.workspaceChannelMessage.update({
        where: { id: input.messageId },
        data: { content: input.content.trim(), editedAt: new Date() },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });

      workspaceChannelEmitter.emit({
        kind: "message.created",
        channelId: updated.channelId,
        payload: {
          id: updated.id,
          channelId: updated.channelId,
          userId: updated.userId,
          content: updated.content,
          type: updated.type,
          metadata: (updated.metadata ?? {}) as Record<string, unknown>,
          createdAt: updated.createdAt.toISOString(),
          user: updated.user,
        },
      });

      return { ...updated, metadata: (updated.metadata ?? {}) as Record<string, unknown> };
    }),

  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("channelsEnabled");
      const message = await ctx.db.workspaceChannelMessage.findUnique({
        where: { id: input.messageId },
        select: { id: true, channelId: true, userId: true },
      });
      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }
      if (message.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own messages" });
      }
      await verifyChannelAccess(ctx.db, ctx.session.user.id, message.channelId);

      const updated = await ctx.db.workspaceChannelMessage.update({
        where: { id: input.messageId },
        data: { isDeleted: true, content: "" },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });

      workspaceChannelEmitter.emit({
        kind: "message.created",
        channelId: updated.channelId,
        payload: {
          id: updated.id,
          channelId: updated.channelId,
          userId: updated.userId,
          content: updated.content,
          type: updated.type,
          metadata: (updated.metadata ?? {}) as Record<string, unknown>,
          createdAt: updated.createdAt.toISOString(),
          user: updated.user,
        },
      });

      return { success: true };
    }),

  toggleReaction: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        emoji: z.string().min(1).max(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("channelsEnabled");
      const message = await ctx.db.workspaceChannelMessage.findUnique({
        where: { id: input.messageId },
        select: { id: true, channelId: true, metadata: true, isDeleted: true },
      });
      if (!message || message.isDeleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }
      await verifyChannelAccess(ctx.db, ctx.session.user.id, message.channelId);

      const meta = (message.metadata ?? {}) as Record<string, unknown>;
      const reactions = (meta.reactions ?? {}) as Record<string, string[]>;
      const voters = reactions[input.emoji] ?? [];
      const userId = ctx.session.user.id;

      if (voters.includes(userId)) {
        const filtered = voters.filter((id) => id !== userId);
        if (filtered.length === 0) {
          delete reactions[input.emoji];
        } else {
          reactions[input.emoji] = filtered;
        }
      } else {
        reactions[input.emoji] = [...voters, userId];
      }

      const updated = await ctx.db.workspaceChannelMessage.update({
        where: { id: input.messageId },
        data: { metadata: { ...meta, reactions } as Prisma.InputJsonValue },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });

      workspaceChannelEmitter.emit({
        kind: "message.created",
        channelId: updated.channelId,
        payload: {
          id: updated.id,
          channelId: updated.channelId,
          userId: updated.userId,
          content: updated.content,
          type: updated.type,
          metadata: (updated.metadata ?? {}) as Record<string, unknown>,
          createdAt: updated.createdAt.toISOString(),
          user: updated.user,
        },
      });

      return { ...updated, metadata: (updated.metadata ?? {}) as Record<string, unknown> };
    }),

  joinVoice: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        displayName: z.string().max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("voiceEnabled");
      const channel = await verifyVoiceChannelAccess(ctx.db, ctx.session.user.id, input.channelId);
      enforceChannelRateLimit({
        scope: "voice-join",
        workspaceId: channel.workspaceId,
        userId: ctx.session.user.id,
        limit: VOICE_JOIN_RATE_LIMIT.limit,
        windowMs: VOICE_JOIN_RATE_LIMIT.windowMs,
        message: "You are joining voice rooms too quickly. Please wait a moment.",
      });

      const displayName = input.displayName?.trim() || ctx.session.user.name || "참가자";

      await ctx.db.workspaceChannelVoicePresence.upsert({
        where: {
          channelId_userId: {
            channelId: input.channelId,
            userId: ctx.session.user.id,
          },
        },
        update: {
          displayName,
          status: "active",
          lastSeenAt: new Date(),
          leftAt: null,
        },
        create: {
          channelId: input.channelId,
          userId: ctx.session.user.id,
          displayName,
          status: "active",
          lastSeenAt: new Date(),
        },
      });

      await recordChannelAuditEvent(ctx.db, {
        workspaceId: channel.workspaceId,
        channelId: input.channelId,
        userId: ctx.session.user.id,
        action: "voice.joined",
        metadata: {
          displayName,
        },
      });

      await emitVoicePresenceUpdated(ctx.db, input.channelId);
      const activeVoiceParticipants = await getActiveVoiceParticipants(ctx.db, input.channelId);

      return {
        channelId: input.channelId,
        activeVoiceParticipants: activeVoiceParticipants.map((participant) => ({
          id: participant.id,
          userId: participant.userId,
          displayName: participant.displayName,
          status: participant.status,
          joinedAt: participant.joinedAt,
          lastSeenAt: participant.lastSeenAt,
          leftAt: participant.leftAt,
          user: participant.user,
        })),
      };
    }),

  leaveVoice: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const channel = await verifyVoiceChannelAccess(ctx.db, ctx.session.user.id, input.channelId);

      const existing = await ctx.db.workspaceChannelVoicePresence.findUnique({
        where: {
          channelId_userId: {
            channelId: input.channelId,
            userId: ctx.session.user.id,
          },
        },
      });

      if (!existing) {
        return { success: true };
      }

      await ctx.db.workspaceChannelVoicePresence.update({
        where: { id: existing.id },
        data: {
          status: "inactive",
          lastSeenAt: new Date(),
          leftAt: new Date(),
        },
      });

      const screenShare = getScreenShareState(channel.metadata);
      const presenterCleared = screenShare.activePresenterUserId === ctx.session.user.id;
      if (presenterCleared) {
        await ctx.db.workspaceChannel.update({
          where: { id: input.channelId },
          data: {
            metadata: mergeChannelMetadata(channel.metadata, {
              screenShare: {
                activePresenterUserId: null,
                resolutionLabel: null,
                startedAt: null,
                endedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastPresenterUserId: ctx.session.user.id,
              },
            }),
          },
        });
      }

      await recordChannelAuditEvent(ctx.db, {
        workspaceId: channel.workspaceId,
        channelId: input.channelId,
        userId: ctx.session.user.id,
        action: "voice.left",
      });

      await emitVoicePresenceUpdated(ctx.db, input.channelId);
      if (presenterCleared) {
        emitBrowserSessionUpdated(input.channelId);
      }
      return { success: true };
    }),

  heartbeatVoice: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        displayName: z.string().max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyVoiceChannelAccess(ctx.db, ctx.session.user.id, input.channelId);

      const existing = await ctx.db.workspaceChannelVoicePresence.findUnique({
        where: {
          channelId_userId: {
            channelId: input.channelId,
            userId: ctx.session.user.id,
          },
        },
      });

      if (!existing) {
        return { success: false };
      }

      await ctx.db.workspaceChannelVoicePresence.update({
        where: { id: existing.id },
        data: {
          displayName: input.displayName?.trim() || existing.displayName,
          status: "active",
          lastSeenAt: new Date(),
          leftAt: null,
        },
      });

      return { success: true };
    }),

  sendSignal: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        targetUserId: z.string().nullable().optional(),
        signalType: z.enum(["offer", "answer", "ice-candidate", "peer-left"]),
        data: z.unknown(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireChannelFeature("voiceEnabled");
      const channel = await verifyVoiceChannelAccess(ctx.db, ctx.session.user.id, input.channelId);

      const presence = await ctx.db.workspaceChannelVoicePresence.findUnique({
        where: {
          channelId_userId: {
            channelId: input.channelId,
            userId: ctx.session.user.id,
          },
        },
      });

      if (!presence || presence.status !== "active") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Join the voice room before sending signals",
        });
      }

      emitVoiceSignal({
        channelId: input.channelId,
        fromUserId: ctx.session.user.id,
        targetUserId: input.targetUserId ?? null,
        signalType: input.signalType,
        data: input.data,
      });

      return { success: true };
    }),
});
