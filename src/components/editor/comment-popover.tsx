"use client";

import { useState, useRef, useEffect } from "react";
import { Send, X, CheckCircle, MoreHorizontal, Trash2 } from "lucide-react";
import { trpc } from "@/server/trpc/client";
import type { Editor } from "@tiptap/react";

type CommentPopoverProps = {
  pageId: string;
  commentId: string | null; // null = new comment mode
  currentUserId: string;
  editor: Editor;
  position: { top: number; left: number };
  textRange: { from: number; to: number } | null;
  onClose: () => void;
};

export function CommentPopover({
  pageId,
  commentId,
  currentUserId,
  editor,
  position,
  textRange,
  onClose,
}: CommentPopoverProps) {
  const [content, setContent] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  // Fetch existing comment thread if commentId provided
  const { data: comments } = trpc.comment.list.useQuery(
    { pageId },
    { enabled: !!commentId },
  );

  const existingComment = comments?.find((c) => c.id === commentId);

  const createComment = trpc.comment.create.useMutation({
    onSuccess: (newComment) => {
      // Apply comment mark to the selected text
      if (textRange) {
        editor
          .chain()
          .focus()
          .setTextSelection(textRange)
          .setComment({ commentId: newComment.id })
          .run();
      }
      utils.comment.list.invalidate();
      setContent("");
      onClose();
    },
  });

  const createReply = trpc.comment.create.useMutation({
    onSuccess: () => {
      utils.comment.list.invalidate();
      setReplyContent("");
    },
  });

  const resolveComment = trpc.comment.resolve.useMutation({
    onSuccess: () => {
      utils.comment.list.invalidate();
      // Remove the highlight when resolved
      if (commentId) {
        editor.chain().focus().unsetComment(commentId).run();
      }
      onClose();
    },
  });

  const deleteComment = trpc.comment.delete.useMutation({
    onSuccess: () => {
      utils.comment.list.invalidate();
      if (commentId) {
        editor.chain().focus().unsetComment(commentId).run();
      }
      onClose();
    },
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleSubmitNew = () => {
    if (!content.trim()) return;
    createComment.mutate({
      pageId,
      content: content.trim(),
      textFrom: textRange?.from ?? null,
      textTo: textRange?.to ?? null,
    });
  };

  const handleSubmitReply = () => {
    if (!replyContent.trim() || !commentId) return;
    createReply.mutate({
      pageId,
      parentId: commentId,
      content: replyContent.trim(),
    });
  };

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-[300px] rounded-lg overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        backgroundColor: "var(--bg-primary)",
        boxShadow: "var(--shadow-popup)",
        border: "1px solid var(--border-default)",
      }}
    >
      {!commentId ? (
        /* New comment */
        <div className="p-3">
          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a comment..."
            className="w-full bg-transparent outline-none text-sm resize-none"
            style={{ color: "var(--text-primary)", minHeight: "60px" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmitNew();
              }
            }}
          />
          <div className="flex items-center justify-end gap-1 mt-2">
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs rounded hover:bg-notion-bg-hover"
              style={{ color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitNew}
              disabled={!content.trim() || createComment.isPending}
              className="px-3 py-1 text-xs rounded text-white disabled:opacity-50"
              style={{ backgroundColor: "#2383e2" }}
            >
              <Send size={12} className="inline mr-1" />
              Comment
            </button>
          </div>
        </div>
      ) : (
        /* Existing comment thread */
        <div>
          {existingComment && (
            <div className="p-3 border-b" style={{ borderColor: "var(--border-divider)" }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-semibold"
                    style={{ backgroundColor: "#2383e2" }}
                  >
                    {existingComment.author.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {existingComment.author.name}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                    {new Date(existingComment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => resolveComment.mutate({ id: existingComment.id })}
                    className="p-1 rounded hover:bg-notion-bg-hover"
                    style={{ color: "var(--text-tertiary)" }}
                    title="Resolve"
                  >
                    <CheckCircle size={14} />
                  </button>
                  {existingComment.author.id === currentUserId && (
                    <button
                      onClick={() => deleteComment.mutate({ id: existingComment.id })}
                      className="p-1 rounded hover:bg-notion-bg-hover"
                      style={{ color: "var(--text-tertiary)" }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                {existingComment.content}
              </p>

              {/* Replies */}
              {existingComment.replies?.map((reply) => (
                <div key={reply.id} className="mt-2 pl-4 border-l-2" style={{ borderColor: "var(--border-divider)" }}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                      {reply.author.name}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                      {new Date(reply.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {reply.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Reply input */}
          <div className="p-3">
            <textarea
              ref={inputRef}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Reply..."
              className="w-full bg-transparent outline-none text-sm resize-none"
              style={{ color: "var(--text-primary)", minHeight: "40px" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitReply();
                }
              }}
            />
            <div className="flex justify-end mt-1">
              <button
                onClick={handleSubmitReply}
                disabled={!replyContent.trim() || createReply.isPending}
                className="px-3 py-1 text-xs rounded text-white disabled:opacity-50"
                style={{ backgroundColor: "#2383e2" }}
              >
                Reply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
