"use client";

import { create } from "zustand";

/**
 * Global voice connection store.
 *
 * Holds all WebRTC state (peer connections, media streams) at module scope
 * so that navigating between pages does NOT tear down the voice session.
 * React components read reactive slices via the Zustand hook; the actual
 * mutable networking objects live in the module-level Maps/refs below.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VoiceSignalEvent = {
  fromUserId: string;
  targetUserId: string | null;
  signalType: "offer" | "answer" | "ice-candidate" | "peer-left";
  data: unknown;
};

type IceServerConfig = {
  urls: string[];
  username?: string;
  credential?: string;
};

type VoiceConfig = {
  iceServers: IceServerConfig[];
  topology: string;
  maxParticipants?: number;
  maxRecommendedParticipants?: number;
};

export type RemotePeer = {
  userId: string;
  displayName: string;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState | "new";
  hasScreenShare: boolean;
  screenTrackLabel: string | null;
};

type AudioInputDevice = {
  deviceId: string;
  label: string;
};

// ---------------------------------------------------------------------------
// Signaling bridge – set by VoiceProvider (has access to tRPC)
// ---------------------------------------------------------------------------

type SignalSender = (params: {
  channelId: string;
  targetUserId: string | null;
  signalType: "offer" | "answer" | "ice-candidate" | "peer-left";
  data: unknown;
}) => Promise<void>;

type VoiceApiCaller = {
  joinVoice: (params: { channelId: string; displayName: string }) => Promise<void>;
  leaveVoice: (params: { channelId: string }) => Promise<void>;
  heartbeatVoice: (params: { channelId: string; displayName?: string }) => Promise<void>;
  sendSignal: SignalSender;
  getVoiceConfig: (params: { channelId: string }) => Promise<VoiceConfig>;
  setScreenShareState: (params: { channelId: string; isSharing: boolean; resolutionLabel?: string }) => Promise<void>;
  onPresenceRefresh: () => void;
};

let apiCaller: VoiceApiCaller | null = null;

export function setVoiceApiCaller(caller: VoiceApiCaller | null) {
  apiCaller = caller;
}

// ---------------------------------------------------------------------------
// Module-level WebRTC state (survives React re-renders / navigation)
// ---------------------------------------------------------------------------

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302"] }];

let voiceConfig: VoiceConfig | null = null;
let localStream: MediaStream | null = null;
let localScreenStream: MediaStream | null = null;
const peerConnections = new Map<string, RTCPeerConnection>();
const remoteStreams = new Map<string, MediaStream>();
const screenSenders = new Map<string, RTCRtpSender>();
const pendingIceCandidates = new Map<string, RTCIceCandidateInit[]>();
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
let isCleaningUp = false;

function buildRtcConfig(): RTCConfiguration {
  if (voiceConfig?.iceServers?.length) {
    return {
      iceServers: voiceConfig.iceServers.map((s) => ({
        urls: s.urls,
        ...(s.username ? { username: s.username } : {}),
        ...(s.credential ? { credential: s.credential } : {}),
      })),
    };
  }
  return { iceServers: FALLBACK_ICE_SERVERS };
}

function getLiveVideoTrack(stream: MediaStream | null) {
  return stream?.getVideoTracks().find((t) => t.readyState === "live") ?? null;
}

function getAudioTrack(stream: MediaStream | null) {
  return stream?.getAudioTracks().find((t) => t.readyState === "live") ?? null;
}

function formatScreenResolution(stream: MediaStream | null) {
  const track = getLiveVideoTrack(stream);
  if (!track) return null;
  const s = track.getSettings();
  if (!s.width || !s.height) return null;
  return `${s.width}x${s.height}`;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type VoiceConnectionState = {
  // Session
  channelId: string | null;
  channelName: string | null;
  workspaceId: string | null;

  // Status
  isJoined: boolean;
  status: "idle" | "joining" | "joined" | "error";
  error: string | null;

  // Controls
  isMuted: boolean;
  isDeafened: boolean;
  isScreenSharing: boolean;
  screenShareQualityLabel: string | null;
  localScreenStream: MediaStream | null;

  // Peers
  remotePeers: RemotePeer[];
  connectedPeerCount: number;

  // Audio devices
  availableAudioInputs: AudioInputDevice[];
  selectedAudioInputId: string | null;

  // Current user info (set by provider)
  _currentUser: { id: string; name: string } | null;
  _participants: Array<{ id: string; userId: string; displayName: string }>;

  // Actions
  setCurrentUser: (user: { id: string; name: string } | null) => void;
  setParticipants: (participants: Array<{ id: string; userId: string; displayName: string }>) => void;
  joinRoom: (params: { channelId: string; channelName: string; workspaceId: string }) => Promise<void>;
  leaveRoom: () => Promise<void>;
  toggleMute: () => void;
  toggleDeafen: () => void;
  switchAudioInput: (deviceId: string) => Promise<void>;
  startScreenShare: () => Promise<string | null>;
  stopScreenShare: (options?: { skipRenegotiation?: boolean }) => Promise<void>;
  handleSignalEvent: (event: VoiceSignalEvent) => Promise<void>;
  refreshAudioInputs: () => Promise<void>;
};

function updateRemotePeersState() {
  const state = useVoiceConnectionStore.getState();
  const currentUserId = state._currentUser?.id;
  const participants = state._participants;

  const nextPeers: RemotePeer[] = participants
    .filter((p) => p.userId !== currentUserId)
    .map((p) => {
      const stream = remoteStreams.get(p.userId) ?? null;
      const videoTrack = getLiveVideoTrack(stream);
      return {
        userId: p.userId,
        displayName: p.displayName,
        stream,
        connectionState: peerConnections.get(p.userId)?.connectionState ?? "new",
        hasScreenShare: Boolean(videoTrack),
        screenTrackLabel: videoTrack?.label ?? null,
      };
    });

  const prev = state.remotePeers;
  const changed =
    prev.length !== nextPeers.length ||
    prev.some((p, i) => {
      const n = nextPeers[i];
      return (
        !n ||
        p.userId !== n.userId ||
        p.connectionState !== n.connectionState ||
        p.hasScreenShare !== n.hasScreenShare ||
        p.stream !== n.stream
      );
    });

  if (changed) {
    useVoiceConnectionStore.setState({
      remotePeers: nextPeers,
      connectedPeerCount: nextPeers.filter((p) => p.connectionState === "connected").length,
    });
  }
}

function closePeerConnection(remoteUserId: string) {
  const timer = reconnectTimers.get(remoteUserId);
  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(remoteUserId);
  }

  const pc = peerConnections.get(remoteUserId);
  if (pc) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    try { pc.close(); } catch { /* ignore */ }
  }

  peerConnections.delete(remoteUserId);
  remoteStreams.delete(remoteUserId);
  screenSenders.delete(remoteUserId);
  pendingIceCandidates.delete(remoteUserId);
  updateRemotePeersState();
}

