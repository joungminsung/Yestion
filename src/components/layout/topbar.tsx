"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useSidebarStore } from "@/stores/sidebar";
import { usePresenceStore, type PresenceUser } from "@/stores/presence";
import { useNavigationStore } from "@/stores/navigation-history";
import { trpc } from "@/server/trpc/client";
import { ShareDialog } from "@/components/share/share-dialog";
import { CommentPanel } from "@/components/comments/comment-panel";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { ActivityPanel } from "@/components/activity/activity-panel";
import { HistoryPanel } from "@/components/page/history-panel";
import { markdownToBlocks } from "@/lib/markdown-import";
import { useToastStore } from "@/stores/toast";

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

/* ── Breadcrumb Child Dropdown (2.8) ── */
function ChildDropdown({
  pageId,
  workspaceId,
  onClose,
}: {
  pageId: string;
  workspaceId: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { data: flatPages } = trpc.page.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const children = flatPages?.filter((p) => p.parentId === pageId) ?? [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 rounded-lg overflow-hidden py-1 dropdown-enter"
      style={{
        width: "200px",
        zIndex: 90,
        backgroundColor: "var(--bg-primary)",
        boxShadow: "var(--shadow-popup)",
        border: "1px solid var(--border-default)",
      }}
    >
      {children.length === 0 ? (
        <div
          className="px-3 py-2 text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          하위 페이지 없음
        </div>
      ) : (
        children.map((child) => (
          <Link
            key={child.id}
            href={`/${workspaceId}/${child.id}`}
            onClick={onClose}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-notion-bg-hover text-left"
            style={{ color: "var(--text-primary)" }}
          >
            <span className="flex-shrink-0">
              {child.icon || "📄"}
            </span>
            <span className="truncate">{child.title || "제목 없음"}</span>
          </Link>
        ))
      )}
    </div>
  );
}

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, toggle } = useSidebarStore();
  const presenceUsers = usePresenceStore((s) => s.users);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const addToast = useToastStore((s) => s.addToast);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const params = useParams();
  const pageId = params.pageId as string | undefined;
  const workspaceId = params.workspaceId as string | undefined;

  /* ── Navigation history (2.15) ── */
  const navStore = useNavigationStore();

  // Track page visits
  useEffect(() => {
    if (pathname) {
      navStore.push(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Alt+Arrow keyboard shortcuts for back/forward
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        const url = navStore.goBack();
        if (url) router.push(url);
      }
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        const url = navStore.goForward();
        if (url) router.push(url);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navStore, router]);

  const { data: user } = trpc.user.me.useQuery();
  const { data: unreadCount } = trpc.notification.count.useQuery(undefined, { refetchInterval: 30000 });

  const { data: ancestors } = trpc.page.getAncestors.useQuery(
    { id: pageId! },
    { enabled: !!pageId },
  );

  const { data: currentPage } = trpc.page.get.useQuery(
    { id: pageId! },
    { enabled: !!pageId },
  );

  const crumbs: { id: string; title: string | null; icon: string | null }[] =
    ancestors?.map((a) => ({ id: a.id, title: a.title, icon: a.icon })) ?? [];

  /* ── tRPC mutations for More Menu (2.12) ── */
  const utils = trpc.useUtils();

  const updatePage = trpc.page.update.useMutation({
    onSuccess: () => utils.page.get.invalidate(),
  });
  const duplicatePage = trpc.page.duplicate.useMutation({
    onSuccess: () => utils.page.list.invalidate(),
  });
  const addFavorite = trpc.page.addFavorite.useMutation({
    onSuccess: () => utils.page.listFavorites.invalidate(),
  });
  const removeFavorite = trpc.page.removeFavorite.useMutation({
    onSuccess: () => utils.page.listFavorites.invalidate(),
  });
  const moveToTrash = trpc.page.moveToTrash.useMutation({
    onSuccess: () => {
      utils.page.list.invalidate();
      if (workspaceId) router.push(`/${workspaceId}`);
    },
  });

  const handleExport = (format: "md" | "html") => {
    if (!pageId) return;
    const url = `/api/export?pageId=${pageId}&format=${format}`;
    window.open(url, "_blank");
    setShowMoreMenu(false);
  };

  const importBlocks = trpc.block.bulkSave.useMutation({
    onSuccess: () => {
      addToast({ message: "Markdown 가져오기 완료", type: "success" });
      utils.block.list.invalidate();
      utils.page.get.invalidate();
    },
    onError: () => {
      addToast({ message: "가져오기에 실패했습니다", type: "error" });
    },
  });

  const handleMarkdownImport = () => {
    if (!pageId) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,.txt";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const blocks = markdownToBlocks(text);
      // Convert to the format bulkSave expects
      const blockData = blocks.map((block, idx) => ({
        id: `import-${Date.now()}-${idx}`,
        type: block.type,
        content: {
          ...block,
        },
        position: idx,
        parentId: null,
      }));
      importBlocks.mutate({ pageId, blocks: blockData });
    };
    input.click();
    setShowMoreMenu(false);
  };

  // Click outside to close more menu
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMoreMenu]);

  const isLocked = currentPage?.isLocked ?? false;
  const isFullWidth = currentPage?.isFullWidth ?? false;

  type MenuItem =
    | { label: string; action: () => void; danger?: boolean; divider?: false }
    | { divider: true; label?: never; action?: never; danger?: never };

  const moreMenuItems: MenuItem[] = [
    {
      label: `${isLocked ? "🔓 잠금 해제" : "🔒 잠금"}`,
      action: () => {
        if (pageId) updatePage.mutate({ id: pageId, isLocked: !isLocked });
        setShowMoreMenu(false);
      },
    },
    {
      label: `${isFullWidth ? "↔ 기본 너비" : "↔ 전체 너비"}`,
      action: () => {
        if (pageId) updatePage.mutate({ id: pageId, isFullWidth: !isFullWidth });
        setShowMoreMenu(false);
      },
    },
    {
      label: "⭐ 즐겨찾기 추가",
      action: () => {
        if (pageId) addFavorite.mutate({ pageId });
        setShowMoreMenu(false);
      },
    },
    {
      label: "⭐ 즐겨찾기 해제",
      action: () => {
        if (pageId) removeFavorite.mutate({ pageId });
        setShowMoreMenu(false);
      },
    },
    {
      label: "📋 복제",
      action: () => {
        if (pageId) duplicatePage.mutate({ id: pageId });
        setShowMoreMenu(false);
      },
    },
    { divider: true },
    {
      label: "📤 Markdown 내보내기",
      action: () => handleExport("md"),
    },
    {
      label: "📤 HTML 내보내기",
      action: () => handleExport("html"),
    },
    {
      label: "📥 Markdown 가져오기",
      action: handleMarkdownImport,
    },
    { divider: true },
    {
      label: "🕐 히스토리",
      action: () => {
        setHistoryOpen(true);
        setShowMoreMenu(false);
      },
    },
    {
      label: "📊 활동",
      action: () => {
        setActivityOpen(true);
        setShowMoreMenu(false);
      },
    },
    { divider: true },
    {
      label: "🗑 삭제",
      action: () => {
        if (pageId) moveToTrash.mutate({ id: pageId });
        setShowMoreMenu(false);
      },
      danger: true,
    },
  ];

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

        {/* Back/Forward buttons (2.15) */}
        <button
          onClick={() => {
            const url = navStore.goBack();
            if (url) router.push(url);
          }}
          disabled={!navStore.canGoBack()}
          className="p-1 rounded hover:bg-notion-bg-hover disabled:opacity-30 flex-shrink-0"
          style={{ color: "var(--text-secondary)" }}
          title="뒤로 (Alt+←)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M10.354 3.354a.5.5 0 00-.708-.708l-5 5a.5.5 0 000 .708l5 5a.5.5 0 00.708-.708L5.707 8l4.647-4.646z" />
          </svg>
        </button>
        <button
          onClick={() => {
            const url = navStore.goForward();
            if (url) router.push(url);
          }}
          disabled={!navStore.canGoForward()}
          className="p-1 rounded hover:bg-notion-bg-hover disabled:opacity-30 flex-shrink-0"
          style={{ color: "var(--text-secondary)" }}
          title="앞으로 (Alt+→)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.646 3.354a.5.5 0 01.708-.708l5 5a.5.5 0 010 .708l-5 5a.5.5 0 01-.708-.708L10.293 8 5.646 3.354z" />
          </svg>
        </button>

        {/* Breadcrumbs with child dropdown (2.8) */}
        <div className="flex items-center gap-1 px-1 min-w-0">
          {crumbs.length > 0 ? (
            crumbs.map((crumb, i) => (
              <span key={crumb.id} className="relative flex items-center gap-0.5 min-w-0">
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
                {/* Child dropdown toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDropdown(crumb.id === openDropdown ? null : crumb.id);
                  }}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-notion-bg-hover"
                  style={{ color: "var(--text-tertiary)", fontSize: "10px", lineHeight: 1 }}
                >
                  ▼
                </button>
                {openDropdown === crumb.id && workspaceId && (
                  <ChildDropdown
                    pageId={crumb.id}
                    workspaceId={workspaceId}
                    onClose={() => setOpenDropdown(null)}
                  />
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

        {/* More menu (2.12) */}
        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-1.5 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 8a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm4.5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM12 6.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
            </svg>
          </button>
          {showMoreMenu && (
            <>
              <div className="fixed inset-0" style={{ zIndex: 80 }} onClick={() => setShowMoreMenu(false)} />
              <div
                className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden py-1 dropdown-enter"
                style={{
                  width: "240px",
                  zIndex: 81,
                  backgroundColor: "var(--bg-primary)",
                  boxShadow: "var(--shadow-popup)",
                  border: "1px solid var(--border-default)",
                }}
              >
                {moreMenuItems.map((item, idx) =>
                  item.divider ? (
                    <div
                      key={`divider-${idx}`}
                      className="mx-2 my-1"
                      style={{ height: "1px", backgroundColor: "var(--border-divider)" }}
                    />
                  ) : (
                    <button
                      key={item.label}
                      onClick={item.action}
                      disabled={!pageId}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-notion-bg-hover text-left"
                      style={{
                        color: !pageId
                          ? "var(--text-tertiary)"
                          : item.danger
                            ? "#eb5757"
                            : "var(--text-primary)",
                      }}
                    >
                      {item.label}
                    </button>
                  )
                )}
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

      {/* Activity panel */}
      {activityOpen && pageId && (
        <ActivityPanel pageId={pageId} onClose={() => setActivityOpen(false)} />
      )}

      {/* History panel */}
      {historyOpen && pageId && (
        <HistoryPanel pageId={pageId} onClose={() => setHistoryOpen(false)} />
      )}
    </header>
  );
}
