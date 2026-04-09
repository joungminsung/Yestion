"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/server/trpc/client";
import type { AppRouter } from "@/server/trpc/router";
import { useToastStore } from "@/stores/toast";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type VoiceParticipant = NonNullable<RouterOutputs["channel"]["get"]>["activeVoiceParticipants"][number];
type VoiceConfig = RouterOutputs["channel"]["getVoiceConfig"];

type VoiceSignalEvent = {
  fromUserId: string;
  targetUserId: string | null;
  signalType: "offer" | "answer" | "ice-candidate" | "peer-left";
  data: unknown;
};

type RemotePeer = {
  userId: string;
  displayName: string;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState | "new";
  hasScreenShare: boolean;
  screenTrackLabel: string | null;
};

type VoiceRoomStatus = "idle" | "joining" | "joined" | "error";
type AudioInputDevice = {
  deviceId: string;
  label: string;
};

const FALLBACK_ICE_SERVERS = [{ urls: ["stun:stun.l.google.com:19302"] }];

function buildRtcConfiguration(config?: VoiceConfig): RTCConfiguration {
  return {
    iceServers: config?.iceServers?.length
      ? config.iceServers.map((server) => ({
          urls: server.urls,
          ...(server.username ? { username: server.username } : {}),
          ...(server.credential ? { credential: server.credential } : {}),
        }))
      : FALLBACK_ICE_SERVERS,
  };
}

function getLiveVideoTrack(stream: MediaStream | null) {
  return stream?.getVideoTracks().find((track) => track.readyState === "live") ?? null;
}

function formatScreenResolution(stream: MediaStream | null) {
  const track = getLiveVideoTrack(stream);
  if (!track) {
    return null;
  }

  const settings = track.getSettings();
  const width = typeof settings.width === "number" ? settings.width : null;
  const height = typeof settings.height === "number" ? settings.height : null;

  if (!width || !height) {
    return null;
  }

  return `${width}x${height}`;
}

function getAudioTrack(stream: MediaStream | null) {
  return stream?.getAudioTracks().find((track) => track.readyState === "live") ?? null;
}

