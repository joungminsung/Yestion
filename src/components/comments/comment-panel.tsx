"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { CommentItem } from "./comment-item";

export function CommentPanel({
  pageId,
  currentUserId,
  onClose,
}: {
  pageId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const [newComment, setNewComment] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const utils = trpc.useUtils();
  const { data: comments, isLoading } = trpc.comment.list.useQuery({ pageId });
  const createComment = trpc.comment.create.useMutation({
    onSuccess: () => {
      setNewComment("");
      utils.comment.list.invalidate({ pageId });
    },
  });

  const handleRefresh = () => {
    utils.comment.list.invalidate({ pageId });
  };

  const filtered = comments?.filter((c) => (showResolved ? true : !c.resolved)) ?? [];

  return (
    <div
      className="fixed right-0 top-0 h-full flex flex-col"
      style={{
        width: "360px",
        zIndex: "var(--z-modal, 100)",
        backgroundColor: "var(--bg-primary)",
        borderLeft: "1px solid var(--border-default)",
        boxShadow: "-2px 0 8px rgba(0,0,0,0.08)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          댓글
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="text-xs px-2 py-1 rounded"
            style={{
              color: showResolved ? "var(--accent-blue)" : "var(--text-tertiary)",
              backgroundColor: showResolved ? "var(--bg-tertiary)" : "transparent",
            }}
          >
            {showResolved ? "모두 보기" : "해결됨 숨기기"}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M11.854 2.854a.5.5 0 00-.708-.708L7 6.293 2.854 2.146a.5.5 0 10-.708.708L6.293 7l-4.147 4.146a.5.5 0 00.708.708L7 7.707l4.146 4.147a.5.5 0 00.708-.708L7.707 7l4.147-4.146z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
            로딩 중...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
            {showResolved ? "댓글이 없습니다" : "열린 댓글이 없습니다"}
          </div>
        ) : (
          filtered.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={{
                ...comment,
                pageId,
                createdAt: comment.createdAt,
                replies: comment.replies?.map((r) => ({
                  ...r,
                  pageId,
                  createdAt: r.createdAt,
                })),
              }}
              currentUserId={currentUserId}
              onRefresh={handleRefresh}
            />
          ))
        )}
      </div>

      {/* New comment input */}
      <div
        className="flex-shrink-0 px-4 py-3"
        style={{ borderTop: "1px solid var(--border-default)" }}
      >
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="댓글 작성..."
          className="w-full p-2 rounded border text-sm resize-none"
          style={{
            borderColor: "var(--border-default)",
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-primary)",
          }}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && newComment.trim()) {
              createComment.mutate({ pageId, content: newComment.trim() });
            }
          }}
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Cmd+Enter로 전송
          </span>
          <button
            onClick={() => {
              if (newComment.trim()) {
                createComment.mutate({ pageId, content: newComment.trim() });
              }
            }}
            disabled={!newComment.trim() || createComment.isPending}
            className="text-xs px-3 py-1.5 rounded font-medium"
            style={{
              backgroundColor: "var(--accent-blue)",
              color: "white",
              opacity: newComment.trim() ? 1 : 0.5,
            }}
          >
            댓글 작성
          </button>
        </div>
      </div>
    </div>
  );
}
