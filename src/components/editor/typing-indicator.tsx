"use client";

import { useEffect, useState } from "react";
import { usePresenceStore } from "@/stores/presence";

export function TypingIndicator() {
  const users = usePresenceStore((s) => s.users);
  const [visible, setVisible] = useState(false);

  const typingUsers = users.filter((u) => u.isTyping);

  // Auto-clear stale typing states (3s timeout)
  useEffect(() => {
    if (typingUsers.length === 0) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const interval = setInterval(() => {
      const now = Date.now();
      const stillTyping = typingUsers.some(
        (u) => u.lastTypingAt && now - u.lastTypingAt < 3000,
      );
      if (!stillTyping) {
        setVisible(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [typingUsers]);

  if (!visible || typingUsers.length === 0) return null;

  const names = typingUsers.map((u) => u.name);
  let label: string;
  if (names.length === 1) {
    label = `${names[0]} is typing`;
  } else if (names.length === 2) {
    label = `${names[0]} and ${names[1]} are typing`;
  } else {
    label = `${names[0]} and ${names.length - 1} others are typing`;
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-xs"
      style={{ color: "var(--text-tertiary)" }}
    >
      <span className="flex gap-0.5">
        {typingUsers.slice(0, 3).map((u) => (
          <span
            key={u.id}
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: u.color }}
          />
        ))}
      </span>
      <span>{label}</span>
      <span className="typing-dots">
        <span className="animate-pulse">.</span>
        <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>.</span>
        <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>.</span>
      </span>
    </div>
  );
}