export function useVoiceRoom(params: {
  channelId: string;
  enabled: boolean;
  currentUser: { id: string; name: string } | null | undefined;
  participants: VoiceParticipant[];
  onPresenceRefresh: () => void;
}) {
  const addToast = useToastStore((state) => state.addToast);
  const [status, setStatus] = useState<VoiceRoomStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareQualityLabel, setScreenShareQualityLabel] = useState<string | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [availableAudioInputs, setAvailableAudioInputs] = useState<AudioInputDevice[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState<string | null>(null);

  const configRef = useRef<VoiceConfig | null>(null);
  const currentUserRef = useRef(params.currentUser);
  const participantsRef = useRef<VoiceParticipant[]>(params.participants);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const remoteStreamsRef = useRef(new Map<string, MediaStream>());
  const screenSendersRef = useRef(new Map<string, RTCRtpSender>());
  const pendingIceCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const reconnectTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const isCleaningUpRef = useRef(false);
  const isMountedRef = useRef(true);
  const isJoinedRef = useRef(isJoined);
  const selectedAudioInputIdRef = useRef<string | null>(null);
  const leaveRoomRef = useRef<() => Promise<void>>(async () => undefined);
  const stopScreenShareRef = useRef<() => Promise<void>>(async () => undefined);

  const voiceConfigQuery = trpc.channel.getVoiceConfig.useQuery(
    { channelId: params.channelId },
    {
      enabled: params.enabled,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  );
  const joinVoice = trpc.channel.joinVoice.useMutation();
  const leaveVoice = trpc.channel.leaveVoice.useMutation();
  const sendSignal = trpc.channel.sendSignal.useMutation();

  async function refreshAudioInputs() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `마이크 ${index + 1}`,
        }));

      if (isMountedRef.current) {
        setAvailableAudioInputs(inputs);
      }

      if (!selectedAudioInputIdRef.current && inputs[0]?.deviceId) {
        selectedAudioInputIdRef.current = inputs[0].deviceId;
        if (isMountedRef.current) {
          setSelectedAudioInputId(inputs[0].deviceId);
        }
      }
    } catch {
      // Ignore enumerate failures.
    }
  }

  function updateRemotePeers() {
    const currentParticipants = participantsRef.current;
    const currentUserId = currentUserRef.current?.id;
    const nextPeers = currentParticipants
      .filter((participant) => participant.userId !== currentUserId)
      .map((participant) => {
        const stream = remoteStreamsRef.current.get(participant.userId) ?? null;
        const videoTrack = getLiveVideoTrack(stream);

        return {
          userId: participant.userId,
          displayName: participant.displayName,
          stream,
          connectionState:
            peerConnectionsRef.current.get(participant.userId)?.connectionState ?? "new",
          hasScreenShare: Boolean(videoTrack),
          screenTrackLabel: videoTrack?.label ?? null,
        };
      });

    setRemotePeers((prev) => {
      // Skip update if nothing changed to prevent infinite render loops
      if (prev.length === nextPeers.length && prev.every((p, i) => {
        const n = nextPeers[i];
        return n && p.userId === n.userId && p.connectionState === n.connectionState && p.hasScreenShare === n.hasScreenShare && p.stream === n.stream;
      })) {
        return prev;
      }
      return nextPeers;
    });
  }

  function flushPendingIceCandidates(remoteUserId: string) {
    const peerConnection = peerConnectionsRef.current.get(remoteUserId);
    if (!peerConnection?.remoteDescription) {
      return;
    }

    const pendingCandidates = pendingIceCandidatesRef.current.get(remoteUserId) ?? [];
    if (pendingCandidates.length === 0) {
      return;
    }

    pendingIceCandidatesRef.current.delete(remoteUserId);

    pendingCandidates.forEach((candidate) => {
      void peerConnection.addIceCandidate(candidate).catch(() => undefined);
    });
  }

  function closePeerConnection(remoteUserId: string) {
    const reconnectTimer = reconnectTimersRef.current.get(remoteUserId);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimersRef.current.delete(remoteUserId);
    }

    const peerConnection = peerConnectionsRef.current.get(remoteUserId);
    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      try {
        peerConnection.close();
      } catch {
        // ignore close errors
      }
    }

    peerConnectionsRef.current.delete(remoteUserId);
    remoteStreamsRef.current.delete(remoteUserId);
    screenSendersRef.current.delete(remoteUserId);
    pendingIceCandidatesRef.current.delete(remoteUserId);
    updateRemotePeers();
  }

  function stopLocalStream() {
    const localStream = localStreamRef.current;
    if (!localStream) {
      return;
    }

    localStream.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }

  function attachLocalTracks(peerConnection: RTCPeerConnection, remoteUserId: string) {
    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }

    const localScreenStream = localScreenStreamRef.current;
    const localScreenTrack = getLiveVideoTrack(localScreenStream);
    if (localScreenStream && localScreenTrack && !screenSendersRef.current.has(remoteUserId)) {
      const sender = peerConnection.addTrack(localScreenTrack, localScreenStream);
      screenSendersRef.current.set(remoteUserId, sender);
    }
  }

  function ensurePeerConnection(remoteUserId: string) {
    const existing = peerConnectionsRef.current.get(remoteUserId);
    if (existing) {
      return existing;
    }

    const peerConnection = new RTCPeerConnection(buildRtcConfiguration(configRef.current ?? voiceConfigQuery.data));

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      void sendSignal.mutateAsync({
        channelId: params.channelId,
        targetUserId: remoteUserId,
        signalType: "ice-candidate",
        data: event.candidate.toJSON(),
      }).catch(() => undefined);
    };

    peerConnection.ontrack = (event) => {
      const remoteStream =
        remoteStreamsRef.current.get(remoteUserId) ??
        event.streams[0] ??
        new MediaStream();

      if (!remoteStreamsRef.current.has(remoteUserId)) {
        remoteStreamsRef.current.set(remoteUserId, remoteStream);
      }

      if (!event.streams[0]) {
        remoteStream.addTrack(event.track);
      }

      event.track.onended = () => {
        updateRemotePeers();
      };

      updateRemotePeers();
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === "connected") {
        const reconnectTimer = reconnectTimersRef.current.get(remoteUserId);
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimersRef.current.delete(remoteUserId);
        }
      }

      if (peerConnection.connectionState === "disconnected") {
        const existingTimer = reconnectTimersRef.current.get(remoteUserId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
          if (!isJoinedRef.current) {
            return;
          }

          void createOffer(remoteUserId, { forceInitiator: true }).catch(() => undefined);
        }, 1_500);

        reconnectTimersRef.current.set(remoteUserId, timer);
      }

      if (peerConnection.connectionState === "failed" || peerConnection.connectionState === "closed") {
        closePeerConnection(remoteUserId);
        return;
      }
      updateRemotePeers();
    };

    attachLocalTracks(peerConnection, remoteUserId);

    peerConnectionsRef.current.set(remoteUserId, peerConnection);
    updateRemotePeers();
    return peerConnection;
  }

  async function createOffer(remoteUserId: string, options?: { forceInitiator?: boolean }) {
    if (!currentUserRef.current) {
      return;
    }

    if (!options?.forceInitiator && currentUserRef.current.id >= remoteUserId) {
      return;
    }

    const peerConnection = ensurePeerConnection(remoteUserId);
    if (
      peerConnection.signalingState !== "stable" ||
      peerConnection.localDescription?.type === "offer"
    ) {
      return;
    }

    const offer = await peerConnection.createOffer();

    await peerConnection.setLocalDescription(offer);
    await sendSignal.mutateAsync({
      channelId: params.channelId,
      targetUserId: remoteUserId,
      signalType: "offer",
      data: offer,
    });
  }

  async function acquireLocalAudioStream(deviceId?: string | null) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("이 브라우저에서는 음성 채팅을 지원하지 않습니다.");
    }

    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(deviceId
          ? {
              deviceId: {
                exact: deviceId,
              },
            }
          : {}),
      },
    });
  }

  async function acquireScreenStream() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("이 브라우저에서는 화면 공유를 지원하지 않습니다.");
    }

    return navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: {
        width: { ideal: 3840 },
        height: { ideal: 2160 },
        frameRate: { ideal: 30, max: 30 },
      },
    });
  }

  async function replaceLocalAudioStream(nextStream: MediaStream) {
    const nextTrack = getAudioTrack(nextStream);
    if (!nextTrack) {
      throw new Error("마이크 트랙을 가져오지 못했습니다.");
    }

    nextTrack.enabled = !isMuted;

    await Promise.all(
      Array.from(peerConnectionsRef.current.values()).map(async (peerConnection) => {
        const sender = peerConnection
          .getSenders()
          .find((candidate) => candidate.track?.kind === "audio");

        if (!sender) {
          peerConnection.addTrack(nextTrack, nextStream);
          return;
        }

        await sender.replaceTrack(nextTrack);
      }),
    );

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = nextStream;
    await refreshAudioInputs();
  }

  async function switchAudioInput(deviceId: string) {
    selectedAudioInputIdRef.current = deviceId;
    setSelectedAudioInputId(deviceId);

    if (!isJoinedRef.current) {
      return;
    }

    try {
      const nextStream = await acquireLocalAudioStream(deviceId);
      await replaceLocalAudioStream(nextStream);
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "마이크를 전환하지 못했습니다.";
      setError(message);
      addToast({ type: "error", message });
    }
  }

  async function joinRoom() {
    if (!params.enabled) {
      const message = "이 채널에서는 현재 음성 기능을 사용할 수 없습니다.";
      setError(message);
      addToast({ type: "error", message });
      return;
    }

    if (!params.currentUser) {
      const message = "사용자 정보를 확인한 뒤 다시 시도해 주세요.";
      setError(message);
      addToast({ type: "error", message });
      return;
    }

    if (isCleaningUpRef.current || isJoinedRef.current) {
      return;
    }

    setStatus("joining");
    setError(null);

    try {
      const configResult = voiceConfigQuery.data ?? (await voiceConfigQuery.refetch()).data;
      configRef.current = configResult ?? null;

      const localStream = await acquireLocalAudioStream(selectedAudioInputIdRef.current);
      localStreamRef.current = localStream;
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
      const joinedTrack = getAudioTrack(localStream);
      const joinedDeviceId = joinedTrack?.getSettings().deviceId;
      if (joinedDeviceId) {
        selectedAudioInputIdRef.current = joinedDeviceId;
        setSelectedAudioInputId(joinedDeviceId);
      }
      await refreshAudioInputs();

      await joinVoice.mutateAsync({
        channelId: params.channelId,
        displayName: params.currentUser.name,
      });

      params.onPresenceRefresh();
      setIsJoined(true);
      setStatus("joined");
      updateRemotePeers();
    } catch (nextError) {
      stopLocalStream();
      const message = nextError instanceof Error ? nextError.message : "음성방 입장에 실패했습니다.";
      setError(message);
      setStatus("error");
      addToast({ type: "error", message });
    }
  }

  async function stopScreenShare(options?: { skipRenegotiation?: boolean }) {
    const currentScreenStream = localScreenStreamRef.current;
    if (!currentScreenStream) {
      return;
    }

    localScreenStreamRef.current = null;
    setLocalScreenStream(null);
    setIsScreenSharing(false);
    setScreenShareQualityLabel(null);

    currentScreenStream.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });

    const remoteUserIds = Array.from(peerConnectionsRef.current.keys());
    remoteUserIds.forEach((remoteUserId) => {
      const peerConnection = peerConnectionsRef.current.get(remoteUserId);
      const sender = screenSendersRef.current.get(remoteUserId);
      if (peerConnection && sender) {
        try {
          peerConnection.removeTrack(sender);
        } catch {
          // noop
        }
      }
      screenSendersRef.current.delete(remoteUserId);
    });

    if (!options?.skipRenegotiation) {
      await Promise.all(
        remoteUserIds.map((remoteUserId) =>
          createOffer(remoteUserId, { forceInitiator: true }).catch(() => undefined),
        ),
      );
    }
    updateRemotePeers();
  }

  async function startScreenShare() {
    if (!isJoinedRef.current) {
      throw new Error("먼저 음성방에 입장해야 화면을 공유할 수 있습니다.");
    }

    if (localScreenStreamRef.current) {
      return;
    }

    try {
      const screenStream = await acquireScreenStream();
      const screenTrack = getLiveVideoTrack(screenStream);
      if (!screenTrack) {
        throw new Error("화면 비디오 트랙을 가져오지 못했습니다.");
      }

      screenTrack.onended = () => {
        void stopScreenShareRef.current();
      };

      localScreenStreamRef.current = screenStream;
      setLocalScreenStream(screenStream);
      setIsScreenSharing(true);
      const resolutionLabel = formatScreenResolution(screenStream);
      setScreenShareQualityLabel(resolutionLabel);

      Array.from(peerConnectionsRef.current.entries()).forEach(([remoteUserId, peerConnection]) => {
        if (screenSendersRef.current.has(remoteUserId)) {
          return;
        }

        const sender = peerConnection.addTrack(screenTrack, screenStream);
        screenSendersRef.current.set(remoteUserId, sender);
      });

      await Promise.all(
        Array.from(peerConnectionsRef.current.keys()).map((remoteUserId) =>
          createOffer(remoteUserId, { forceInitiator: true }).catch(() => undefined),
        ),
      );
      updateRemotePeers();
      return resolutionLabel;
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "화면 공유를 시작하지 못했습니다.";
      setError(message);
      addToast({ type: "error", message });
      throw nextError;
    }
  }

  async function leaveRoom() {
    if (isCleaningUpRef.current) {
      return;
    }

    isCleaningUpRef.current = true;

    try {
      await stopScreenShare({ skipRenegotiation: true }).catch(() => undefined);

      if (isJoinedRef.current && currentUserRef.current) {
        await sendSignal.mutateAsync({
          channelId: params.channelId,
          targetUserId: null,
          signalType: "peer-left",
          data: null,
        }).catch(() => undefined);
      }

      Array.from(peerConnectionsRef.current.keys()).forEach((remoteUserId) => {
        closePeerConnection(remoteUserId);
      });
      stopLocalStream();

      if (isJoinedRef.current) {
        await leaveVoice.mutateAsync({
          channelId: params.channelId,
        }).catch(() => undefined);
      }
    } finally {
      if (isMountedRef.current) {
        params.onPresenceRefresh();
        setIsJoined(false);
        setIsMuted(false);
        setIsDeafened(false);
        setIsScreenSharing(false);
        setStatus("idle");
        setError(null);
        setRemotePeers([]);
      }
      isCleaningUpRef.current = false;
    }
  }

  async function toggleMute() {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
  }

  async function toggleDeafen() {
    setIsDeafened((previous) => !previous);
  }

  async function handleSignalEvent(event: VoiceSignalEvent) {
    if (!currentUserRef.current || !isJoinedRef.current) {
      return;
    }

    if (event.fromUserId === currentUserRef.current.id) {
      return;
    }

    if (event.targetUserId && event.targetUserId !== currentUserRef.current.id) {
      return;
    }

    if (event.signalType === "peer-left") {
      closePeerConnection(event.fromUserId);
      return;
    }

    const peerConnection = ensurePeerConnection(event.fromUserId);

    if (event.signalType === "offer") {
      const remoteDescription = event.data as RTCSessionDescriptionInit;
      if (peerConnection.signalingState !== "stable" && peerConnection.localDescription) {
        await peerConnection.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit).catch(() => undefined);
      }

      await peerConnection.setRemoteDescription(remoteDescription);
      flushPendingIceCandidates(event.fromUserId);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await sendSignal.mutateAsync({
        channelId: params.channelId,
        targetUserId: event.fromUserId,
        signalType: "answer",
        data: answer,
      });
      return;
    }

    if (event.signalType === "answer") {
      await peerConnection.setRemoteDescription(event.data as RTCSessionDescriptionInit).catch(() => undefined);
      flushPendingIceCandidates(event.fromUserId);
      return;
    }

    if (event.signalType === "ice-candidate") {
      const candidate = event.data as RTCIceCandidateInit | null;
      if (!candidate) {
        return;
      }

      if (peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(candidate).catch(() => undefined);
        return;
      }

      const queue = pendingIceCandidatesRef.current.get(event.fromUserId) ?? [];
      queue.push(candidate);
      pendingIceCandidatesRef.current.set(event.fromUserId, queue);
    }
  }

  useEffect(() => {
    currentUserRef.current = params.currentUser;
  }, [params.currentUser]);

  useEffect(() => {
    selectedAudioInputIdRef.current = selectedAudioInputId;
  }, [selectedAudioInputId]);

  useEffect(() => {
    participantsRef.current = params.participants;
    updateRemotePeers();

    if (!params.currentUser || !isJoined) {
      return;
    }

    const activeRemoteUserIds = params.participants
      .filter((participant) => participant.userId !== params.currentUser?.id)
      .map((participant) => participant.userId);

    activeRemoteUserIds.forEach((remoteUserId) => {
      ensurePeerConnection(remoteUserId);
    });

    activeRemoteUserIds.forEach((remoteUserId) => {
      void createOffer(remoteUserId).catch(() => undefined);
    });

    Array.from(peerConnectionsRef.current.keys()).forEach((remoteUserId) => {
      if (!activeRemoteUserIds.includes(remoteUserId)) {
        closePeerConnection(remoteUserId);
      }
    });
  }, [isJoined, params.currentUser, params.participants]);

  useEffect(() => {
    isJoinedRef.current = isJoined;
  }, [isJoined]);

  useEffect(() => {
    if (voiceConfigQuery.data) {
      configRef.current = voiceConfigQuery.data;
    }
  }, [voiceConfigQuery.data]);

  useEffect(() => {
    void refreshAudioInputs();

    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) {
      return;
    }

    const handleDeviceChange = () => {
      void refreshAudioInputs();
    };

    mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, []);

  useEffect(() => {
    leaveRoomRef.current = leaveRoom;
  }, [leaveRoom]);

  useEffect(() => {
    stopScreenShareRef.current = stopScreenShare;
  }, [stopScreenShare]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      void leaveRoomRef.current();
    };
  }, []);

  return {
    status,
    error,
    isMuted,
    isDeafened,
    isJoined,
    isScreenSharing,
    localScreenStream,
    screenShareQualityLabel,
    remotePeers,
    availableAudioInputs,
    selectedAudioInputId,
    connectedPeerCount: remotePeers.filter((peer) => peer.connectionState === "connected").length,
    joinRoom,
    leaveRoom,
    toggleMute,
    toggleDeafen,
    switchAudioInput,
    refreshAudioInputs,
    startScreenShare,
    stopScreenShare,
    handleSignalEvent,
  };
}