function stopLocalStream() {
  if (!localStream) return;
  localStream.getTracks().forEach((t) => t.stop());
  localStream = null;
}

function attachLocalTracks(pc: RTCPeerConnection, remoteUserId: string) {
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream!);
    });
  }

  const screenTrack = getLiveVideoTrack(localScreenStream);
  if (localScreenStream && screenTrack && !screenSenders.has(remoteUserId)) {
    const sender = pc.addTrack(screenTrack, localScreenStream);
    screenSenders.set(remoteUserId, sender);
  }
}

function flushPendingIce(remoteUserId: string) {
  const pc = peerConnections.get(remoteUserId);
  if (!pc?.remoteDescription) return;
  const pending = pendingIceCandidates.get(remoteUserId) ?? [];
  if (!pending.length) return;
  pendingIceCandidates.delete(remoteUserId);
  pending.forEach((c) => void pc.addIceCandidate(c).catch(() => undefined));
}

function ensurePeerConnection(remoteUserId: string): RTCPeerConnection {
  const existing = peerConnections.get(remoteUserId);
  if (existing) return existing;

  const state = useVoiceConnectionStore.getState();
  const channelId = state.channelId;

  const pc = new RTCPeerConnection(buildRtcConfig());

  pc.onicecandidate = (event) => {
    if (!event.candidate || !channelId) return;
    void apiCaller?.sendSignal({
      channelId,
      targetUserId: remoteUserId,
      signalType: "ice-candidate",
      data: event.candidate.toJSON(),
    }).catch(() => undefined);
  };

  pc.ontrack = (event) => {
    const remoteStream =
      remoteStreams.get(remoteUserId) ?? event.streams[0] ?? new MediaStream();
    if (!remoteStreams.has(remoteUserId)) {
      remoteStreams.set(remoteUserId, remoteStream);
    }
    if (!event.streams[0]) {
      remoteStream.addTrack(event.track);
    }
    event.track.onended = () => updateRemotePeersState();
    updateRemotePeersState();
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") {
      const t = reconnectTimers.get(remoteUserId);
      if (t) { clearTimeout(t); reconnectTimers.delete(remoteUserId); }
    }

    if (pc.connectionState === "disconnected") {
      const existing = reconnectTimers.get(remoteUserId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        if (!useVoiceConnectionStore.getState().isJoined) return;
        void createOffer(remoteUserId, { forceInitiator: true }).catch(() => undefined);
      }, 1_500);
      reconnectTimers.set(remoteUserId, timer);
    }

    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      closePeerConnection(remoteUserId);
      return;
    }
    updateRemotePeersState();
  };

  attachLocalTracks(pc, remoteUserId);
  peerConnections.set(remoteUserId, pc);
  updateRemotePeersState();
  return pc;
}

