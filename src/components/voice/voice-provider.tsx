"use client";

import { useEffect, useRef, useCallback } from "react";
import { trpc } from "@/server/trpc/client";
import { setVoiceApiCaller, useVoiceConnectionStore } from "@/stores/voice-connection";

/**
 * Layout-level provider that bridges the global voice store with tRPC.
 *
 * - Registers tRPC mutation callers so the Zustand store can call the server
 * - Maintains a dedicated SSE connection for voice signaling when joined
 * - Runs the heartbeat interval while joined
 * - Listens for audio device changes
 */
export function VoiceProvider() {
  const utils = trpc.useUtils();

  const joinVoiceMut = trpc.channel.joinVoice.useMutation();
  const leaveVoiceMut = trpc.channel.leaveVoice.useMutation();
  const heartbeatMut = trpc.channel.heartbeatVoice.useMutation();
  const sendSignalMut = trpc.channel.sendSignal.useMutation();
  const setScreenShareStateMut = trpc.channel.setScreenShareState.useMutation();

  const channelId = useVoiceConnectionStore((s) => s.channelId);
  const isJoined = useVoiceConnectionStore((s) => s.isJoined);
  const currentUser = useVoiceConnectionStore((s) => s._currentUser);
  const handleSignalEvent = useVoiceConnectionStore((s) => s.handleSignalEvent);

  // Stable refs for the signal handler and heartbeat
  const handleSignalRef = useRef(handleSignalEvent);
  handleSignalRef.current = handleSignalEvent;
  const heartbeatRef = useRef(heartbeatMut);
  heartbeatRef.current = heartbeatMut;

  // Register tRPC callers once
  useEffect(() => {
    setVoiceApiCaller({
      joinVoice: async (params) => { await joinVoiceMut.mutateAsync(params); },
      leaveVoice: async (params) => { await leaveVoiceMut.mutateAsync(params); },
      heartbeatVoice: async (params) => { await heartbeatMut.mutateAsync(params); },
      sendSignal: async (params) => { await sendSignalMut.mutateAsync(params); },
      getVoiceConfig: async (params) => {
        const data = await utils.channel.getVoiceConfig.fetch(params);
        return data;
      },
      setScreenShareState: async (params) => {
        await setScreenShareStateMut.mutateAsync(params);
        if (params.channelId) {
          void utils.channel.get.invalidate({ id: params.channelId });
        }
      },
      onPresenceRefresh: () => {
        const cid = useVoiceConnectionStore.getState().channelId;
        if (cid) void utils.channel.get.invalidate({ id: cid });
      },
    });

    return () => { setVoiceApiCaller(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE connection for voice signaling (only while joined)
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!isJoined || !channelId) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Don't create a new connection if we already have one for this channel
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/channels/stream?channelId=${channelId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { kind: string; payload: unknown };

        if (parsed.kind === "voice.signal") {
          void handleSignalRef.current(parsed.payload as Parameters<typeof handleSignalRef.current>[0]);
          return;
        }

        if (parsed.kind === "voice.presence.updated") {
          void utils.channel.get.invalidate({ id: channelId });
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      void utils.channel.get.invalidate({ id: channelId });
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [isJoined, channelId, utils]);

  // Heartbeat while joined
  useEffect(() => {
    if (!isJoined || !channelId) return;

    const interval = setInterval(() => {
      const user = useVoiceConnectionStore.getState()._currentUser;
      heartbeatRef.current.mutate({
        channelId,
        displayName: user?.name,
      });
    }, 10_000);

    return () => clearInterval(interval);
  }, [isJoined, channelId]);

  // Audio device change listener
  useEffect(() => {
    const refreshAudioInputs = useVoiceConnectionStore.getState().refreshAudioInputs;
    void refreshAudioInputs();

    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;

    const handle = () => void refreshAudioInputs();
    md.addEventListener("devicechange", handle);
    return () => md.removeEventListener("devicechange", handle);
  }, []);

  // Clean up on unmount (page close)
  const leaveRoom = useVoiceConnectionStore((s) => s.leaveRoom);
  const leaveRoomRef = useRef(leaveRoom);
  leaveRoomRef.current = leaveRoom;

  useEffect(() => {
    const handleBeforeUnload = () => {
      // Fire-and-forget leave on page close
      void leaveRoomRef.current();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return null;
}
