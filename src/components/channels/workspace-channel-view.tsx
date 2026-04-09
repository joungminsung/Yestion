"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckSquare,
  Crown,
  FileText,
  Hash,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  Pencil,
  Send,
  Trash2,
  Volume2,
  Vote,
  VolumeX,
} from "lucide-react";
import { trpc } from "@/server/trpc/client";
import type { AppRouter } from "@/server/trpc/router";
import { useToastStore } from "@/stores/toast";
import { useVoiceConnectionStore } from "@/stores/voice-connection";
import { cn } from "@/lib/utils";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ChannelMessage = RouterOutputs["channel"]["listMessages"]["messages"][number];
type ChannelSignalEvent = {
  fromUserId: string;
  targetUserId: string | null;
  signalType: "offer" | "answer" | "ice-candidate" | "peer-left";
  data: unknown;
};

function formatTime(value: string | Date) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDateSep(date: Date | string) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "오늘";
  if (d.toDateString() === yesterday.toDateString()) return "어제";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "🤔", "👀"];

const SLASH_COMMANDS = [
  { cmd: "/poll", label: "투표 만들기", desc: "질문 | 선택1 | 선택2", icon: <Vote size={14} /> },
  { cmd: "/task", label: "할일 만들기", desc: "할일 내용", icon: <CheckSquare size={14} /> },
];

