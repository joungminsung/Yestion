"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSidebarStore } from "@/stores/sidebar";
import { usePresenceStore, type PresenceUser } from "@/stores/presence";
import { trpc } from "@/server/trpc/client";
import { ShareDialog } from "@/components/share/share-dialog";
import { CommentPanel } from "@/components/comments/comment-panel";
import { NotificationPanel } from "@/components/notifications/notification-panel";

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const MAX_VISIBLE_AVATARS = 5;

function PresenceAvatars({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) return null;
  const visible = users.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = users.length - MAX_VISIBLE_AVATARS;

  return (
    <div className="flex items-center -space-x-1.5 mr-2">
      {visible.map((u) => (
        <div
          key={u.id}
          title={u.name}
          className="flex items-center justify-center rounded-full text-white text-[10px] font-semibold"
          style={{
            width: 24,
            height: 24,
            backgroundColor: u.color,
            boxShadow: "0 0 0 2px var(--bg-primary)",
          }}
        >
          {getInitials(u.name)}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="flex items-center justify-center rounded-full text-[10px] font-semibold"
          style={{
            width: 24,
            height: 24,
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-secondary)",
            boxShadow: "0 0 0 2px var(--bg-primary)",
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const { isOpen, toggle } = useSidebarStore();
  const presenceUsers = usePresenceStore((s) => s.users);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const params = useParams();
  const pageId = params.pageId as string | undefined;
  const workspaceId = params.workspaceId as string | undefined;

  const { data: user } = trpc.user.me.useQuery();
  const { data: unreadCount } = trpc.notification.count.useQuery(undefined, { refetchInterval: 30000 });

  const { data: ancestors } = trpc.page.getAncestors.useQuery(
    { id: pageId! },
    { enabled: !!pageId },
  );

  // Full breadcrumb from ancestors (root -> ... -> current page)
  const crumbs: { id: string; title: string | null; icon: string | null }[] =
    ancestors?.map((a) => ({ id: a.id, title: a.title, icon: a.icon })) ?? [];

  const handleExport = (format: "md" | "html") => {
    if (!pageId) return;
    const url = `/api/export?pageId=${pageId}&format=${format}`;
    window.open(url, "_blank");
    setExportMenuOpen(false);
  };

  return (
    <header
      className="sticky top-0 flex items-center justify-between px-3"
      style={{
        height: "var(--topbar-height)",
        zIndex: "var(--z-topbar)",
        backgroundColor: "var(--bg-primary)",
        fontSize: "14px",
      }}
    >
      <div className="flex items-center gap-1 min-w-0">
        {!isOpen && (
          <button
            onClick={toggle}
            className="p-1 rounded hover:bg-notion-bg-hover flex-shrink-0"
            style={{ color: "var(--text-secondary)" }}
            title="Open sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3h12v1.5H2V3zm0 4.25h12v1.5H2v-1.5zm0 4.25h12V13H2v-1.5z" />
            </svg>
          </button>
        )}
        <div className="flex items-center gap-1 px-1 min-w-0">
          {crumbs.length > 0 ? (
            crumbs.map((crumb, i) => (
              <span key={crumb.id} className="flex items-center gap-1 min-w-0">
                {i > 0 && (
                  <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>/</span>
                )}
                {i < crumbs.length - 1 ? (
                  <Link
                    href={`/${workspaceId}/${crumb.id}`}
                    className="truncate hover:underline"
                    style={{
                      color: "var(--text-secondary)",
                      maxWidth: "150px",
                    }}
                  >
                    {crumb.icon && <span className="mr-1">{crumb.icon}</span>}
                    {crumb.title || "제목 없음"}
                  </Link>
                ) : (
                  <span
                    className="truncate"
                    style={{
                      color: "var(--text-primary)",
                      fontWeight: 500,
                      maxWidth: "250px",
                    }}
                  >
                    {crumb.icon && <span className="mr-1">{crumb.icon}</span>}
                    {crumb.title || "제목 없음"}
                  </span>
                )}
              </span>
            ))
          ) : (
            <span style={{ color: "var(--text-secondary)" }}>
              {pageId ? "..." : ""}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        <PresenceAvatars users={presenceUsers} />

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setNotificationOpen(!notificationOpen)}
            className="p-1.5 rounded hover:bg-notion-bg-hover relative"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1.5A3.5 3.5 0 004.5 5v2.947l-.724 1.45A1 1 0 004.67 11h2.08a1.25 1.25 0 002.5 0h2.08a1 1 0 00.894-1.553L11.5 7.947V5A3.5 3.5 0 008 1.5z" />
            </svg>
            {(unreadCount?.unread ?? 0) > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-white text-[10px] font-bold px-1"
                style={{ backgroundColor: "#eb5757" }}
              >
                {unreadCount!.unread > 99 ? "99+" : unreadCount!.unread}
              </span>
            )}
          </button>
          {notificationOpen && (
            <NotificationPanel onClose={() => setNotificationOpen(false)} />
          )}
        </div>

        <button
          onClick={() => pageId && setShareOpen(true)}
          className="px-3 py-1 rounded hover:bg-notion-bg-hover text-sm"
          style={{ color: "var(--text-secondary)" }}
          disabled={!pageId}
        >
          공유
        </button>
        {shareOpen && pageId && (
          <ShareDialog pageId={pageId} onClose={() => setShareOpen(false)} />
        )}

        {/* Comment button */}
        <button
          onClick={() => pageId && setCommentOpen(!commentOpen)}
          className="p-1.5 rounded hover:bg-notion-bg-hover"
          style={{ color: commentOpen ? "var(--accent-blue)" : "var(--text-secondary)" }}
          disabled={!pageId}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.32 15.424l4.644-2.432a.5.5 0 01.235-.059h3.3A2.5 2.5 0 0015 10.433V5.5A2.5 2.5 0 0012.5 3h-9A2.5 2.5 0 001 5.5v4.933a2.5 2.5 0 002.5 2.5h.32a.5.5 0 01.5.5v1.991z" />
          </svg>
        </button>

        {/* More menu (with export) */}
        <div className="relative">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="p-1.5 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 8a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm4.5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM12 6.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
            </svg>
          </button>
          {exportMenuOpen && (
            <>
              <div className="fixed inset-0" style={{ zIndex: 80 }} onClick={() => setExportMenuOpen(false)} />
              <div
                className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden py-1"
                style={{
                  width: "220px",
                  zIndex: 81,
                  backgroundColor: "var(--bg-primary)",
                  boxShadow: "var(--shadow-popup)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <button
                  onClick={() => handleExport("md")}
                  disabled={!pageId}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-notion-bg-hover text-left"
                  style={{ color: pageId ? "var(--text-primary)" : "var(--text-tertiary)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path d="M3 2a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V6.414A1 1 0 0013.707 6L10 2.293A1 1 0 009.586 2H3z" />
                  </svg>
                  Markdown으로 내보내기
                </button>
                <button
                  onClick={() => handleExport("html")}
                  disabled={!pageId}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-notion-bg-hover text-left"
                  style={{ color: pageId ? "var(--text-primary)" : "var(--text-tertiary)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path d="M3 2a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V6.414A1 1 0 0013.707 6L10 2.293A1 1 0 009.586 2H3z" />
                  </svg>
                  HTML로 내보내기
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Comment panel */}
      {commentOpen && pageId && user && (
        <CommentPanel
          pageId={pageId}
          currentUserId={user.id}
          onClose={() => setCommentOpen(false)}
        />
      )}
    </header>
  );
}