async function createOffer(
  remoteUserId: string,
  options?: { forceInitiator?: boolean },
) {
  const state = useVoiceConnectionStore.getState();
  if (!state._currentUser || !state.channelId) return;
  if (!options?.forceInitiator && state._currentUser.id >= remoteUserId) return;

  const pc = ensurePeerConnection(remoteUserId);
  if (pc.signalingState !== "stable" || pc.localDescription?.type === "offer") return;

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await apiCaller?.sendSignal({
    channelId: state.channelId,
    targetUserId: remoteUserId,
    signalType: "offer",
    data: offer,
  });
}

async function acquireAudioStream(deviceId?: string | null) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("이 브라우저에서는 음성 채팅을 지원하지 않습니다.");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  });
}

async function replaceLocalAudioStream(nextStream: MediaStream) {
  const nextTrack = getAudioTrack(nextStream);
  if (!nextTrack) throw new Error("마이크 트랙을 가져오지 못했습니다.");

  const state = useVoiceConnectionStore.getState();
  nextTrack.enabled = !state.isMuted;

  await Promise.all(
    Array.from(peerConnections.values()).map(async (pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
      if (!sender) {
        pc.addTrack(nextTrack, nextStream);
        return;
      }
      await sender.replaceTrack(nextTrack);
    }),
  );

  localStream?.getTracks().forEach((t) => t.stop());
  localStream = nextStream;
}

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------