// Markdown-like inline renderer
function MessageContent({
  content,
  workspaceId,
  members,
}: {
  content: string;
  workspaceId: string;
  members: { user: { id: string; name: string } }[];
  pages: { id: string; title: string; icon: string | null }[];
}) {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`{3}([\s\S]+?)`{3}|`(.+?)`|@mention\(([^)]+)\)|\[\[([^|]+)\|([^\]]*)\]\]|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <pre key={key++} className="my-1 overflow-x-auto rounded border p-2 text-xs" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-secondary)" }}>
          <code>{match[4].trim()}</code>
        </pre>
      );
    } else if (match[5]) {
      parts.push(
        <code key={key++} className="rounded px-1 py-0.5 text-[13px]" style={{ backgroundColor: "var(--bg-secondary)", color: "#e03e3e" }}>
          {match[5]}
        </code>
      );
    } else if (match[6]) {
      const member = members.find((m) => m.user.id === match![6]);
      parts.push(
        <span key={key++} className="rounded px-1 py-0.5 text-sm font-medium" style={{ backgroundColor: "rgba(35,131,226,0.1)", color: "#2383e2" }}>
          @{member?.user.name ?? "알 수 없음"}
        </span>
      );
    } else if (match[7]) {
      parts.push(
        <a key={key++} href={`/${workspaceId}/${match[7]}`} className="text-sm font-medium underline" style={{ color: "#2383e2" }}>
          {match[8] || "페이지"}
        </a>
      );
    } else if (match[9] && match[10]) {
      parts.push(
        <a key={key++} href={match[10]} target="_blank" rel="noreferrer" className="underline" style={{ color: "#2383e2" }}>
          {match[9]}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return <p className="whitespace-pre-wrap">{parts}</p>;
}

// ============================================================================
// Main component
// ============================================================================

export function WorkspaceChannelView({
  workspaceId,
  channelId,
}: {
  workspaceId: string;
  channelId: string;
}) {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const currentUserQuery = trpc.user.me.useQuery(undefined, { refetchOnWindowFocus: false });
  const currentUser = currentUserQuery.data;
  const capabilitiesQuery = trpc.channel.getCapabilities.useQuery(
    { workspaceId },
    { enabled: Boolean(workspaceId), refetchOnWindowFocus: false, staleTime: 60_000 },
  );
  const capabilities = capabilitiesQuery.data;

  // ---------------------------------------------------------------------------
  // Text channel state
  // ---------------------------------------------------------------------------
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showPageMenu, setShowPageMenu] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageQuery, setPageQuery] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastMarkedMessageIdRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // Voice channel state (from global store)
  // ---------------------------------------------------------------------------
  const voiceStore = useVoiceConnectionStore();
  const isVoiceJoined = voiceStore.isJoined && voiceStore.channelId === channelId;

  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------
  const channelQuery = trpc.channel.get.useQuery(
    { id: channelId },
    { refetchOnWindowFocus: false },
  );
  const channel = channelQuery.data;
  const pagesQuery = trpc.page.list.useQuery(
    { workspaceId },
    { enabled: Boolean(workspaceId), refetchOnWindowFocus: false, staleTime: 60_000 },
  );
  const messagesQuery = trpc.channel.listMessages.useQuery(
    { channelId, limit: channel?.type === "voice" ? 40 : 100 },
    { enabled: Boolean(channel), refetchOnWindowFocus: false },
  );
  const membersQuery = trpc.workspace.members.useQuery(
    { workspaceId },
    { enabled: Boolean(workspaceId), refetchOnWindowFocus: false, staleTime: 60_000 },
  );
  const workspaceMembers = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------
  const handleMutationError = (message: string) => addToast({ type: "error", message });
  const markRead = trpc.channel.markRead.useMutation({
    onSuccess: () => { void utils.channel.list.invalidate({ workspaceId }); void utils.channel.get.invalidate({ id: channelId }); },
  });
  const sendMessage = trpc.channel.sendMessage.useMutation({
    onSuccess: (data) => {
      setDraft("");
      setMessages((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data]);
    },
    onError: (error) => handleMutationError(error.message),
  });
  const editMessage = trpc.channel.editMessage.useMutation({
    onSuccess: (data) => {
      setEditingMessageId(null);
      setMessages((prev) => prev.map((m) => (m.id === data.id ? { ...m, content: data.content, editedAt: data.editedAt, metadata: data.metadata } : m)));
    },
    onError: (error) => handleMutationError(error.message),
  });
  const deleteMessage = trpc.channel.deleteMessage.useMutation({
    onSuccess: (_, variables) => {
      setMessages((prev) => prev.map((m) => (m.id === variables.messageId ? { ...m, isDeleted: true, content: "" } : m)));
    },
    onError: (error) => handleMutationError(error.message),
  });
  const toggleReaction = trpc.channel.toggleReaction.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => prev.map((m) => (m.id === data.id ? { ...m, metadata: data.metadata } : m)));
    },
    onError: (error) => handleMutationError(error.message),
  });
  // ---------------------------------------------------------------------------
  // Sync current user + participants to global voice store
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (currentUser) {
      voiceStore.setCurrentUser({ id: currentUser.id, name: currentUser.name });
    }
  }, [currentUser]);

  useEffect(() => {
    if (channel?.type === "voice" && isVoiceJoined) {
      voiceStore.setParticipants(channel.activeVoiceParticipants);
    }
  }, [channel?.activeVoiceParticipants, isVoiceJoined]);

  // ---------------------------------------------------------------------------
  // SSE stream for chat messages + browser updates (NOT voice signals — those
  // are handled by the global VoiceProvider)
  // ---------------------------------------------------------------------------
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const closeStream = () => {
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    };
    window.addEventListener("channel:close-stream", closeStream);
    return () => { window.removeEventListener("channel:close-stream", closeStream); closeStream(); };
  }, []);

  useEffect(() => {
    if (eventSourceRef.current) eventSourceRef.current.close();

    const es = new EventSource(`/api/channels/stream?channelId=${channelId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { kind: string; payload: unknown };

        if (parsed.kind === "message.created") {
          const nextMessage = parsed.payload as ChannelMessage & { createdAt: string };
          setMessages((previous) => {
            const existingIdx = previous.findIndex((m) => m.id === nextMessage.id);
            const normalized = { ...nextMessage, createdAt: new Date(nextMessage.createdAt) };
            if (existingIdx >= 0) {
              const updated = [...previous];
              updated[existingIdx] = normalized;
              return updated;
            }
            return [...previous, normalized];
          });
          return;
        }

        if (parsed.kind === "voice.presence.updated") {
          void utils.channel.get.invalidate({ id: channelId });
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      void utils.channel.get.invalidate({ id: channelId });
    };

    return () => { es.close(); eventSourceRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Sync query data → local messages state
  const queryMessages = messagesQuery.data?.messages;
  const queryMessageKey = queryMessages?.map((m) => m.id).join(",") ?? "";
  useEffect(() => { if (queryMessages) setMessages(queryMessages); }, [queryMessageKey]);

  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;

  useEffect(() => {
    if (!channel || !messagesQuery.data?.messages) return;
    const latestMessageId = messagesQuery.data.messages.at(-1)?.id ?? null;
    if (!latestMessageId || latestMessageId === lastMarkedMessageIdRef.current) return;
    lastMarkedMessageIdRef.current = latestMessageId;
    markReadRef.current.mutate({ channelId });
  }, [channel, channelId, messagesQuery.data?.messages]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { lastMarkedMessageIdRef.current = null; }, [channelId]);

  // ---------------------------------------------------------------------------
  // Derived voice state
  // ---------------------------------------------------------------------------
  const hasServerVoicePresence = useMemo(() => {
    if (!channel || channel.type !== "voice" || !currentUser) return false;
    return channel.activeVoiceParticipants.some((p) => p.userId === currentUser.id);
  }, [channel, currentUser]);
  const hasDetachedVoicePresence = hasServerVoicePresence && !isVoiceJoined;

  const screenSharingPeers = useMemo(
    () => voiceStore.remotePeers.filter((p) => p.hasScreenShare),
    [voiceStore.remotePeers],
  );
  const peerStatusByUserId = useMemo(
    () => new Map(voiceStore.remotePeers.map((p) => [p.userId, { connectionState: p.connectionState, hasScreenShare: p.hasScreenShare }])),
    [voiceStore.remotePeers],
  );

  const roomState = channel?.type === "voice" ? channel.roomState : null;
  const quickPages = useMemo(() => (pagesQuery.data ?? []).slice(0, 5), [pagesQuery.data]);

  // ---------------------------------------------------------------------------
  // Text channel handlers
  // ---------------------------------------------------------------------------
  const filteredSlashCommands = useMemo(() => {
    const q = draft.toLowerCase();
    if (!q.startsWith("/")) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter((c) => c.cmd.startsWith(q));
  }, [draft]);
  const filteredMembers = useMemo(() => {
    if (!mentionQuery) return workspaceMembers.slice(0, 8);
    const q = mentionQuery.toLowerCase();
    return workspaceMembers.filter((m) => m.user.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionQuery, workspaceMembers]);
  const filteredPages = useMemo(() => {
    const allPages = pagesQuery.data ?? [];
    if (!pageQuery) return allPages.slice(0, 8);
    const q = pageQuery.toLowerCase();
    return allPages.filter((p) => (p.title || "").toLowerCase().includes(q)).slice(0, 8);
  }, [pageQuery, pagesQuery.data]);

  const handleSendMessage = useCallback(() => {
    const nextDraft = draft.trim();
    if (!nextDraft) return;
    if (nextDraft.startsWith("/poll ")) {
      const parts = nextDraft.slice(6).split("|").map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        sendMessage.mutate({ channelId, content: parts[0]!, type: "text", metadata: { type: "poll", options: parts.slice(1).map((text) => ({ text, voters: [] as string[] })) } });
        return;
      }
    }
    if (nextDraft.startsWith("/task ")) {
      const taskContent = nextDraft.slice(6).trim();
      if (taskContent) {
        sendMessage.mutate({ channelId, content: taskContent, type: "text", metadata: { type: "task", done: false } });
        return;
      }
    }
    sendMessage.mutate({ channelId, content: nextDraft });
  }, [draft, channelId, sendMessage]);

  const handleEditSubmit = useCallback(() => {
    if (!editingMessageId || !editDraft.trim()) return;
    editMessage.mutate({ messageId: editingMessageId, content: editDraft.trim() });
  }, [editingMessageId, editDraft, editMessage]);

  const handleDraftChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraft(val);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    if (val.startsWith("/") && !val.includes(" ")) { setShowSlashMenu(true); setSlashIndex(0); } else { setShowSlashMenu(false); }
    const mentionMatch = val.match(/@(\w*)$/);
    if (mentionMatch) { setShowMentionMenu(true); setMentionQuery(mentionMatch[1] ?? ""); setMentionIndex(0); } else { setShowMentionMenu(false); }
    const pageMatch = val.match(/\[\[([^\]]*)$/);
    if (pageMatch) { setShowPageMenu(true); setPageQuery(pageMatch[1] ?? ""); setPageIndex(0); } else { setShowPageMenu(false); }
  }, []);

  const handleSlashSelect = useCallback((cmd: typeof SLASH_COMMANDS[number]) => { setDraft(cmd.cmd + " "); setShowSlashMenu(false); inputRef.current?.focus(); }, []);
  const handleMentionSelect = useCallback((member: { user: { id: string; name: string } }) => { setDraft((prev) => prev.replace(/@\w*$/, `@mention(${member.user.id}) `)); setShowMentionMenu(false); inputRef.current?.focus(); }, []);
  const handlePageSelect = useCallback((page: { id: string; title: string }) => { setDraft((prev) => prev.replace(/\[\[[^\]]*$/, `[[${page.id}|${page.title || "제목 없음"}]] `)); setShowPageMenu(false); inputRef.current?.focus(); }, []);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIndex((i) => Math.min(i + 1, filteredSlashCommands.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSlashIndex((i) => Math.max(i - 1, 0)); return; }
      if ((e.key === "Enter" || e.key === "Tab") && filteredSlashCommands[slashIndex]) { e.preventDefault(); handleSlashSelect(filteredSlashCommands[slashIndex]); return; }
      if (e.key === "Escape") { e.preventDefault(); setShowSlashMenu(false); return; }
    }
    if (showMentionMenu) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, filteredMembers.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return; }
      if ((e.key === "Enter" || e.key === "Tab") && filteredMembers[mentionIndex]) { e.preventDefault(); handleMentionSelect(filteredMembers[mentionIndex]); return; }
      if (e.key === "Escape") { e.preventDefault(); setShowMentionMenu(false); return; }
    }
    if (showPageMenu) {
      if (e.key === "ArrowDown") { e.preventDefault(); setPageIndex((i) => Math.min(i + 1, filteredPages.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setPageIndex((i) => Math.max(i - 1, 0)); return; }
      if ((e.key === "Enter" || e.key === "Tab") && filteredPages[pageIndex]) { e.preventDefault(); handlePageSelect(filteredPages[pageIndex]); return; }
      if (e.key === "Escape") { e.preventDefault(); setShowPageMenu(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSendMessage(); }
  }, [showSlashMenu, showMentionMenu, showPageMenu, slashIndex, mentionIndex, pageIndex, filteredSlashCommands, filteredMembers, filteredPages, handleSlashSelect, handleMentionSelect, handlePageSelect, handleSendMessage]);

  // ---------------------------------------------------------------------------
  // Voice channel handlers
  // ---------------------------------------------------------------------------
  async function handleScreenShareToggle() {
    if (!capabilities?.screenShareEnabled) { handleMutationError("화면 공유 기능이 현재 비활성화되어 있습니다."); return; }
    if (voiceStore.isScreenSharing) {
      await voiceStore.stopScreenShare();
      return;
    }
    try {
      await voiceStore.startScreenShare();
    } catch (error) {
      if (error instanceof Error) handleMutationError(error.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Loading / not found
  // ---------------------------------------------------------------------------
  if (channelQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin" size={20} style={{ color: "var(--text-tertiary)" }} />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="max-w-4xl px-6 py-10">
        <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>채널을 찾을 수 없습니다</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>권한이 없거나 삭제된 채널일 수 있습니다.</p>
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex h-full min-h-0 w-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      {channel.type === "text" ? (
        <>
          {/* ================================================================
              TEXT CHANNEL
              ================================================================ */}
          {/* Header */}
          <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4" style={{ borderColor: "var(--border-default)" }}>
            <Hash size={16} style={{ color: "var(--text-tertiary)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{channel.name}</span>
            {(channel.topic || channel.description) && (
              <>
                <div className="h-4 w-px" style={{ backgroundColor: "var(--border-default)" }} />
                <span className="truncate text-xs" style={{ color: "var(--text-tertiary)" }}>{channel.topic || channel.description}</span>
              </>
            )}
            {channel.teamspace && (
              <span className="ml-auto rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-tertiary)" }}>
                {channel.teamspace.name}
              </span>
            )}
          </div>

          {/* Messages */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4" ref={scrollContainerRef}>
            {messagesQuery.isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="animate-spin" size={18} style={{ color: "var(--text-tertiary)" }} />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col justify-end pb-4">
                <div className="max-w-2xl">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-tertiary)" }}>
                    <Hash size={20} />
                  </div>
                  <h2 className="mt-3 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>#{channel.name}</h2>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>채널의 시작입니다. 첫 메시지를 남겨보세요.</p>
                </div>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-3xl py-4">
                {messages.map((message, idx) => {
                  const prev = idx > 0 ? messages[idx - 1] : null;
                  const isGrouped = prev && prev.user.id === message.user.id && !prev.isDeleted && new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() < 120_000;
                  const prevDate = prev ? new Date(prev.createdAt).toDateString() : null;
                  const curDate = new Date(message.createdAt).toDateString();
                  const showDateSep = prevDate !== curDate;
                  const meta = (message.metadata ?? {}) as Record<string, unknown>;
                  const reactions = (meta.reactions ?? {}) as Record<string, string[]>;
                  const isEditing = editingMessageId === message.id;
                  const isPoll = message.type === "poll" || meta.type === "poll";
                  const isTask = message.type === "task" || meta.type === "task";

                  return (
                    <div key={message.id}>
                      {showDateSep && (
                        <div className="my-4 flex items-center gap-3">
                          <div className="flex-1 border-t" style={{ borderColor: "var(--border-default)" }} />
                          <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>{formatDateSep(message.createdAt)}</span>
                          <div className="flex-1 border-t" style={{ borderColor: "var(--border-default)" }} />
                        </div>
                      )}
                      <article className={cn("group relative px-4 py-0.5 -mx-4 transition-colors hover:bg-[var(--bg-secondary)]", !isGrouped && "mt-3 pt-2")}>
                        {message.isDeleted ? (
                          <div className="flex items-center gap-2 py-1 pl-12">
                            <span className="text-sm italic" style={{ color: "var(--text-tertiary)" }}>삭제된 메시지입니다</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex gap-2">
                              {!isGrouped ? (
                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: "#2383e2" }}>
                                  {getInitials(message.user.name)}
                                </div>
                              ) : (
                                <div className="flex h-5 w-8 shrink-0 items-center justify-center">
                                  <span className="hidden text-[9px] group-hover:inline" style={{ color: "var(--text-tertiary)" }}>
                                    {new Date(message.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false })}
                                  </span>
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                {!isGrouped && (
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{message.user.name}</span>
                                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{formatTime(message.createdAt)}</span>
                                    {message.editedAt && <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>(수정됨)</span>}
                                  </div>
                                )}

                                {isEditing ? (
                                  <div className="mt-1">
                                    <textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleEditSubmit(); } if (e.key === "Escape") setEditingMessageId(null); }} className="w-full rounded border bg-transparent px-2 py-1 text-sm outline-none" style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", resize: "none" }} rows={2} autoFocus />
                                    <div className="mt-1 flex gap-2 text-xs">
                                      <button onClick={handleEditSubmit} disabled={editMessage.isPending} className="rounded px-2 py-0.5 text-white" style={{ backgroundColor: "#2383e2" }}>저장</button>
                                      <button onClick={() => setEditingMessageId(null)} className="rounded px-2 py-0.5" style={{ color: "var(--text-secondary)" }}>취소</button>
                                    </div>
                                  </div>
                                ) : isPoll ? (
                                  <div className="mt-1 rounded-lg border p-3" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-secondary)" }}>
                                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{message.content}</p>
                                    {((meta.options ?? []) as { text: string; voters: string[] }[]).map((opt, oi) => {
                                      const totalVotes = ((meta.options ?? []) as { text: string; voters: string[] }[]).reduce((s, o) => s + o.voters.length, 0);
                                      const pct = totalVotes > 0 ? Math.round((opt.voters.length / totalVotes) * 100) : 0;
                                      const voted = currentUser && opt.voters.includes(currentUser.id);
                                      return (
                                        <button key={oi} onClick={() => toggleReaction.mutate({ messageId: message.id, emoji: `poll:${oi}` })} className="mt-2 flex w-full items-center gap-2 rounded border px-3 py-1.5 text-left text-sm" style={{ borderColor: voted ? "rgba(35,131,226,0.4)" : "var(--border-default)", backgroundColor: voted ? "rgba(35,131,226,0.06)" : "transparent", color: "var(--text-primary)" }}>
                                          <span className="flex-1">{opt.text}</span>
                                          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{pct}%</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : isTask ? (
                                  <div className="mt-1 flex items-center gap-2">
                                    <div className="h-4 w-4 rounded border" style={{ borderColor: "var(--border-default)" }} />
                                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>{message.content}</span>
                                  </div>
                                ) : (
                                  <div className="text-sm leading-6" style={{ color: "var(--text-primary)" }}>
                                    <MessageContent content={message.content} workspaceId={workspaceId} members={workspaceMembers} pages={quickPages} />
                                  </div>
                                )}

                                {Object.keys(reactions).length > 0 && !isEditing && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {Object.entries(reactions).map(([emoji, voters]) => (
                                      <button key={emoji} onClick={() => toggleReaction.mutate({ messageId: message.id, emoji })} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: currentUser && voters.includes(currentUser.id) ? "rgba(35,131,226,0.4)" : "var(--border-default)", backgroundColor: currentUser && voters.includes(currentUser.id) ? "rgba(35,131,226,0.06)" : "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                                        <span>{emoji}</span><span>{voters.length}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {!isEditing && (
                              <div className="absolute -top-3 right-4 hidden rounded border bg-[var(--bg-primary)] shadow-sm group-hover:flex" style={{ borderColor: "var(--border-default)" }}>
                                {QUICK_REACTIONS.map((emoji) => (
                                  <button key={emoji} onClick={() => toggleReaction.mutate({ messageId: message.id, emoji })} className="px-1.5 py-1 text-sm hover:bg-[var(--bg-secondary)]">{emoji}</button>
                                ))}
                                {message.user.id === currentUser?.id && (
                                  <>
                                    <button onClick={() => { setEditingMessageId(message.id); setEditDraft(message.content); }} className="px-1.5 py-1 hover:bg-[var(--bg-secondary)]" style={{ color: "var(--text-tertiary)" }}><Pencil size={14} /></button>
                                    <button onClick={() => { if (confirm("메시지를 삭제하시겠습니까?")) deleteMessage.mutate({ messageId: message.id }); }} className="px-1.5 py-1 hover:bg-[var(--bg-secondary)]" style={{ color: "var(--text-tertiary)" }}><Trash2 size={14} /></button>
                                  </>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </article>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t px-4 py-3" style={{ borderColor: "var(--border-default)" }}>
            <div className="mx-auto w-full max-w-3xl">
              {showSlashMenu && (
                <div className="mb-2 rounded-lg border py-1 shadow-sm" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)" }}>
                  {filteredSlashCommands.map((cmd, i) => (
                    <button key={cmd.cmd} onClick={() => handleSlashSelect(cmd)} className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm", i === slashIndex && "bg-[var(--bg-secondary)]")} style={{ color: "var(--text-primary)" }}>
                      <span style={{ color: "var(--text-tertiary)" }}>{cmd.icon}</span>
                      <span className="font-medium">{cmd.cmd}</span>
                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{cmd.desc}</span>
                    </button>
                  ))}
                </div>
              )}
              {showMentionMenu && (
                <div className="mb-2 max-h-48 overflow-y-auto rounded-lg border py-1 shadow-sm" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)" }}>
                  {filteredMembers.map((m, i) => (
                    <button key={m.user.id} onClick={() => handleMentionSelect(m)} className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm", i === mentionIndex && "bg-[var(--bg-secondary)]")} style={{ color: "var(--text-primary)" }}>
                      <div className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: "#2383e2" }}>{getInitials(m.user.name)}</div>
                      {m.user.name}
                    </button>
                  ))}
                </div>
              )}
              {showPageMenu && (
                <div className="mb-2 max-h-48 overflow-y-auto rounded-lg border py-1 shadow-sm" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)" }}>
                  {filteredPages.map((p, i) => (
                    <button key={p.id} onClick={() => handlePageSelect(p)} className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm", i === pageIndex && "bg-[var(--bg-secondary)]")} style={{ color: "var(--text-primary)" }}>
                      {p.icon ? <span>{p.icon}</span> : <FileText size={14} style={{ color: "var(--text-tertiary)" }} />}
                      {p.title || "제목 없음"}
                    </button>
                  ))}
                </div>
              )}
              <div className="rounded-lg border" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-secondary)" }}>
                <textarea ref={inputRef} value={draft} onChange={handleDraftChange} onKeyDown={handleInputKeyDown} rows={1} placeholder={`#${channel.name}에 메시지 보내기 — / 슬래시 커맨드, @ 멘션, [[ 페이지 링크`} className="block w-full resize-none bg-transparent px-3 py-2 text-sm outline-none" style={{ color: "var(--text-primary)", minHeight: "36px", maxHeight: "120px" }} />
                <div className="flex items-center justify-between px-3 pb-2">
                  <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>**볼드** *이탤릭* `코드` Enter 전송 · Shift+Enter 줄바꿈</span>
                  <button onClick={handleSendMessage} disabled={sendMessage.isPending || !draft.trim()} className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#2383e2" }}>
                    {sendMessage.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ================================================================
              VOICE CHANNEL — simplified layout
              ================================================================ */}

          {/* Header */}
          <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4" style={{ borderColor: "var(--border-default)" }}>
            <Volume2 size={16} style={{ color: "var(--text-tertiary)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{channel.name}</span>
            {(channel.topic || channel.description) && (
              <>
                <div className="h-4 w-px" style={{ backgroundColor: "var(--border-default)" }} />
                <span className="truncate text-xs" style={{ color: "var(--text-tertiary)" }}>{channel.topic || channel.description}</span>
              </>
            )}
            <span className="ml-auto text-xs" style={{ color: "var(--text-tertiary)" }}>
              참여자 {channel.activeVoiceParticipants.length}명
            </span>
          </div>

          {/* Voice main content */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* ---- Expanded panel (full area takeover) ---- */}
            {expandedPanel && (
              <div className="relative flex min-h-0 flex-1 flex-col">
                <button onClick={() => setExpandedPanel(null)} className="absolute right-3 top-3 z-10 rounded-lg border p-1.5 shadow-sm hover:bg-[var(--bg-secondary)]" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)" }}>
                  <Minimize2 size={16} />
                </button>
                {expandedPanel === "screen:local" && voiceStore.localScreenStream && (
                  <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
                    <video autoPlay muted playsInline className="h-full w-full object-contain" ref={(node) => { if (node && voiceStore.localScreenStream && node.srcObject !== voiceStore.localScreenStream) node.srcObject = voiceStore.localScreenStream; }} />
                  </div>
                )}
                {expandedPanel?.startsWith("screen:") && expandedPanel !== "screen:local" && (() => {
                  const peerId = expandedPanel.slice(7);
                  const peer = screenSharingPeers.find((p) => p.userId === peerId);
                  return peer ? (
                    <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
                      <video autoPlay muted playsInline className="h-full w-full object-contain" ref={(node) => { if (node && peer.stream && node.srcObject !== peer.stream) node.srcObject = peer.stream; }} />
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* ---- Normal view ---- */}
            {!expandedPanel && (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="mx-auto max-w-3xl space-y-4">
                  {/* Alerts */}
                  {voiceStore.error && (
                    <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "rgba(224,62,62,0.2)", backgroundColor: "rgba(224,62,62,0.06)", color: "#b42318" }}>
                      {voiceStore.error}
                    </div>
                  )}
                  {hasDetachedVoicePresence && (
                    <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "rgba(245,158,11,0.24)", backgroundColor: "rgba(245,158,11,0.08)", color: "#9a6700" }}>
                      음성 세션이 끊겼습니다. &quot;재입장&quot;을 눌러 복구하세요.
                    </div>
                  )}

                  {/* Screen share area */}
                  {(voiceStore.localScreenStream || screenSharingPeers.length > 0) && (
                    <div className="grid gap-3 md:grid-cols-2">
                      {voiceStore.localScreenStream && (
                        <div className="group/vid relative overflow-hidden rounded-lg border" style={{ borderColor: "var(--border-default)" }}>
                          <div className="flex items-center justify-between px-3 py-1.5 text-xs" style={{ backgroundColor: "var(--bg-secondary)" }}>
                            <span style={{ color: "var(--text-primary)" }}>내 화면</span>
                            <div className="flex items-center gap-2">
                              <span style={{ color: "#2383e2" }}>LIVE</span>
                              <button onClick={() => setExpandedPanel("screen:local")} className="rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--bg-primary)] group-hover/vid:opacity-100" style={{ color: "var(--text-tertiary)" }}><Maximize2 size={12} /></button>
                            </div>
                          </div>
                          <div className="aspect-video bg-black">
                            <video autoPlay muted playsInline className="h-full w-full object-contain" ref={(node) => { if (node && voiceStore.localScreenStream && node.srcObject !== voiceStore.localScreenStream) node.srcObject = voiceStore.localScreenStream; }} />
                          </div>
                        </div>
                      )}
                      {screenSharingPeers.map((peer) => (
                        <div key={peer.userId} className="group/vid relative overflow-hidden rounded-lg border" style={{ borderColor: "var(--border-default)" }}>
                          <div className="flex items-center justify-between px-3 py-1.5 text-xs" style={{ backgroundColor: "var(--bg-secondary)" }}>
                            <span style={{ color: "var(--text-primary)" }}>{peer.displayName}</span>
                            <div className="flex items-center gap-2">
                              <span style={{ color: "#16a34a" }}>REMOTE</span>
                              <button onClick={() => setExpandedPanel(`screen:${peer.userId}`)} className="rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--bg-primary)] group-hover/vid:opacity-100" style={{ color: "var(--text-tertiary)" }}><Maximize2 size={12} /></button>
                            </div>
                          </div>
                          <div className="aspect-video bg-black">
                            <video autoPlay muted playsInline className="h-full w-full object-contain" ref={(node) => { if (node && peer.stream && node.srcObject !== peer.stream) node.srcObject = peer.stream; }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Participant grid */}
                  <div>
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                      참여자 — {channel.activeVoiceParticipants.length}명
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {channel.activeVoiceParticipants.map((p) => {
                        const peerStatus = peerStatusByUserId.get(p.userId);
                        const isMe = p.userId === currentUser?.id;
                        return (
                          <div key={p.id} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-secondary)" }}>
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: "#2383e2" }}>
                              {getInitials(p.displayName)}
                            </div>
                            <p className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>{p.displayName}</p>
                            <div className="flex gap-1">
                              {isMe && isVoiceJoined && voiceStore.isMuted && <MicOff size={12} style={{ color: "#e03e3e" }} />}
                              {isMe && isVoiceJoined && voiceStore.isScreenSharing && <MonitorUp size={12} style={{ color: "#2383e2" }} />}
                              {p.userId === roomState?.hostUserId && <Crown size={12} style={{ color: "var(--text-tertiary)" }} />}
                              {!isMe && peerStatus?.connectionState === "connected" && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#16a34a" }} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ---- Bottom control bar ---- */}
            <div className="flex shrink-0 items-center justify-center gap-2 border-t px-4 py-3" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-secondary)" }}>
              {isVoiceJoined && (
                <>
                  <button onClick={voiceStore.toggleMute} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm" style={{ color: voiceStore.isMuted ? "#e03e3e" : "var(--text-primary)", backgroundColor: "var(--bg-primary)" }}>
                    {voiceStore.isMuted ? <MicOff size={15} /> : <Mic size={15} />}
                    {voiceStore.isMuted ? "음소거" : "마이크"}
                  </button>
                  <button onClick={voiceStore.toggleDeafen} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm" style={{ color: voiceStore.isDeafened ? "#e03e3e" : "var(--text-primary)", backgroundColor: "var(--bg-primary)" }}>
                    {voiceStore.isDeafened ? <VolumeX size={15} /> : <Volume2 size={15} />}
                    스피커
                  </button>
                  <button onClick={() => void handleScreenShareToggle()} disabled={capabilities?.screenShareEnabled === false} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm" style={{ color: voiceStore.isScreenSharing ? "#2383e2" : "var(--text-primary)", backgroundColor: "var(--bg-primary)" }}>
                    <MonitorUp size={15} />화면
                  </button>
                  {voiceStore.availableAudioInputs.length > 1 && (
                    <select value={voiceStore.selectedAudioInputId ?? ""} onChange={(e) => void voiceStore.switchAudioInput(e.target.value)} className="h-8 rounded-lg border px-2 text-xs outline-none" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)" }}>
                      {voiceStore.availableAudioInputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                    </select>
                  )}
                </>
              )}
              <button
                onClick={() => {
                  if (isVoiceJoined) {
                    void voiceStore.leaveRoom();
                  } else {
                    void voiceStore.joinRoom({ channelId, channelName: channel.name, workspaceId });
                  }
                }}
                disabled={voiceStore.status === "joining" || capabilities?.voiceEnabled === false || currentUserQuery.isLoading || !currentUser}
                className="rounded-lg px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: isVoiceJoined ? "#e03e3e" : "#2383e2" }}
              >
                {voiceStore.status === "joining" ? "연결 중…" : isVoiceJoined ? "나가기" : hasDetachedVoicePresence ? "재입장" : "입장"}
              </button>
            </div>
          </div>

          {/* Hidden audio elements for remote peers */}
          {voiceStore.remotePeers.map((peer) => (
            <audio key={peer.userId} autoPlay playsInline muted={voiceStore.isDeafened} className="hidden" ref={(node) => { if (node && peer.stream && node.srcObject !== peer.stream) node.srcObject = peer.stream; }} />
          ))}
        </>
      )}
    </div>
  );
}
