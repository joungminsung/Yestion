"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";
import { Send, X, Trash2, MessageCircle, FileText, Vote, CheckSquare, Hash, Loader2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────

type ChatUser = { id: string; name: string; avatarUrl: string | null };
type ChatMeta = Record<string, unknown>;
type ChatMsg = {
  id: string;
  content: string;
  type: string;
  metadata: ChatMeta;
  createdAt: Date;
  user: ChatUser;
};

// ── Helpers ─────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(date: Date) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "오늘";
  if (d.toDateString() === yesterday.toDateString()) return "어제";
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

// ── Slash Commands ──────────────────────────────────────────

const SLASH_COMMANDS = [
  { cmd: "/poll", label: "투표 만들기", desc: "/poll 질문 | 선택1 | 선택2 | ...", icon: <Vote size={14} /> },
  { cmd: "/task", label: "할일 만들기", desc: "/task 할일 내용", icon: <CheckSquare size={14} /> },
  { cmd: "/ref", label: "블록 참조", desc: "/ref 블록을 검색해서 첨부", icon: <Hash size={14} /> },
  { cmd: "/clear", label: "입력창 비우기", desc: "입력 내용 초기화", icon: <X size={14} /> },
];

// ── Block Reference Card ────────────────────────────────────

function BlockRefCard({ metadata, onClick }: { metadata: ChatMeta; onClick?: () => void }) {
  const blockType = String(metadata.blockType ?? "paragraph");
  const preview = String(metadata.blockPreview ?? "");
  const typeLabels: Record<string, string> = {
    paragraph: "텍스트", heading_1: "제목 1", heading_2: "제목 2", heading_3: "제목 3",
    bulleted_list: "글머리 기호", numbered_list: "번호 목록", to_do: "할 일", code: "코드",
    quote: "인용", image: "이미지", bookmark: "북마크", callout: "콜아웃",
  };

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-md border px-3 py-2 mt-1 hover:bg-notion-bg-hover transition-colors"
      style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-secondary)" }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Hash size={11} style={{ color: "var(--text-tertiary)" }} />
        <span className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>
          {typeLabels[blockType] ?? blockType}
        </span>
      </div>
      <p className="text-xs leading-relaxed truncate" style={{ color: "var(--text-primary)" }}>
        {preview || "(빈 블록)"}
      </p>
    </button>
  );
}

// ── Poll Card ───────────────────────────────────────────────

