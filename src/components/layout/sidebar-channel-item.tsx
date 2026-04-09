"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hash, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarChannelItemProps = {
  workspaceId: string;
  channel: {
    id: string;
    name: string;
    type: string;
    activeVoiceParticipantCount?: number;
    unreadMessageCount?: number;
  };
  depth?: number;
};

export function SidebarChannelItem({
  workspaceId,
  channel,
  depth = 0,
}: SidebarChannelItemProps) {
  const pathname = usePathname();
  const href = `/${workspaceId}/channels/${channel.id}`;
  const isActive = pathname === href;
  const Icon = channel.type === "voice" ? Volume2 : Hash;

  return (
    <Link
      href={href}
      onClick={() => window.dispatchEvent(new CustomEvent("channel:close-stream"))}
      className={cn(
        "group flex w-full items-center gap-2 rounded-sm py-[2px] pr-2 text-left hover:bg-notion-bg-hover",
        isActive && "bg-notion-bg-hover",
      )}
      style={{
        paddingLeft: `${12 + depth * 16}px`,
        minHeight: "28px",
        color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
      }}
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded"
        style={{ color: "var(--text-tertiary)" }}
      >
        <Icon size={14} />
      </span>
      <span className="truncate text-sm">{channel.name}</span>
      {(channel.unreadMessageCount ?? 0) > 0 && (
        <span
          className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor: "rgba(35, 131, 226, 0.12)",
            color: "#2383e2",
          }}
        >
          {Math.min(channel.unreadMessageCount ?? 0, 99)}
        </span>
      )}
      {channel.type === "voice" && (channel.activeVoiceParticipantCount ?? 0) > 0 && (
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px]"
          style={{
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-tertiary)",
          }}
        >
          {channel.activeVoiceParticipantCount}
        </span>
      )}
    </Link>
  );
}
