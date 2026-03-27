"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";

interface CommentAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface CommentData {
  id: string;
  content: string;
  authorId: string;
  resolved: boolean;
  createdAt: Date;
  author: CommentAuthor;
  replies?: CommentData[];
  parentId?: string | null;
  pageId: string;
}

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

export function CommentItem({
  comment,
  currentUserId,
  onRefresh,
}: {
  comment: CommentData;
  currentUserId: string;
  onRefresh: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");

  const updateMutation = trpc.comment.update.useMutation({ onSuccess: () => { setIsEditing(false); onRefresh(); } });
  const deleteMutation = trpc.comment.delete.useMutation({ onSuccess: onRefresh });
  const resolveMutation = trpc.comment.resolve.useMutation({ onSuccess: onRefresh });
  const unresolveMutation = trpc.comment.unresolve.useMutation({ onSuccess: onRefresh });
  const createReply = trpc.comment.create.useMutation({ onSuccess: () => { setIsReplying(false); setReplyContent(""); onRefresh(); } });

  const isOwner = comment.authorId === currentUserId;

  return (
    <div
      className="px-4 py-3"
      style={{
        borderBottom: "1px solid var(--border-default)",
        opacity: comment.resolved ? 0.6 : 1,
      }}
    >
      <div className="flex items-start gap-2">
        {/* Avatar */}
        <div
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
          style={{ backgroundColor: "#9b59b6" }}
        >
          {comment.author.avatarUrl ? (
            <img src={comment.author.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            getInitials(comment.author.name)
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
              {comment.author.name}
            </span>
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {formatTime(comment.createdAt)}
            </span>
            {comment.resolved && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-tertiary)" }}>
                해결됨
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="mt-1">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 rounded border text-sm resize-none"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                }}
                rows={2}
              />
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => updateMutation.mutate({ id: comment.id, content: editContent })}
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
                >
                  저장
                </button>
                <button
                  onClick={() => { setIsEditing(false); setEditContent(comment.content); }}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: "var(--text-secondary)" }}
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm mt-0.5" style={{ color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
              {comment.content}
            </p>
          )}

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-2 mt-1">
              {!comment.parentId && (
                <button
                  onClick={() => setIsReplying(!isReplying)}
                  className="text-xs hover:underline"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  답글
                </button>
              )}
              {!comment.parentId && !comment.resolved && (
                <button
                  onClick={() => resolveMutation.mutate({ id: comment.id })}
                  className="text-xs hover:underline"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  해결
                </button>
              )}
              {!comment.parentId && comment.resolved && (
                <button
                  onClick={() => unresolveMutation.mutate({ id: comment.id })}
                  className="text-xs hover:underline"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  다시 열기
                </button>
              )}
              {isOwner && (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs hover:underline"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    수정
                  </button>
                  <button
                    onClick={() => { if (confirm("댓글을 삭제하시겠습니까?")) deleteMutation.mutate({ id: comment.id }); }}
                    className="text-xs hover:underline"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
          )}

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2 ml-2" style={{ borderLeft: "2px solid var(--border-default)", paddingLeft: "8px" }}>
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={{ ...reply, pageId: comment.pageId }}
                  currentUserId={currentUserId}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          )}

          {/* Reply input */}
          {isReplying && (
            <div className="mt-2">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="답글 작성..."
                className="w-full p-2 rounded border text-sm resize-none"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                }}
                rows={2}
                autoFocus
              />
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => {
                    if (replyContent.trim()) {
                      createReply.mutate({ pageId: comment.pageId, parentId: comment.id, content: replyContent.trim() });
                    }
                  }}
                  disabled={!replyContent.trim()}
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: "var(--accent-blue)", color: "white", opacity: replyContent.trim() ? 1 : 0.5 }}
                >
                  답글
                </button>
                <button
                  onClick={() => { setIsReplying(false); setReplyContent(""); }}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: "var(--text-secondary)" }}
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
