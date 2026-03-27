"use client";

import { trpc } from "@/server/trpc/client";

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

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

const ACTION_LABELS: Record<string, string> = {
  edit: "페이지를 수정했습니다",
  comment: "댓글을 남겼습니다",
  share: "페이지를 공유했습니다",
  delete: "페이지를 삭제했습니다",
  restore: "페이지를 복원했습니다",
  create: "페이지를 생성했습니다",
};

export function ActivityPanel({
  pageId,
  onClose,
}: {
  pageId: string;
  onClose: () => void;
}) {
  const { data: activities, isLoading } = trpc.activity.list.useQuery(
    { pageId, limit: 50 },
    { refetchInterval: 30000 },
  );

  return (
    <div
      className="fixed top-0 right-0 h-full w-80 flex flex-col"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderLeft: "1px solid var(--border-default)",
        zIndex: "var(--z-modal)",
        boxShadow: "var(--shadow-popup)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          활동
        </span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-notion-bg-hover text-sm"
          style={{ color: "var(--text-tertiary)" }}
        >
          ✕
        </button>
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
            로딩 중...
          </div>
        )}
        {!isLoading && (!activities || activities.length === 0) && (
          <div className="py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
            활동 기록이 없습니다
          </div>
        )}
        {activities?.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 px-4 py-3"
            style={{ borderBottom: "1px solid var(--border-default)" }}
          >
            {/* Avatar */}
            <div
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
              style={{ backgroundColor: "#9b59b6" }}
            >
              {activity.user.avatarUrl ? (
                <img
                  src={activity.user.avatarUrl}
                  alt=""
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                getInitials(activity.user.name)
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                <span className="font-medium">{activity.user.name}</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {" "}
                  {ACTION_LABELS[activity.action] || activity.action}
                </span>
              </p>
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {formatTime(activity.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
