"use client";

import { usePresenceStore } from "@/stores/presence";
import { Eye, X } from "lucide-react";

export function FollowModeBanner() {
  const followingUserId = usePresenceStore((s) => s.followingUserId);
  const users = usePresenceStore((s) => s.users);
  const setFollowing = usePresenceStore((s) => s.setFollowing);

  if (!followingUserId) return null;

  const followedUser = users.find((u) => u.id === followingUserId);
  if (!followedUser) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 py-1.5 text-xs font-medium"
      style={{
        backgroundColor: followedUser.color,
        color: "#fff",
      }}
    >
      <Eye size={14} />
      <span>Following {followedUser.name}&apos;s view</span>
      <button
        onClick={() => setFollowing(null)}
        className="p-0.5 rounded hover:bg-white/20 ml-1"
      >
        <X size={12} />
      </button>
    </div>
  );
}