function PollCard({ msg, currentUserId, onVote }: {
  msg: ChatMsg; currentUserId: string;
  onVote: (messageId: string, optionIndex: number) => void;
}) {
  const options = ((msg.metadata.options ?? []) as { text: string; voters: string[] }[]);
  const totalVotes = options.reduce((sum, o) => sum + o.voters.length, 0);

  return (
    <div className="rounded-md border p-3 mt-1" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-secondary)" }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Vote size={13} style={{ color: "#2383e2" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>투표</span>
      </div>
      <p className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>{msg.content}</p>
      <div className="space-y-1.5">
        {options.map((opt, i) => {
          const voted = opt.voters.includes(currentUserId);
          const pct = totalVotes > 0 ? Math.round((opt.voters.length / totalVotes) * 100) : 0;
          return (
            <button
              key={i}
              onClick={() => onVote(msg.id, i)}
              className="w-full text-left rounded px-3 py-1.5 text-xs relative overflow-hidden transition-colors"
              style={{
                border: voted ? "1.5px solid #2383e2" : "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <div
                className="absolute inset-0 opacity-10"
                style={{ width: `${pct}%`, backgroundColor: "#2383e2", transition: "width 0.3s" }}
              />
              <span className="relative flex items-center justify-between">
                <span>{opt.text}</span>
                <span style={{ color: "var(--text-tertiary)" }}>{opt.voters.length}표 ({pct}%)</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] mt-2" style={{ color: "var(--text-tertiary)" }}>총 {totalVotes}표</p>
    </div>
  );
}

// ── Task Card ───────────────────────────────────────────────

function TaskCard({ msg, onToggle }: { msg: ChatMsg; onToggle: (messageId: string) => void }) {
  const done = (msg.metadata.done as boolean) ?? false;
  return (
    <button
      onClick={() => onToggle(msg.id)}
      className="flex items-center gap-2 rounded-md border px-3 py-2 mt-1 w-full text-left hover:bg-notion-bg-hover transition-colors"
      style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-secondary)" }}
    >
      <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${done ? "bg-[#2383e2] border-[#2383e2] text-white" : ""}`}
        style={{ borderColor: done ? "#2383e2" : "var(--border-default)" }}
      >
        {done && "✓"}
      </span>
      <span className="text-sm" style={{
        color: "var(--text-primary)",
        textDecoration: done ? "line-through" : "none",
        opacity: done ? 0.5 : 1,
      }}>{msg.content}</span>
    </button>
  );
}

// ── Main Panel ──────────────────────────────────────────────

export function ChatPanel({
  pageId,
  currentUserId,
  onClose,
}: {
  pageId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addToast = useToastStore((s) => s.addToast);
  const [allMessages, setAllMessages] = useState<ChatMsg[]>([]);

  // Initial load
  const { data: initialData, isLoading } = trpc.chat.list.useQuery(
    { pageId, limit: 50 },
    { refetchOnWindowFocus: false }
  );

  useEffect(() => {
    if (initialData?.messages) {
      setAllMessages(initialData.messages.map((m) => ({
        ...m,
        metadata: (m.metadata ?? {}) as ChatMeta,
      })));
    }
  }, [initialData]);

  // Real-time SSE
  useEffect(() => {
    const es = new EventSource(`/api/chat/stream?pageId=${pageId}`);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.id?.startsWith("__delete__")) {
          const deletedId = data.id.replace("__delete__", "");
          setAllMessages((prev) => prev.filter((m) => m.id !== deletedId));
          return;
        }
        // Update existing (for poll/task updates) or add new
        setAllMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === data.id);
          const msg = { ...data, createdAt: new Date(data.createdAt), metadata: data.metadata ?? {} };
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = msg;
            return updated;
          }
          return [...prev, msg];
        });
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [pageId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [allMessages]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // ── Mutations ──────────────────────────────────────────

  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: () => setMessage(""),
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });
  const sendBlockRefMutation = trpc.chat.sendBlockRef.useMutation({
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });
  const createPollMutation = trpc.chat.createPoll.useMutation({
    onSuccess: () => setMessage(""),
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });
  const createTaskMutation = trpc.chat.createTask.useMutation({
    onSuccess: () => setMessage(""),
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });
  const votePollMutation = trpc.chat.votePoll.useMutation({
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });
  const toggleTaskMutation = trpc.chat.toggleTask.useMutation({
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });
  const deleteMutation = trpc.chat.delete.useMutation({
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });

  const pendingActionLabel = sendMutation.isPending
    ? "메시지를 전송하고 있습니다."
    : sendBlockRefMutation.isPending
      ? "문서 블록을 채팅에 첨부하고 있습니다."
      : createPollMutation.isPending
        ? "투표를 만들고 있습니다."
        : createTaskMutation.isPending
          ? "할 일을 만들고 있습니다."
          : votePollMutation.isPending
            ? "투표 결과를 업데이트하고 있습니다."
            : toggleTaskMutation.isPending
              ? "할 일 상태를 업데이트하고 있습니다."
              : deleteMutation.isPending
                ? "메시지를 삭제하고 있습니다."
                : "";

  // ── Send logic ─────────────────────────────────────────

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed) return;

    // /poll 질문 | 옵션1 | 옵션2
    if (trimmed.startsWith("/poll ")) {
      const parts = trimmed.slice(6).split("|").map((s) => s.trim()).filter(Boolean);
      if (parts.length < 3) {
        addToast({ message: "/poll 질문 | 선택1 | 선택2 형식으로 입력하세요", type: "error" });
        return;
      }
      createPollMutation.mutate({ pageId, question: parts[0]!, options: parts.slice(1) });
      return;
    }

    // /task 내용
    if (trimmed.startsWith("/task ")) {
      const task = trimmed.slice(6).trim();
      if (!task) return;
      createTaskMutation.mutate({ pageId, task });
      return;
    }

    // /clear
    if (trimmed === "/clear") {
      setMessage("");
      return;
    }

    // Parse @블록 mentions — format: @[blockId]
    const blockMentionMatch = trimmed.match(/@\[([a-zA-Z0-9_-]+)\]/);
    if (blockMentionMatch) {
      const blockId = blockMentionMatch[1]!;
      const comment = trimmed.replace(/@\[[a-zA-Z0-9_-]+\]/, "").trim();
      sendBlockRefMutation.mutate({ pageId, blockId, comment });
      setMessage("");
      return;
    }

    sendMutation.mutate({ pageId, content: trimmed });
  }, [message, pageId, sendMutation, createPollMutation, createTaskMutation, sendBlockRefMutation, addToast]);

  // ── Slash menu ─────────────────────────────────────────

  const handleInputChange = (val: string) => {
    setMessage(val);
    if (val.startsWith("/")) {
      setShowSlashMenu(true);
      setSlashFilter(val.slice(1).toLowerCase());
    } else {
      setShowSlashMenu(false);
    }
  };

  const filteredCommands = SLASH_COMMANDS.filter(
    (c) => c.cmd.slice(1).includes(slashFilter) || c.label.includes(slashFilter)
  );

  // ── Drag & Drop blocks ────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const blockId = e.dataTransfer.getData("text/block-id");
    if (blockId) {
      const blockType = e.dataTransfer.getData("text/block-type") || "paragraph";
      const blockPreview = e.dataTransfer.getData("text/block-preview") || "";
      sendBlockRefMutation.mutate({ pageId, blockId, blockType, blockPreview, comment: "" });
      return;
    }
    // Fallback: plain text
    const text = e.dataTransfer.getData("text/plain");
    if (text) setMessage((prev) => prev + text);
  };

  // ── Group messages by date ────────────────────────────

  const groupedMessages: { date: string; messages: ChatMsg[] }[] = [];
  let currentDate = "";
  for (const msg of allMessages) {
    const dateStr = new Date(msg.createdAt).toDateString();
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      groupedMessages.push({ date: dateStr, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1]!.messages.push(msg);
    }
  }

  // ── Scroll to block in editor ─────────────────────────

  const scrollToBlock = (blockId: string) => {
    const blockEl = document.querySelector(`[data-block-id="${blockId}"]`);
    if (blockEl) {
      blockEl.scrollIntoView({ behavior: "smooth", block: "center" });
      blockEl.classList.add("notion-block-flash");
      setTimeout(() => blockEl.classList.remove("notion-block-flash"), 1500);
    }
  };

  // ── Render ────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-full"
      style={{ borderLeft: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)" }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border-default)" }}>
        <div className="flex items-center gap-2">
          <MessageCircle size={16} style={{ color: "var(--text-secondary)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>채팅</h3>
          <span className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-tertiary)" }}>
            {allMessages.length}
          </span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-tertiary)" }}>
          <X size={16} />
        </button>
      </div>

      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/5 backdrop-blur-sm rounded-lg pointer-events-none">
          <div className="px-6 py-4 rounded-xl shadow-lg text-sm font-medium"
            style={{ backgroundColor: "var(--bg-primary)", color: "#2383e2", border: "2px dashed #2383e2" }}>
            <FileText size={20} className="inline mr-2" />
            블록을 여기에 놓아 첨부
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 relative">
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <div className="animate-spin w-5 h-5 border-2 border-t-transparent rounded-full"
              style={{ borderColor: "var(--text-tertiary)", borderTopColor: "transparent" }} />
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              채팅 기록을 불러오고 있습니다.
            </p>
          </div>
        )}

        {!isLoading && allMessages.length === 0 && (
          <div className="text-center py-12">
            <MessageCircle size={32} className="mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
            <p className="text-sm mb-2" style={{ color: "var(--text-tertiary)" }}>아직 메시지가 없습니다</p>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              <code>/poll</code> 투표 · <code>/task</code> 할일 · 블록 드래그로 첨부
            </p>
          </div>
        )}

        {groupedMessages.map((group) => (
          <div key={group.date}>
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-divider)" }} />
              <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
                {formatDateSeparator(new Date(group.date))}
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-divider)" }} />
            </div>

            {group.messages.map((msg, i) => {
              const isMine = msg.user.id === currentUserId;
              const prevMsg = i > 0 ? group.messages[i - 1] : null;
              const showHeader = !prevMsg || prevMsg.user.id !== msg.user.id ||
                new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 300000;

              // System messages
              if (msg.type === "system") {
                return (
                  <div key={msg.id} className="text-center text-[11px] py-1" style={{ color: "var(--text-tertiary)" }}>
                    {msg.content}
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`group flex gap-2.5 ${showHeader ? "mt-3" : "mt-0.5"} ${isMine ? "flex-row-reverse" : ""}`}>
                  {/* Avatar */}
                  {showHeader && !isMine ? (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-medium"
                      style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                      {msg.user.avatarUrl
                        ? <img src={msg.user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                        : getInitials(msg.user.name)}
                    </div>
                  ) : !isMine ? <div className="w-7 flex-shrink-0" /> : null}

                  <div className={`max-w-[80%] ${isMine ? "items-end" : "items-start"}`}>
                    {showHeader && (
                      <div className={`flex items-center gap-2 mb-0.5 ${isMine ? "flex-row-reverse" : ""}`}>
                        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                          {isMine ? "나" : msg.user.name}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    )}

                    {/* Message content by type */}
                    {msg.type === "block_ref" ? (
                      <div>
                        {msg.content && msg.content !== "블록 참조" && (
                          <div className="px-3 py-1.5 rounded-lg text-sm mb-1"
                            style={{ backgroundColor: isMine ? "#2383e2" : "var(--bg-secondary)", color: isMine ? "#fff" : "var(--text-primary)" }}>
                            {msg.content}
                          </div>
                        )}
                        <BlockRefCard metadata={msg.metadata} onClick={() => scrollToBlock(String(msg.metadata.blockId))} />
                      </div>
                    ) : msg.type === "poll" ? (
                      <PollCard msg={msg} currentUserId={currentUserId}
                        onVote={(id, idx) => votePollMutation.mutate({ messageId: id, optionIndex: idx })} />
                    ) : msg.type === "task" ? (
                      <TaskCard msg={msg} onToggle={(id) => toggleTaskMutation.mutate({ messageId: id })} />
                    ) : (
                      <div className="relative px-3 py-1.5 rounded-lg text-sm leading-relaxed"
                        style={{
                          backgroundColor: isMine ? "#2383e2" : "var(--bg-secondary)",
                          color: isMine ? "#fff" : "var(--text-primary)",
                          borderRadius: isMine
                            ? showHeader ? "16px 16px 4px 16px" : "16px 4px 4px 16px"
                            : showHeader ? "16px 16px 16px 4px" : "4px 16px 16px 4px",
                        }}>
                        <span className="whitespace-pre-wrap break-words">
                          {renderContent(msg.content)}
                        </span>
                        {isMine && (
                          <button onClick={() => deleteMutation.mutate({ id: msg.id })}
                            className="absolute -left-7 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-notion-bg-hover"
                            style={{ color: "var(--text-tertiary)" }} title="삭제">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Slash command menu */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <div className="mx-4 mb-1 rounded-lg border overflow-hidden"
          style={{ backgroundColor: "var(--bg-primary)", boxShadow: "var(--shadow-popup)", borderColor: "var(--border-default)" }}>
          {filteredCommands.map((cmd) => (
            <button key={cmd.cmd}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-notion-bg-hover"
              onClick={() => { setMessage(cmd.cmd + " "); setShowSlashMenu(false); inputRef.current?.focus(); }}>
              <span style={{ color: "var(--text-secondary)" }}>{cmd.icon}</span>
              <div>
                <div className="text-sm" style={{ color: "var(--text-primary)" }}>{cmd.label}</div>
                <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{cmd.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-3" style={{ borderTop: "1px solid var(--border-default)" }}>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-default)" }}>
          <input ref={inputRef} type="text" value={message}
            onChange={(e) => handleInputChange(e.target.value)}
            onCompositionStart={() => { inputRef.current?.setAttribute("data-composing", "true"); }}
            onCompositionEnd={() => { inputRef.current?.removeAttribute("data-composing"); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && inputRef.current?.getAttribute("data-composing") !== "true") {
                e.preventDefault();
                handleSend();
              }
              if (e.key === "Escape") setShowSlashMenu(false);
            }}
            placeholder="/명령어 또는 메시지 입력..."
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: "var(--text-primary)" }}
            maxLength={2000}
          />
          <button onClick={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
            className="p-1.5 rounded-md transition-colors disabled:opacity-30"
            style={{ backgroundColor: message.trim() ? "#2383e2" : "transparent", color: message.trim() ? "#fff" : "var(--text-tertiary)" }}>
            {pendingActionLabel ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-1.5 px-1">
          {pendingActionLabel ? (
            <span className="text-[10px]" style={{ color: "#2383e2" }}>
              {pendingActionLabel}
            </span>
          ) : (
            <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
              <code>/</code> 명령어 · 블록 드래그로 첨부
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Render message content with @mentions highlighted */
function renderContent(content: string) {
  // Highlight @mentions: @유저이름
  const parts = content.split(/(@\w+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="px-0.5 rounded" style={{ backgroundColor: "rgba(35,131,226,0.15)", color: "#2383e2" }}>
        {part}
      </span>
    ) : part
  );
}
