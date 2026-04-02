"use client";

import { useState } from "react";
import { SmilePlus } from "lucide-react";
import { trpc } from "@/server/trpc/client";

const QUICK_EMOJIS = ["\uD83D\uDC4D", "\u2764\uFE0F", "\uD83D\uDE02", "\uD83C\uDF89", "\uD83D\uDE2E", "\uD83D\uDC40", "\uD83D\uDD25", "\u2705"];

type ReactionData = Record<string, string[]>; // emoji -> userId[]

export function CommentReactions({
  commentId,
  reactions,
  currentUserId,
}: {
  commentId: string;
  reactions: ReactionData;
  currentUserId: string;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const utils = trpc.useUtils();

  const addReaction = trpc.comment.addReaction.useMutation({
    onSuccess: () => {
      utils.comment.list.invalidate();
    },
  });

  const handleReact = (emoji: string) => {
    addReaction.mutate({ commentId, emoji });
    setShowPicker(false);
  };

  const reactionEntries = Object.entries(reactions).filter(
    ([, users]) => users.length > 0,
  );

  return (
    <div className="flex items-center flex-wrap gap-1 mt-1.5">
      {reactionEntries.map(([emoji, users]) => {
        const hasReacted = users.includes(currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => handleReact(emoji)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border"
            style={{
              backgroundColor: hasReacted ? "rgba(35, 131, 226, 0.1)" : "transparent",
              borderColor: hasReacted ? "#2383e2" : "var(--border-default)",
              color: "var(--text-primary)",
            }}
          >
            <span>{emoji}</span>
            <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
              {users.length}
            </span>
          </button>
        );
      })}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="flex items-center justify-center w-6 h-6 rounded-full border hover:bg-notion-bg-hover"
          style={{
            borderColor: "var(--border-default)",
            color: "var(--text-tertiary)",
          }}
        >
          <SmilePlus size={12} />
        </button>

        {showPicker && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowPicker(false)}
            />
            <div
              className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 rounded-lg z-50"
              style={{
                backgroundColor: "var(--bg-primary)",
                boxShadow: "var(--shadow-popup)",
                border: "1px solid var(--border-default)",
              }}
            >
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-notion-bg-hover text-sm"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
