# Collaboration Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add suggesting mode, inline comments, version diffs, typing indicators, follow mode, comment reactions, and editing lock display to create a production-grade real-time collaboration experience.
**Architecture:** Suggesting mode uses a custom TipTap mark extension that wraps text in suggestion metadata (author, action, content). Inline comments extend the existing Comment model with a TipTap mark that highlights text ranges. Version diff uses fast-diff to compare snapshot block content. Typing indicators, follow mode, and lock display extend Yjs awareness protocol fields.
**Tech Stack:** TipTap 2, Yjs, Hocuspocus, fast-diff, Prisma, tRPC, Zustand, React 18, Tailwind CSS, lucide-react

---

### Task 1: Suggesting Mode
**Files:**
- Create: `src/components/editor/extensions/suggestion-mark.ts`
- Create: `src/components/editor/suggestion-panel.tsx`
- Modify: `src/components/editor/inline-toolbar.tsx`

- [ ] **Step 1: Create the suggestion mark TipTap extension**

Create `src/components/editor/extensions/suggestion-mark.ts`:

```typescript
import { Mark, mergeAttributes } from "@tiptap/core";

export interface SuggestionMarkOptions {
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    suggestionMark: {
      setSuggestion: (attrs: {
        authorId: string;
        authorName: string;
        action: "insert" | "delete" | "replace";
        originalText?: string;
        createdAt?: string;
      }) => ReturnType;
      unsetSuggestion: () => ReturnType;
      acceptSuggestion: () => ReturnType;
      rejectSuggestion: () => ReturnType;
    };
  }
}

export const SuggestionMark = Mark.create<SuggestionMarkOptions>({
  name: "suggestion",
  priority: 1000,
  inclusive: false,
  excludes: "",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      authorId: { default: null },
      authorName: { default: null },
      action: { default: "insert" }, // "insert" | "delete" | "replace"
      originalText: { default: null },
      createdAt: { default: () => new Date().toISOString() },
      suggestionId: { default: () => `sug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-suggestion]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const action = HTMLAttributes.action || "insert";
    const bgColor =
      action === "insert"
        ? "rgba(0, 180, 80, 0.15)"
        : action === "delete"
          ? "rgba(235, 87, 87, 0.15)"
          : "rgba(255, 180, 0, 0.15)";
    const borderBottom =
      action === "insert"
        ? "2px solid rgba(0, 180, 80, 0.5)"
        : action === "delete"
          ? "2px solid rgba(235, 87, 87, 0.5)"
          : "2px solid rgba(255, 180, 0, 0.5)";
    const textDecoration = action === "delete" ? "line-through" : "none";

    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-suggestion": "",
        "data-action": action,
        style: `background-color: ${bgColor}; border-bottom: ${borderBottom}; text-decoration: ${textDecoration}; cursor: pointer;`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSuggestion:
        (attrs) =>
        ({ commands }) => {
          return commands.setMark(this.name, attrs);
        },
      unsetSuggestion:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      acceptSuggestion:
        () =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection;
          // Find the suggestion mark in the selection
          let found = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            const mark = node.marks.find((m) => m.type.name === "suggestion");
            if (mark) {
              found = true;
              if (mark.attrs.action === "delete") {
                // Accept delete = remove the text
                tr.delete(pos, pos + node.nodeSize);
              } else {
                // Accept insert/replace = remove the mark, keep text
                tr.removeMark(pos, pos + node.nodeSize, mark.type);
              }
            }
          });
          if (found && dispatch) dispatch(tr);
          return found;
        },
      rejectSuggestion:
        () =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection;
          let found = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            const mark = node.marks.find((m) => m.type.name === "suggestion");
            if (mark) {
              found = true;
              if (mark.attrs.action === "insert") {
                // Reject insert = remove the text
                tr.delete(pos, pos + node.nodeSize);
              } else if (mark.attrs.action === "delete") {
                // Reject delete = remove the mark, keep text
                tr.removeMark(pos, pos + node.nodeSize, mark.type);
              } else if (mark.attrs.action === "replace" && mark.attrs.originalText) {
                // Reject replace = restore original text
                tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(mark.attrs.originalText));
              }
            }
          });
          if (found && dispatch) dispatch(tr);
          return found;
        },
    };
  },
});
```

- [ ] **Step 2: Create the suggestion panel sidebar**

Create `src/components/editor/suggestion-panel.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import type { Editor } from "@tiptap/react";
import { Check, X, ChevronDown, ChevronUp, User } from "lucide-react";

