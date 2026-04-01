"use client";

import { useState, useMemo, type ReactNode } from "react";
import { useRouter, useParams } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { AtSign, MessageCircle, Hand, Link, Bell } from "lucide-react";

function formatTime(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function getTypeIcon(type: string): ReactNode {
  switch (type) {
    case "mention": return <AtSign size={16} />;
    case "comment": return <MessageCircle size={16} />;
    case "invite": return <Hand size={16} />;
    case "share": return <Link size={16} />;
    default: return <Bell size={16} />;
  }
}

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string | undefined;

  const [activeTab, setActiveTab] = useState<"all" | "unread" | "mentions">("all");

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.notification.list.useQuery({});
  const { data: countData } = trpc.notification.count.useQuery();
  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.count.invalidate();
    },
  });
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.count.invalidate();
    },
  });

  const notifications = data?.items ?? [];
  const unreadCount = countData ?? notifications.filter((n) => !n.read).length;

  const filteredNotifications = useMemo(() => {
    switch (activeTab) {
      case "unread": return notifications.filter((n) => !n.read);
      case "mentions": return notifications.filter((n) => n.type === "mention");
      default: return notifications;
    }
  }, [notifications, activeTab]);

  const grouped = useMemo(() => {
    const today: typeof filteredNotifications = [];
    const earlier: typeof filteredNotifications = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const n of filteredNotifications) {
      if (new Date(n.createdAt) >= todayStart) {
        today.push(n);
      } else {
        earlier.push(n);
      }
    }
    return { today, earlier };
  }, [filteredNotifications]);

  const handleClick = (notification: { id: string; pageId: string | null; read: boolean }) => {
    if (!notification.read) {
      markRead.mutate({ id: notification.id });
    }
    if (notification.pageId && workspaceId) {
      router.push(`/${workspaceId}/${notification.pageId}`);
      onClose();
    }
  };

  const renderNotification = (notification: typeof notifications[number]) => (
    <button
      key={notification.id}
      onClick={() => handleClick(notification)}
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-notion-bg-hover text-left"
      style={{
        borderBottom: "1px solid var(--border-default)",
        backgroundColor: notification.read ? "transparent" : "var(--bg-secondary)",
      }}
    >
      <span className="flex-shrink-0 mt-0.5">
        {getTypeIcon(notification.type)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-sm truncate"
            style={{
              color: "var(--text-primary)",
              fontWeight: notification.read ? 400 : 600,
            }}
          >
            {notification.title}
          </span>
          {!notification.read && (
            <span
              className="flex-shrink-0 w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--accent-blue)" }}
            />
          )}
        </div>
        {notification.message && (
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
            {notification.message}
          </p>
        )}
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {formatTime(notification.createdAt)}
        </span>
      </div>
    </button>
  );

  return (
    <>
      <div className="fixed inset-0" style={{ zIndex: 90 }} onClick={onClose} />
      <div
        className="fixed rounded-lg overflow-hidden flex flex-col"
        style={{
          top: "44px",
          right: "12px",
          width: "380px",
          maxHeight: "480px",
          zIndex: 91,
          backgroundColor: "var(--bg-primary)",
          boxShadow: "var(--shadow-popup)",
          border: "1px solid var(--border-default)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
            알림
          </h3>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs hover:underline"
              style={{ color: "var(--accent-blue)" }}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 py-1 border-b flex-shrink-0" style={{ borderColor: "var(--border-default)" }}>
          {(["all", "unread", "mentions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-3 py-1 text-xs rounded-md transition-colors"
              style={{
                color: activeTab === tab ? "var(--text-primary)" : "var(--text-tertiary)",
                backgroundColor: activeTab === tab ? "var(--bg-hover)" : undefined,
                fontWeight: activeTab === tab ? 500 : 400,
              }}
            >
              {tab === "all"
                ? "All"
                : tab === "unread"
                ? `Unread${unreadCount ? ` (${unreadCount})` : ""}`
                : "Mentions"}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
              로딩 중...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
              알림이 없습니다
            </div>
          ) : (
            <>
              {grouped.today.length > 0 && (
                <>
                  <div className="px-3 py-1 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                    Today
                  </div>
                  {grouped.today.map(renderNotification)}
                </>
              )}
              {grouped.earlier.length > 0 && (
                <>
                  <div className="px-3 py-1 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                    Earlier
                  </div>
                  {grouped.earlier.map(renderNotification)}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
