"use client";

import { usePathname, useRouter } from "next/navigation";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { useVoiceConnectionStore } from "@/stores/voice-connection";

/**
 * Floating mini-bar shown when the user is in a voice channel but has
 * navigated away to a different page.  Discord-style bottom bar.
 */
export function VoiceMiniBar() {
  const router = useRouter();
  const pathname = usePathname();

  const channelId = useVoiceConnectionStore((s) => s.channelId);
  const channelName = useVoiceConnectionStore((s) => s.channelName);
  const workspaceId = useVoiceConnectionStore((s) => s.workspaceId);
  const isJoined = useVoiceConnectionStore((s) => s.isJoined);
  const isMuted = useVoiceConnectionStore((s) => s.isMuted);
  const isDeafened = useVoiceConnectionStore((s) => s.isDeafened);
  const connectedPeerCount = useVoiceConnectionStore((s) => s.connectedPeerCount);
  const toggleMute = useVoiceConnectionStore((s) => s.toggleMute);
  const toggleDeafen = useVoiceConnectionStore((s) => s.toggleDeafen);
  const leaveRoom = useVoiceConnectionStore((s) => s.leaveRoom);

  if (!isJoined || !channelId || !workspaceId) return null;

  // Don't show if user is already viewing the voice channel page
  const channelPath = `/${workspaceId}/channels/${channelId}`;
  if (pathname === channelPath) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 shadow-lg"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.12)",
      }}
    >
      {/* Connection indicator */}
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: "#16a34a" }}
      />

      {/* Channel info — click to navigate */}
      <button
        onClick={() => router.push(channelPath)}
        className="flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: "var(--text-primary)" }}
      >
        <Volume2 size={14} style={{ color: "var(--text-tertiary)" }} />
        <span className="max-w-[120px] truncate">{channelName ?? "음성 채널"}</span>
        {connectedPeerCount > 0 && (
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            +{connectedPeerCount}
          </span>
        )}
      </button>

      {/* Divider */}
      <div className="h-5 w-px" style={{ backgroundColor: "var(--border-default)" }} />

      {/* Controls */}
      <button
        onClick={toggleMute}
        className="rounded-full p-1.5 transition-colors hover:bg-[var(--bg-secondary)]"
        style={{ color: isMuted ? "#e03e3e" : "var(--text-secondary)" }}
        title={isMuted ? "음소거 해제" : "음소거"}
      >
        {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
      </button>

      <button
        onClick={toggleDeafen}
        className="rounded-full p-1.5 transition-colors hover:bg-[var(--bg-secondary)]"
        style={{ color: isDeafened ? "#e03e3e" : "var(--text-secondary)" }}
        title={isDeafened ? "스피커 켜기" : "스피커 끄기"}
      >
        {isDeafened ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>

      <button
        onClick={() => void leaveRoom()}
        className="rounded-full p-1.5 transition-colors hover:bg-red-50"
        style={{ color: "#e03e3e" }}
        title="나가기"
      >
        <PhoneOff size={16} />
      </button>
    </div>
  );
}