export const useVoiceConnectionStore = create<VoiceConnectionState>((set, get) => ({
  channelId: null,
  channelName: null,
  workspaceId: null,
  isJoined: false,
  status: "idle",
  error: null,
  isMuted: false,
  isDeafened: false,
  isScreenSharing: false,
  screenShareQualityLabel: null,
  localScreenStream: null,
  remotePeers: [],
  connectedPeerCount: 0,
  availableAudioInputs: [],
  selectedAudioInputId: null,
  _currentUser: null,
  _participants: [],

  setCurrentUser: (user) => set({ _currentUser: user }),

  setParticipants: (participants) => {
    set({ _participants: participants });

    const state = get();
    if (!state._currentUser || !state.isJoined) return;

    const activeRemoteUserIds = participants
      .filter((p) => p.userId !== state._currentUser?.id)
      .map((p) => p.userId);

    activeRemoteUserIds.forEach((id) => ensurePeerConnection(id));
    activeRemoteUserIds.forEach((id) => void createOffer(id).catch(() => undefined));

    // Clean up stale peer connections
    for (const id of Array.from(peerConnections.keys())) {
      if (!activeRemoteUserIds.includes(id)) {
        closePeerConnection(id);
      }
    }

    updateRemotePeersState();
  },

  refreshAudioInputs: async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `마이크 ${i + 1}` }));
      const state = get();
      set({ availableAudioInputs: inputs });
      if (!state.selectedAudioInputId && inputs[0]?.deviceId) {
        set({ selectedAudioInputId: inputs[0].deviceId });
      }
    } catch { /* ignore */ }
  },

  joinRoom: async ({ channelId, channelName, workspaceId }) => {
    const state = get();
    if (isCleaningUp || state.isJoined) return;

    // If already in a different channel, leave first
    if (state.channelId && state.channelId !== channelId && state.isJoined) {
      await get().leaveRoom();
    }

    set({ status: "joining", error: null, channelId, channelName, workspaceId });

    try {
      const config = await apiCaller?.getVoiceConfig({ channelId });
      if (config) voiceConfig = config;

      const stream = await acquireAudioStream(get().selectedAudioInputId);
      localStream = stream;
      stream.getAudioTracks().forEach((t) => { t.enabled = !get().isMuted; });

      const joinedTrack = getAudioTrack(stream);
      const joinedDeviceId = joinedTrack?.getSettings().deviceId;
      if (joinedDeviceId) set({ selectedAudioInputId: joinedDeviceId });
      await get().refreshAudioInputs();

      const user = get()._currentUser;
      if (!user) throw new Error("사용자 정보를 확인한 뒤 다시 시도해 주세요.");

      await apiCaller?.joinVoice({ channelId, displayName: user.name });
      apiCaller?.onPresenceRefresh();

      set({ isJoined: true, status: "joined" });
      updateRemotePeersState();
    } catch (err) {
      stopLocalStream();
      const message = err instanceof Error ? err.message : "음성방 입장에 실패했습니다.";
      set({ error: message, status: "error" });
    }
  },

  leaveRoom: async () => {
    if (isCleaningUp) return;
    isCleaningUp = true;

    try {
      await get().stopScreenShare({ skipRenegotiation: true }).catch(() => undefined);

      const state = get();
      if (state.isJoined && state._currentUser && state.channelId) {
        await apiCaller?.sendSignal({
          channelId: state.channelId,
          targetUserId: null,
          signalType: "peer-left",
          data: null,
        }).catch(() => undefined);
      }

      for (const id of Array.from(peerConnections.keys())) {
        closePeerConnection(id);
      }
      stopLocalStream();

      if (state.isJoined && state.channelId) {
        await apiCaller?.leaveVoice({ channelId: state.channelId }).catch(() => undefined);
      }
    } finally {
      apiCaller?.onPresenceRefresh();
      set({
        isJoined: false,
        isMuted: false,
        isDeafened: false,
        isScreenSharing: false,
        screenShareQualityLabel: null,
        localScreenStream: null,
        status: "idle",
        error: null,
        remotePeers: [],
        connectedPeerCount: 0,
        channelId: null,
        channelName: null,
        workspaceId: null,
      });
      isCleaningUp = false;
    }
  },

  toggleMute: () => {
    const next = !get().isMuted;
    set({ isMuted: next });
    localStream?.getAudioTracks().forEach((t) => { t.enabled = !next; });
  },

  toggleDeafen: () => {
    set({ isDeafened: !get().isDeafened });
  },

  switchAudioInput: async (deviceId) => {
    set({ selectedAudioInputId: deviceId });
    if (!get().isJoined) return;
    try {
      const nextStream = await acquireAudioStream(deviceId);
      await replaceLocalAudioStream(nextStream);
      await get().refreshAudioInputs();
    } catch (err) {
      const message = err instanceof Error ? err.message : "마이크를 전환하지 못했습니다.";
      set({ error: message });
    }
  },

  startScreenShare: async () => {
    if (!get().isJoined) throw new Error("먼저 음성방에 입장해야 화면을 공유할 수 있습니다.");
    if (localScreenStream) return null;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: { width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 30, max: 30 } },
      });

      const screenTrack = getLiveVideoTrack(stream);
      if (!screenTrack) throw new Error("화면 비디오 트랙을 가져오지 못했습니다.");

      screenTrack.onended = () => {
        void get().stopScreenShare();
      };

      localScreenStream = stream;
      const resLabel = formatScreenResolution(stream);
      set({ localScreenStream: stream, isScreenSharing: true, screenShareQualityLabel: resLabel });

      for (const [remoteUserId, pc] of Array.from(peerConnections.entries())) {
        if (screenSenders.has(remoteUserId)) continue;
        const sender = pc.addTrack(screenTrack, stream);
        screenSenders.set(remoteUserId, sender);
      }

      await Promise.all(
        Array.from(peerConnections.keys()).map((id) =>
          createOffer(id, { forceInitiator: true }).catch(() => undefined),
        ),
      );
      updateRemotePeersState();

      const channelId = get().channelId;
      if (channelId) {
        await apiCaller?.setScreenShareState({ channelId, isSharing: true, resolutionLabel: resLabel ?? undefined });
      }

      return resLabel;
    } catch (err) {
      const message = err instanceof Error ? err.message : "화면 공유를 시작하지 못했습니다.";
      set({ error: message });
      throw err;
    }
  },

  stopScreenShare: async (options) => {
    if (!localScreenStream) return;

    const stream = localScreenStream;
    localScreenStream = null;
    set({ localScreenStream: null, isScreenSharing: false, screenShareQualityLabel: null });

    stream.getTracks().forEach((t) => { t.onended = null; t.stop(); });

    const remoteUserIds = Array.from(peerConnections.keys());
    remoteUserIds.forEach((id) => {
      const pc = peerConnections.get(id);
      const sender = screenSenders.get(id);
      if (pc && sender) {
        try { pc.removeTrack(sender); } catch { /* noop */ }
      }
      screenSenders.delete(id);
    });

    if (!options?.skipRenegotiation) {
      await Promise.all(
        remoteUserIds.map((id) => createOffer(id, { forceInitiator: true }).catch(() => undefined)),
      );
    }
    updateRemotePeersState();

    const channelId = get().channelId;
    if (channelId) {
      await apiCaller?.setScreenShareState({ channelId, isSharing: false }).catch(() => undefined);
    }
  },

  handleSignalEvent: async (event) => {
    const state = get();
    if (!state._currentUser || !state.isJoined || !state.channelId) return;
    if (event.fromUserId === state._currentUser.id) return;
    if (event.targetUserId && event.targetUserId !== state._currentUser.id) return;

    if (event.signalType === "peer-left") {
      closePeerConnection(event.fromUserId);
      return;
    }

    const pc = ensurePeerConnection(event.fromUserId);

    if (event.signalType === "offer") {
      const rd = event.data as RTCSessionDescriptionInit;
      if (pc.signalingState !== "stable" && pc.localDescription) {
        await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit).catch(() => undefined);
      }
      await pc.setRemoteDescription(rd);
      flushPendingIce(event.fromUserId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await apiCaller?.sendSignal({
        channelId: state.channelId,
        targetUserId: event.fromUserId,
        signalType: "answer",
        data: answer,
      });
      return;
    }

    if (event.signalType === "answer") {
      await pc.setRemoteDescription(event.data as RTCSessionDescriptionInit).catch(() => undefined);
      flushPendingIce(event.fromUserId);
      return;
    }

    if (event.signalType === "ice-candidate") {
      const candidate = event.data as RTCIceCandidateInit | null;
      if (!candidate) return;
      if (pc.remoteDescription) {
        await pc.addIceCandidate(candidate).catch(() => undefined);
        return;
      }
      const queue = pendingIceCandidates.get(event.fromUserId) ?? [];
      queue.push(candidate);
      pendingIceCandidates.set(event.fromUserId, queue);
    }
  },
}));
