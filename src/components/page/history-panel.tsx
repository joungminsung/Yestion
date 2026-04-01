"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";

type SnapshotBlock = {
  id: string;
  type: string;
  content: Record<string, unknown> & { text?: string };
  parentId: string | null;
  position: number;
};

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
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryPanel({
  pageId,
  onClose,
}: {
  pageId: string;
  onClose: () => void;
}) {
  const addToast = useToastStore((s) => s.addToast);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: snapshots, isLoading } = trpc.history.list.useQuery(
    { pageId, limit: 30 },
    { refetchInterval: false }
  );

  const { data: selectedSnapshot } = trpc.history.get.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId }
  );

  const createSnapshot = trpc.history.createSnapshot.useMutation({
    onSuccess: () => {
      addToast({ message: "스냅샷이 생성되었습니다", type: "success" });
      utils.history.list.invalidate({ pageId });
    },
    onError: () => {
      addToast({ message: "스냅샷 생성에 실패했습니다", type: "error" });
    },
  });

  const restoreSnapshot = trpc.history.restore.useMutation({
    onSuccess: () => {
      addToast({ message: "복원되었습니다", type: "success" });
      utils.history.list.invalidate({ pageId });
      utils.page.get.invalidate({ id: pageId });
      utils.block.list.invalidate({ pageId });
      setSelectedId(null);
    },
    onError: () => {
      addToast({ message: "복원에 실패했습니다", type: "error" });
    },
  });

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
        <span
          className="font-semibold text-sm"
          style={{ color: "var(--text-primary)" }}
        >
          히스토리
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => createSnapshot.mutate({ pageId })}
            disabled={createSnapshot.isPending}
            className="px-2 py-1 rounded text-xs hover:bg-notion-bg-hover"
            style={{ color: "var(--accent-blue)" }}
          >
            스냅샷 저장
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-notion-bg-hover text-sm"
            style={{ color: "var(--text-tertiary)" }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Snapshot list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div
            className="py-8 text-center text-sm"
            style={{ color: "var(--text-tertiary)" }}
          >
            로딩 중...
          </div>
        )}
        {!isLoading && (!snapshots || snapshots.length === 0) && (
          <div
            className="py-8 text-center text-sm"
            style={{ color: "var(--text-tertiary)" }}
          >
            히스토리가 없습니다.
            <br />
            스냅샷 저장을 눌러 현재 상태를 저장하세요.
          </div>
        )}
        {snapshots?.map((snapshot) => (
          <div
            key={snapshot.id}
            className="px-4 py-3 cursor-pointer hover:bg-notion-bg-hover"
            style={{
              borderBottom: "1px solid var(--border-default)",
              backgroundColor:
                selectedId === snapshot.id
                  ? "var(--bg-active)"
                  : undefined,
            }}
            onClick={() =>
              setSelectedId(
                selectedId === snapshot.id ? null : snapshot.id
              )
            }
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {snapshot.title || "제목 없음"}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {formatTime(snapshot.createdAt)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    window.confirm(
                      "이 스냅샷으로 복원하시겠습니까? 현재 상태는 자동으로 저장됩니다."
                    )
                  ) {
                    restoreSnapshot.mutate({ snapshotId: snapshot.id });
                  }
                }}
                disabled={restoreSnapshot.isPending}
                className="flex-shrink-0 px-2 py-1 rounded text-xs hover:bg-notion-bg-active"
                style={{ color: "var(--accent-blue)" }}
              >
                복원
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview area */}
      {selectedSnapshot && (
        <div
          className="border-t px-4 py-3 max-h-[40%] overflow-y-auto"
          style={{ borderColor: "var(--border-default)" }}
        >
          <p
            className="text-xs font-medium mb-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            미리보기 (블록 {(selectedSnapshot.blocks as SnapshotBlock[]).length}개)
          </p>
          <div className="space-y-1">
            {(selectedSnapshot.blocks as SnapshotBlock[]).slice(0, 10).map((block: SnapshotBlock, idx: number) => (
              <div
                key={block.id || idx}
                className="text-xs px-2 py-1 rounded"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                }}
              >
                <span
                  className="font-mono text-[10px] mr-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {block.type}
                </span>
                {block.content?.text ||
                  (typeof block.content === "object"
                    ? JSON.stringify(block.content).slice(0, 60)
                    : "")}
              </div>
            ))}
            {(selectedSnapshot.blocks as SnapshotBlock[]).length > 10 && (
              <p
                className="text-xs text-center"
                style={{ color: "var(--text-tertiary)" }}
              >
                ... 외 {(selectedSnapshot.blocks as SnapshotBlock[]).length - 10}개
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
