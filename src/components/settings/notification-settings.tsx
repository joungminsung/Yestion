"use client";

import { useState } from "react";
import { Bell, MessageSquare, AtSign, Share2, UserPlus, ListChecks } from "lucide-react";
import { useToastStore } from "@/stores/toast";

type NotificationType = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  inApp: boolean;
  email: boolean;
};

const DEFAULT_PREFS: NotificationType[] = [
  { id: "mention", label: "Mentions", description: "When someone @mentions you", icon: <AtSign size={16} />, inApp: true, email: true },
  { id: "comment", label: "Comments", description: "New comments on your pages", icon: <MessageSquare size={16} />, inApp: true, email: false },
  { id: "comment_reply", label: "Replies", description: "Replies to your comments", icon: <MessageSquare size={16} />, inApp: true, email: true },
  { id: "share", label: "Shares", description: "When someone shares a page with you", icon: <Share2 size={16} />, inApp: true, email: true },
  { id: "invite", label: "Invitations", description: "Workspace invitations", icon: <UserPlus size={16} />, inApp: true, email: true },
  { id: "task_assigned", label: "Task assigned", description: "When a task is assigned to you", icon: <ListChecks size={16} />, inApp: true, email: true },
  { id: "page_updated", label: "Page updates", description: "Updates to pages you watch", icon: <Bell size={16} />, inApp: false, email: false },
];

const STORAGE_KEY = "notion-notification-prefs";

function loadPrefs(): NotificationType[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, { inApp: boolean; email: boolean }>;
      return DEFAULT_PREFS.map((p) => ({
        ...p,
        inApp: parsed[p.id]?.inApp ?? p.inApp,
        email: parsed[p.id]?.email ?? p.email,
      }));
    }
  } catch {}
  return DEFAULT_PREFS;
}

function savePrefs(prefs: NotificationType[]) {
  try {
    const data: Record<string, { inApp: boolean; email: boolean }> = {};
    for (const p of prefs) {
      data[p.id] = { inApp: p.inApp, email: p.email };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationType[]>(loadPrefs);
  const addToast = useToastStore((s) => s.addToast);

  const toggle = (id: string, field: "inApp" | "email") => {
    const updated = prefs.map((p) =>
      p.id === id ? { ...p, [field]: !p[field] } : p
    );
    setPrefs(updated);
    savePrefs(updated);
    addToast({ message: "Notification preferences updated", type: "success" });
  };

  return (
    <div>
      <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>
        Notifications
      </h3>
      <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
        Choose which notifications you receive in-app and via email.
      </p>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-default)" }}>
        {/* Header */}
        <div
          className="grid grid-cols-[1fr_80px_80px] px-4 py-2 text-xs font-medium border-b"
          style={{ borderColor: "var(--border-default)", color: "var(--text-tertiary)", backgroundColor: "var(--bg-secondary)" }}
        >
          <span>Type</span>
          <span className="text-center">In-App</span>
          <span className="text-center">Email</span>
        </div>

        {/* Rows */}
        {prefs.map((pref) => (
          <div
            key={pref.id}
            className="grid grid-cols-[1fr_80px_80px] px-4 py-3 items-center border-b last:border-b-0"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div className="flex items-center gap-3">
              <span style={{ color: "var(--text-tertiary)" }}>{pref.icon}</span>
              <div>
                <div className="text-sm" style={{ color: "var(--text-primary)" }}>{pref.label}</div>
                <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{pref.description}</div>
              </div>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => toggle(pref.id, "inApp")}
                className="w-9 h-5 rounded-full transition-colors relative"
                style={{
                  backgroundColor: pref.inApp ? "var(--accent-blue)" : "var(--bg-active)",
                }}
                role="switch"
                aria-checked={pref.inApp}
                aria-label={`${pref.label} in-app notifications`}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                  style={{ transform: pref.inApp ? "translateX(18px)" : "translateX(2px)" }}
                />
              </button>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => toggle(pref.id, "email")}
                className="w-9 h-5 rounded-full transition-colors relative"
                style={{
                  backgroundColor: pref.email ? "var(--accent-blue)" : "var(--bg-active)",
                }}
                role="switch"
                aria-checked={pref.email}
                aria-label={`${pref.label} email notifications`}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                  style={{ transform: pref.email ? "translateX(18px)" : "translateX(2px)" }}
                />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