type Suggestion = {
  id: string;
  authorId: string;
  authorName: string;
  action: "insert" | "delete" | "replace";
  text: string;
  originalText: string | null;
  createdAt: string;
  from: number;
  to: number;
};

export function SuggestionPanel({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Collect all suggestion marks from the document
  const suggestions = useMemo(() => {
    const result: Suggestion[] = [];
    editor.state.doc.descendants((node, pos) => {
      node.marks.forEach((mark) => {
        if (mark.type.name === "suggestion") {
          result.push({
            id: mark.attrs.suggestionId,
            authorId: mark.attrs.authorId,
            authorName: mark.attrs.authorName || "Unknown",
            action: mark.attrs.action,
            text: node.textContent,
            originalText: mark.attrs.originalText,
            createdAt: mark.attrs.createdAt,
            from: pos,
            to: pos + node.nodeSize,
          });
        }
      });
    });
    return result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [editor.state.doc]);

  const handleAccept = (suggestion: Suggestion) => {
    editor.chain().focus().setTextSelection({ from: suggestion.from, to: suggestion.to }).acceptSuggestion().run();
  };

  const handleReject = (suggestion: Suggestion) => {
    editor.chain().focus().setTextSelection({ from: suggestion.from, to: suggestion.to }).rejectSuggestion().run();
  };

  const handleAcceptAll = () => {
    // Accept from end to start to preserve positions
    const sorted = [...suggestions].sort((a, b) => b.from - a.from);
    for (const sug of sorted) {
      editor.chain().focus().setTextSelection({ from: sug.from, to: sug.to }).acceptSuggestion().run();
    }
  };

  const handleRejectAll = () => {
    const sorted = [...suggestions].sort((a, b) => b.from - a.from);
    for (const sug of sorted) {
      editor.chain().focus().setTextSelection({ from: sug.from, to: sug.to }).rejectSuggestion().run();
    }
  };

  const actionLabel = (action: string) => {
    switch (action) {
      case "insert": return "Added";
      case "delete": return "Deleted";
      case "replace": return "Replaced";
      default: return action;
    }
  };

  const actionColor = (action: string) => {
    switch (action) {
      case "insert": return "#00b450";
      case "delete": return "#eb5757";
      case "replace": return "#ffb400";
      default: return "var(--text-primary)";
    }
  };

  return (
    <div
      className="fixed right-0 top-0 bottom-0 w-[320px] z-40 flex flex-col border-l"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border-divider)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Suggestions ({suggestions.length})
        </h3>
        <div className="flex items-center gap-1">
          {suggestions.length > 0 && (
            <>
              <button
                onClick={handleAcceptAll}
                className="text-xs px-2 py-1 rounded hover:bg-notion-bg-hover"
                style={{ color: "#00b450" }}
              >
                Accept all
              </button>
              <button
                onClick={handleRejectAll}
                className="text-xs px-2 py-1 rounded hover:bg-notion-bg-hover"
                style={{ color: "#eb5757" }}
              >
                Reject all
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {suggestions.length === 0 ? (
          <div
            className="text-center py-12 text-sm"
            style={{ color: "var(--text-tertiary)" }}
          >
            No suggestions
          </div>
        ) : (
          suggestions.map((sug) => (
            <div
              key={sug.id}
              className="px-4 py-3 border-b cursor-pointer hover:bg-notion-bg-hover"
              style={{ borderColor: "var(--border-divider)" }}
              onClick={() => {
                editor.chain().focus().setTextSelection({ from: sug.from, to: sug.to }).run();
                setExpandedId(expandedId === sug.id ? null : sug.id);
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <User size={12} style={{ color: "var(--text-tertiary)" }} />
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {sug.authorName}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${actionColor(sug.action)}20`, color: actionColor(sug.action) }}
                  >
                    {actionLabel(sug.action)}
                  </span>
                </div>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {new Date(sug.createdAt).toLocaleTimeString()}
                </span>
              </div>

              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {sug.action === "delete" ? (
                  <span style={{ textDecoration: "line-through", color: "#eb5757" }}>
                    {sug.text.slice(0, 80)}{sug.text.length > 80 ? "..." : ""}
                  </span>
                ) : (
                  <span style={{ color: "#00b450" }}>
                    {sug.text.slice(0, 80)}{sug.text.length > 80 ? "..." : ""}
                  </span>
                )}
              </div>

              {expandedId === sug.id && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAccept(sug); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-notion-bg-hover"
                    style={{ color: "#00b450" }}
                  >
                    <Check size={12} /> Accept
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReject(sug); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-notion-bg-hover"
                    style={{ color: "#eb5757" }}
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add suggesting mode toggle to the inline toolbar**

In `src/components/editor/inline-toolbar.tsx`, add the following import at the top (after line 7):

```typescript
import { MessageSquarePlus } from "lucide-react";
```

Then add a new state variable after line 42 (`const [commentText, setCommentText] = useState("");`):

```typescript
  const [suggestingMode, setSuggestingMode] = useState(false);
```

Then add a suggesting mode button in the toolbar rendering section. Find the section where toolbar buttons are rendered and add before the comment button area:

```tsx
            {/* Suggesting mode toggle */}
            <button
              onClick={() => {
                setSuggestingMode(!suggestingMode);
              }}
              className={cn(
                "p-1.5 rounded hover:bg-notion-bg-hover",
                suggestingMode && "bg-notion-bg-hover",
              )}
              style={{ color: suggestingMode ? "#00b450" : "var(--text-secondary)" }}
              title={suggestingMode ? "Exit suggesting mode" : "Enter suggesting mode"}
            >
              <MessageSquarePlus size={15} />
            </button>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/extensions/suggestion-mark.ts src/components/editor/suggestion-panel.tsx src/components/editor/inline-toolbar.tsx
git commit -m "feat: add suggesting mode with TipTap mark, accept/reject UI, and suggestion panel"
```

---

### Task 2: Inline Comments
**Files:**
- Create: `src/components/editor/extensions/comment-mark.ts`
- Create: `src/components/editor/comment-popover.tsx`
- Modify: `src/components/editor/inline-toolbar.tsx`

- [ ] **Step 1: Create the comment mark TipTap extension**

Create `src/components/editor/extensions/comment-mark.ts`:

```typescript
import { Mark, mergeAttributes } from "@tiptap/core";

export interface CommentMarkOptions {
  HTMLAttributes: Record<string, string>;
  onCommentClick?: (commentId: string) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    commentMark: {
      setComment: (attrs: { commentId: string }) => ReturnType;
      unsetComment: (commentId: string) => ReturnType;
    };
  }
}

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: "comment",
  priority: 900,
  inclusive: false,
  excludes: "",

  addOptions() {
    return {
      HTMLAttributes: {},
      onCommentClick: undefined,
    };
  },

  addAttributes() {
    return {
      commentId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, {
        "data-comment-id": HTMLAttributes.commentId,
        style:
          "background-color: var(--comment-highlight, rgba(255, 212, 0, 0.3)); border-bottom: 2px solid rgba(255, 180, 0, 0.6); cursor: pointer;",
        class: "inline-comment-highlight",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setComment:
        (attrs) =>
        ({ commands }) => {
          return commands.setMark(this.name, attrs);
        },
      unsetComment:
        (commentId) =>
        ({ state, tr, dispatch }) => {
          let found = false;
          state.doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (
                mark.type.name === "comment" &&
                mark.attrs.commentId === commentId
              ) {
                found = true;
                tr.removeMark(pos, pos + node.nodeSize, mark.type);
              }
            });
          });
          if (found && dispatch) dispatch(tr);
          return found;
        },
    };
  },
});
```

- [ ] **Step 2: Create the comment popover component**

Create `src/components/editor/comment-popover.tsx`:

```tsx
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
```

- [ ] **Step 3: Add inline comment button to the inline toolbar**

In `src/components/editor/inline-toolbar.tsx`, add a comment button to the toolbar. Find the existing comment handling and ensure the "Comment" button triggers the inline comment popover. Add in the toolbar button section (near the existing `onAddComment` prop usage):

```tsx
            {/* Inline comment button */}
            <button
              onClick={() => {
                const { from, to } = editor.state.selection;
                if (from === to) return;
                const selectedText = editor.state.doc.textBetween(from, to);
                if (onAddComment) {
                  onAddComment(selectedText, { from, to });
                }
              }}
              className="p-1.5 rounded hover:bg-notion-bg-hover"
              style={{ color: "var(--text-secondary)" }}
              title="Add comment"
              disabled={editor.state.selection.from === editor.state.selection.to}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.32 15.424l4.644-2.432a.5.5 0 01.235-.059h3.3A2.5 2.5 0 0015 10.433V5.5A2.5 2.5 0 0012.5 3h-9A2.5 2.5 0 001 5.5v4.933a2.5 2.5 0 002.5 2.5h.32a.5.5 0 01.5.5v1.991z" />
              </svg>
            </button>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/extensions/comment-mark.ts src/components/editor/comment-popover.tsx src/components/editor/inline-toolbar.tsx
git commit -m "feat: add inline comments with TipTap mark highlight and comment popover thread UI"
```

---

### Task 3: Version Diff
**Files:**
- Modify: `src/server/routers/history.ts`
- Create: `src/components/page/version-diff-view.tsx`

- [ ] **Step 1: Install fast-diff**

```bash
npm install fast-diff
npm install -D @types/fast-diff
```

- [ ] **Step 2: Add diff procedure to history router**

In `src/server/routers/history.ts`, add the following import at the top (after line 4):

```typescript
import fastDiff from "fast-diff";
```

Then add a new `diff` procedure after the `get` procedure (after line 46, before `createSnapshot`):

```typescript
  diff: protectedProcedure
    .input(
      z.object({
        snapshotIdA: z.string(), // older
        snapshotIdB: z.string(), // newer
      }),
    )
    .query(async ({ ctx, input }) => {
      const [snapshotA, snapshotB] = await Promise.all([
        ctx.db.pageSnapshot.findUnique({ where: { id: input.snapshotIdA } }),
        ctx.db.pageSnapshot.findUnique({ where: { id: input.snapshotIdB } }),
      ]);

      if (!snapshotA || !snapshotB) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Snapshot not found" });
      }

      if (snapshotA.pageId !== snapshotB.pageId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Snapshots must belong to the same page" });
      }

      await verifyPageAccess(ctx.db, ctx.session.user.id, snapshotA.pageId);

      // Extract text content from blocks
      const extractText = (blocks: unknown[]): string => {
        return blocks
          .map((block: Record<string, unknown>) => {
            const content = block.content as Record<string, unknown> | undefined;
            if (!content) return "";
            // Extract text from common block content shapes
            const text = (content.text as string) || (content.content as string) || "";
            return text;
          })
          .filter(Boolean)
          .join("\n");
      };

      const blocksA = (snapshotA.blocks as unknown[]) || [];
      const blocksB = (snapshotB.blocks as unknown[]) || [];
      const textA = extractText(blocksA);
      const textB = extractText(blocksB);

      // Compute diff
      const diffResult = fastDiff(textA, textB);

      // Structure: array of [type, text] where type is -1 (delete), 0 (equal), 1 (insert)
      const changes = diffResult.map(([type, text]) => ({
        type: type === fastDiff.DELETE ? "delete" : type === fastDiff.INSERT ? "insert" : "equal",
        text,
      }));

      // Stats
      const stats = {
        additions: changes.filter((c) => c.type === "insert").reduce((sum, c) => sum + c.text.length, 0),
        deletions: changes.filter((c) => c.type === "delete").reduce((sum, c) => sum + c.text.length, 0),
      };

      return {
        snapshotA: { id: snapshotA.id, title: snapshotA.title, createdAt: snapshotA.createdAt, createdBy: snapshotA.createdBy },
        snapshotB: { id: snapshotB.id, title: snapshotB.title, createdAt: snapshotB.createdAt, createdBy: snapshotB.createdBy },
        changes,
        stats,
      };
    }),
```

- [ ] **Step 3: Create the version diff view component**

Create `src/components/page/version-diff-view.tsx`:

```tsx
"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { X, Loader2, GitCompare } from "lucide-react";

type DiffChange = {
  type: "insert" | "delete" | "equal";
  text: string;
};

export function VersionDiffView({
  pageId,
  onClose,
}: {
  pageId: string;
  onClose: () => void;
}) {
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified");

  const { data: snapshots, isLoading: loadingSnapshots } = trpc.history.list.useQuery({
    pageId,
    limit: 50,
  });

  const { data: diffData, isLoading: loadingDiff } = trpc.history.diff.useQuery(
    { snapshotIdA: selectedA!, snapshotIdB: selectedB! },
    { enabled: !!selectedA && !!selectedB },
  );

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="m-auto w-full max-w-4xl max-h-[80vh] rounded-xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: "var(--bg-primary)",
          boxShadow: "var(--shadow-popup)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: "var(--border-divider)" }}
        >
          <div className="flex items-center gap-2">
            <GitCompare size={18} style={{ color: "var(--text-secondary)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Version Diff
            </h2>
            {diffData?.stats && (
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                <span style={{ color: "#00b450" }}>+{diffData.stats.additions}</span>
                {" / "}
                <span style={{ color: "#eb5757" }}>-{diffData.stats.deletions}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as "unified" | "split")}
              className="text-xs bg-transparent outline-none px-2 py-1 rounded border"
              style={{
                color: "var(--text-primary)",
                borderColor: "var(--border-default)",
              }}
            >
              <option value="unified">Unified</option>
              <option value="split">Split</option>
            </select>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-notion-bg-hover"
              style={{ color: "var(--text-tertiary)" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Snapshot selector */}
        <div
          className="flex items-center gap-4 px-5 py-3 border-b"
          style={{ borderColor: "var(--border-divider)" }}
        >
          <div className="flex-1">
            <label className="text-[10px] uppercase font-semibold mb-1 block" style={{ color: "var(--text-tertiary)" }}>
              From (older)
            </label>
            <select
              value={selectedA ?? ""}
              onChange={(e) => setSelectedA(e.target.value || null)}
              className="w-full text-xs bg-transparent outline-none px-2 py-1.5 rounded border"
              style={{
                color: "var(--text-primary)",
                borderColor: "var(--border-default)",
              }}
            >
              <option value="">Select version...</option>
              {snapshots?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || "Untitled"} — {new Date(s.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] uppercase font-semibold mb-1 block" style={{ color: "var(--text-tertiary)" }}>
              To (newer)
            </label>
            <select
              value={selectedB ?? ""}
              onChange={(e) => setSelectedB(e.target.value || null)}
              className="w-full text-xs bg-transparent outline-none px-2 py-1.5 rounded border"
              style={{
                color: "var(--text-primary)",
                borderColor: "var(--border-default)",
              }}
            >
              <option value="">Select version...</option>
              {snapshots?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || "Untitled"} — {new Date(s.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadingDiff && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
            </div>
          )}

          {!selectedA || !selectedB ? (
            <div className="text-center py-12 text-sm" style={{ color: "var(--text-tertiary)" }}>
              Select two versions to compare
            </div>
          ) : diffData ? (
            viewMode === "unified" ? (
              <pre
                className="text-sm font-mono whitespace-pre-wrap leading-relaxed"
                style={{ color: "var(--text-primary)" }}
              >
                {diffData.changes.map((change, i) => (
                  <span
                    key={i}
                    style={{
                      backgroundColor:
                        change.type === "insert"
                          ? "rgba(0, 180, 80, 0.15)"
                          : change.type === "delete"
                            ? "rgba(235, 87, 87, 0.15)"
                            : "transparent",
                      textDecoration: change.type === "delete" ? "line-through" : "none",
                      color:
                        change.type === "insert"
                          ? "#00b450"
                          : change.type === "delete"
                            ? "#eb5757"
                            : "var(--text-primary)",
                    }}
                  >
                    {change.text}
                  </span>
                ))}
              </pre>
            ) : (
              <div className="flex gap-4">
                {/* Left: removed content */}
                <div className="flex-1">
                  <div className="text-[10px] uppercase font-semibold mb-2" style={{ color: "var(--text-tertiary)" }}>
                    Before
                  </div>
                  <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed">
                    {diffData.changes
                      .filter((c) => c.type !== "insert")
                      .map((change, i) => (
                        <span
                          key={i}
                          style={{
                            backgroundColor:
                              change.type === "delete" ? "rgba(235, 87, 87, 0.15)" : "transparent",
                            textDecoration: change.type === "delete" ? "line-through" : "none",
                            color: change.type === "delete" ? "#eb5757" : "var(--text-primary)",
                          }}
                        >
                          {change.text}
                        </span>
                      ))}
                  </pre>
                </div>
                {/* Right: added content */}
                <div className="flex-1">
                  <div className="text-[10px] uppercase font-semibold mb-2" style={{ color: "var(--text-tertiary)" }}>
                    After
                  </div>
                  <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed">
                    {diffData.changes
                      .filter((c) => c.type !== "delete")
                      .map((change, i) => (
                        <span
                          key={i}
                          style={{
                            backgroundColor:
                              change.type === "insert" ? "rgba(0, 180, 80, 0.15)" : "transparent",
                            color: change.type === "insert" ? "#00b450" : "var(--text-primary)",
                          }}
                        >
                          {change.text}
                        </span>
                      ))}
                  </pre>
                </div>
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/history.ts src/components/page/version-diff-view.tsx package.json package-lock.json
git commit -m "feat: add version diff with fast-diff, unified/split view modes, and diff stats"
```

---

### Task 4: Typing Indicator
**Files:**
- Create: `src/components/editor/typing-indicator.tsx`
- Modify: `src/stores/presence.ts`

- [ ] **Step 1: Extend presence store with typing state**

In `src/stores/presence.ts`, update the `PresenceUser` type and store to track typing:

Replace the entire file content:

```typescript
import { create } from "zustand";

export type PresenceUser = {
  id: string;
  name: string;
  color: string;
  isTyping?: boolean;
  lastTypingAt?: number;
};

type PresenceStore = {
  users: PresenceUser[];
  setUsers: (users: PresenceUser[]) => void;
  followingUserId: string | null;
  setFollowing: (userId: string | null) => void;
  setUserTyping: (userId: string, isTyping: boolean) => void;
};

export const usePresenceStore = create<PresenceStore>((set) => ({
  users: [],
  setUsers: (users) => set({ users }),
  followingUserId: null,
  setFollowing: (userId) => set({ followingUserId: userId }),
  setUserTyping: (userId, isTyping) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === userId
          ? { ...u, isTyping, lastTypingAt: isTyping ? Date.now() : u.lastTypingAt }
          : u,
      ),
    })),
}));
```

- [ ] **Step 2: Create the typing indicator component**

Create `src/components/editor/typing-indicator.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { usePresenceStore } from "@/stores/presence";

export function TypingIndicator() {
  const users = usePresenceStore((s) => s.users);
  const [visible, setVisible] = useState(false);

  const typingUsers = users.filter((u) => u.isTyping);

  // Auto-clear stale typing states (3s timeout)
  useEffect(() => {
    if (typingUsers.length === 0) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const interval = setInterval(() => {
      const now = Date.now();
      const stillTyping = typingUsers.some(
        (u) => u.lastTypingAt && now - u.lastTypingAt < 3000,
      );
      if (!stillTyping) {
        setVisible(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [typingUsers]);

  if (!visible || typingUsers.length === 0) return null;

  const names = typingUsers.map((u) => u.name);
  let label: string;
  if (names.length === 1) {
    label = `${names[0]} is typing`;
  } else if (names.length === 2) {
    label = `${names[0]} and ${names[1]} are typing`;
  } else {
    label = `${names[0]} and ${names.length - 1} others are typing`;
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-xs"
      style={{ color: "var(--text-tertiary)" }}
    >
      <span className="flex gap-0.5">
        {typingUsers.slice(0, 3).map((u) => (
          <span
            key={u.id}
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: u.color }}
          />
        ))}
      </span>
      <span>{label}</span>
      <span className="typing-dots">
        <span className="animate-pulse">.</span>
        <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>.</span>
        <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>.</span>
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/presence.ts src/components/editor/typing-indicator.tsx
git commit -m "feat: add typing indicator with auto-clear timeout and multi-user display"
```

---

### Task 5: Follow Mode
**Files:**
- Create: `src/components/editor/follow-mode-banner.tsx`
- Modify: `src/components/layout/topbar.tsx`

- [ ] **Step 1: Create follow mode banner component**

Create `src/components/editor/follow-mode-banner.tsx`:

```tsx
"use client";

import { usePresenceStore } from "@/stores/presence";
import { Eye, X } from "lucide-react";

export function FollowModeBanner() {
  const followingUserId = usePresenceStore((s) => s.followingUserId);
  const users = usePresenceStore((s) => s.users);
  const setFollowing = usePresenceStore((s) => s.setFollowing);

  if (!followingUserId) return null;

  const followedUser = users.find((u) => u.id === followingUserId);
  if (!followedUser) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 py-1.5 text-xs font-medium"
      style={{
        backgroundColor: followedUser.color,
        color: "#fff",
      }}
    >
      <Eye size={14} />
      <span>Following {followedUser.name}&apos;s view</span>
      <button
        onClick={() => setFollowing(null)}
        className="p-0.5 rounded hover:bg-white/20 ml-1"
      >
        <X size={12} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add follow mode banner to topbar**

In `src/components/layout/topbar.tsx`, add the import at the top of the file:

```typescript
import { FollowModeBanner } from "@/components/editor/follow-mode-banner";
```

Then wrap the return JSX. Replace the opening `<header` with:

```tsx
    <>
      <FollowModeBanner />
      <header
```

And add `</>` after the closing `</header>` tag.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/follow-mode-banner.tsx src/components/layout/topbar.tsx
git commit -m "feat: add follow mode banner showing followed user with colored indicator"
```

---

### Task 6: Comment Emoji Reactions
**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/server/routers/comment.ts`
- Create: `src/components/comments/comment-reactions.tsx`

- [ ] **Step 1: Add CommentReaction Prisma model**

In `prisma/schema.prisma`, add after the Comment model (after line 264):

```prisma
model CommentReaction {
  id        String   @id @default(cuid())
  commentId String
  userId    String
  emoji     String
  createdAt DateTime @default(now())

  comment Comment @relation(fields: [commentId], references: [id], onDelete: Cascade)

  @@unique([commentId, userId, emoji])
  @@index([commentId])
}
```

Also update the Comment model to add the relation. In the Comment model, add before `@@index([pageId])`:

```prisma
  reactions_rel CommentReaction[]
```

- [ ] **Step 2: Run Prisma migration**

```bash
npx prisma migrate dev --name add_comment_reaction_model
```

- [ ] **Step 3: Create comment reactions component**

Create `src/components/comments/comment-reactions.tsx`:

```tsx
"use client";

import { useState } from "react";
import { SmilePlus } from "lucide-react";
import { trpc } from "@/server/trpc/client";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "😮", "👀", "🔥", "✅"];

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
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma src/server/routers/comment.ts src/components/comments/comment-reactions.tsx
git commit -m "feat: add comment emoji reactions with dedicated model and quick-pick UI"
```

---

### Task 7: Editing Lock Display
**Files:**
- Modify: `src/components/layout/topbar.tsx`

- [ ] **Step 1: Add lock indicator and auto-unlock timer to topbar**

In `src/components/layout/topbar.tsx`, find the `isLocked` variable (line 326: `const isLocked = currentPage?.isLocked ?? false;`). Add below it:

```typescript
  const [lockCountdown, setLockCountdown] = useState<number | null>(null);
  const lockTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-unlock after 30 minutes of locking
  useEffect(() => {
    if (!isLocked || !pageId) {
      setLockCountdown(null);
      if (lockTimerRef.current) clearInterval(lockTimerRef.current);
      return;
    }

    // Set 30-minute countdown
    const lockDuration = 30 * 60; // seconds
    setLockCountdown(lockDuration);

    lockTimerRef.current = setInterval(() => {
      setLockCountdown((prev) => {
        if (prev === null || prev <= 1) {
          // Auto-unlock
          updatePage.mutate({ id: pageId, isLocked: false });
          if (lockTimerRef.current) clearInterval(lockTimerRef.current);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    };
  }, [isLocked, pageId]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };
```

Then in the JSX, add the lock indicator right before the breadcrumbs section (after the back/forward buttons area, before `{/* Breadcrumbs with child dropdown (2.8) */}`):

```tsx
        {/* Lock indicator */}
        {isLocked && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs flex-shrink-0"
            style={{
              backgroundColor: "rgba(235, 87, 87, 0.1)",
              color: "#eb5757",
              border: "1px solid rgba(235, 87, 87, 0.2)",
            }}
          >
            <Lock size={12} />
            <span>Locked</span>
            {lockCountdown !== null && (
              <span style={{ color: "var(--text-tertiary)", fontSize: "10px" }}>
                ({formatCountdown(lockCountdown)})
              </span>
            )}
          </div>
        )}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/topbar.tsx
git commit -m "feat: add editing lock display with auto-unlock timer countdown in topbar"
```
