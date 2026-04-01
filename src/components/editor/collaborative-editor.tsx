"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NotionEditor, type NotionEditorHandle } from "./editor";
import { createCollaborationProvider, getColorForUser } from "@/lib/collaboration/provider";
import { usePresenceStore } from "@/stores/presence";
import { blocksToTiptap } from "./utils/block-serializer";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type * as Y from "yjs";
import type { BlockType, BlockContent } from "@/types/editor";

type Props = {
  pageId: string;
  sessionToken: string;
  user: { id: string; name: string };
  isLocked?: boolean;
  initialBlocks?: { id: string; type: string; content: unknown; position: number; parentId: string | null }[];
};

export function CollaborativeEditor({ pageId, sessionToken, user, isLocked, initialBlocks }: Props) {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [needsHydration, setNeedsHydration] = useState(false);
  const editorRef = useRef<NotionEditorHandle | null>(null);
  const [typingUsers, setTypingUsers] = useState<{ id: string; name: string; color: string }[]>([]);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const presenceUsers = usePresenceStore((s) => s.users);

  // Follow mode: track scroll position via awareness
  const followingUserId = usePresenceStore((s) => s.followingUserId);
  const setFollowing = usePresenceStore((s) => s.setFollowing);

  // Broadcast local scroll position and cursor block via awareness
  useEffect(() => {
    if (!provider?.awareness) return;

    const handleScroll = () => {
      provider.awareness?.setLocalStateField("scrollY", window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [provider]);

  // Exit follow mode on manual scroll
  useEffect(() => {
    if (!followingUserId) return;

    let lastFollowScroll = 0;
    const THRESHOLD = 5;

    const handleManualScroll = () => {
      // If this scroll event was triggered by follow-mode scrollTo, ignore it
      if (Math.abs(window.scrollY - lastFollowScroll) < THRESHOLD) return;
      setFollowing(null);
    };

    // Store a reference so the follow scroll listener can update lastFollowScroll
    const onFollowScroll = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.scrollY !== undefined) {
        lastFollowScroll = detail.scrollY;
      }
    };

    window.addEventListener("scroll", handleManualScroll, { passive: true });
    window.addEventListener("__follow_scroll", onFollowScroll);

    return () => {
      window.removeEventListener("scroll", handleManualScroll);
      window.removeEventListener("__follow_scroll", onFollowScroll);
    };
  }, [followingUserId, setFollowing]);

  // Follow mode: listen to awareness changes and scroll to followed user's position
  useEffect(() => {
    if (!provider?.awareness || !followingUserId) return;

    const handleAwarenessChange = () => {
      if (!provider.awareness) return;
      const states = provider.awareness.getStates();

      // Find the client ID for the followed user
      let followedScrollY: number | null = null;
      states.forEach((state: Record<string, unknown>) => {
        const stateUser = state.user as { id: string } | undefined;
        if (stateUser?.id === followingUserId && typeof state.scrollY === "number") {
          followedScrollY = state.scrollY as number;
        }
      });

      if (followedScrollY !== null) {
        // Dispatch event so the manual scroll handler can distinguish
        window.dispatchEvent(new CustomEvent("__follow_scroll", { detail: { scrollY: followedScrollY } }));
        window.scrollTo({ top: followedScrollY, behavior: "smooth" });
      }
    };

    provider.awareness.on("change", handleAwarenessChange);
    return () => {
      provider.awareness?.off("change", handleAwarenessChange);
    };
  }, [provider, followingUserId]);

  useEffect(() => {
    let cancelled = false;

    const { ydoc: doc, provider: prov } = createCollaborationProvider({ pageId, token: sessionToken });

    prov.on("synced", () => {
      if (cancelled) return;
      setIsConnected(true);

      const fragment = doc.getXmlFragment("default");
      if (fragment.length === 0 && initialBlocks && initialBlocks.length > 0) {
        setNeedsHydration(true);
      }
    });
    prov.on("disconnect", () => { if (!cancelled) setIsConnected(false); });
    prov.on("connect", () => { if (!cancelled) setIsConnected(true); });

    // Set presence
    const color = getColorForUser(user.id);
    prov.awareness?.setLocalStateField("user", { id: user.id, name: user.name, color, isTyping: false });

    // Track remote users and typing state
    const updatePresence = () => {
      if (!prov.awareness) return;
      const states = prov.awareness.getStates();
      const users: { id: string; name: string; color: string }[] = [];
      const typing: { id: string; name: string; color: string }[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      states.forEach((state: Record<string, any>, clientId: number) => {
        if (state.user && clientId !== prov.awareness?.clientID) {
          users.push({ id: state.user.id, name: state.user.name, color: state.user.color });
          if (state.user.isTyping) {
            typing.push({ id: state.user.id, name: state.user.name, color: state.user.color });
          }
        }
      });
      usePresenceStore.getState().setUsers(users);
      setTypingUsers(typing);
    };
    prov.awareness?.on("change", updatePresence);

    if (!cancelled) {
      setYdoc(doc);
      setProvider(prov);
    }

    return () => {
      cancelled = true;
      prov.awareness?.off("change", updatePresence);
      usePresenceStore.getState().setUsers([]);
      prov.destroy();
      doc.destroy();
    };
  }, [pageId, sessionToken, user.id, user.name, initialBlocks]);

  // Hydrate Yjs doc from initial blocks once editor is mounted and doc is synced
  useEffect(() => {
    if (!needsHydration || !initialBlocks || initialBlocks.length === 0) return;
    if (!editorRef.current) return;

    const tiptapDoc = blocksToTiptap(
      initialBlocks.map((b) => ({
        id: b.id,
        pageId,
        parentId: b.parentId,
        type: b.type as BlockType,
        content: b.content as BlockContent,
        position: b.position,
      }))
    );

    if (tiptapDoc.content.length > 0) {
      editorRef.current.commands.setContent(tiptapDoc);
    }
    setNeedsHydration(false);
  }, [needsHydration, initialBlocks, pageId]);

  const handleTyping = useCallback(() => {
    if (!provider?.awareness) return;
    const color = getColorForUser(user.id);
    provider.awareness.setLocalStateField("user", { id: user.id, name: user.name, color, isTyping: true });

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      provider.awareness?.setLocalStateField("user", { id: user.id, name: user.name, color, isTyping: false });
    }, 2000);
  }, [provider, user.id, user.name]);

  if (!provider || !ydoc) {
    return <div className="py-8 text-center" style={{ color: "var(--text-tertiary)" }}>연결 중...</div>;
  }

  return (
    <div>
      {!isConnected && (
        <div className="mb-2 px-3 py-1 rounded text-xs" style={{ backgroundColor: "var(--color-yellow-bg)", color: "var(--color-orange)" }}>
          오프라인 — 변경 사항이 로컬에 저장됩니다
        </div>
      )}

      {followingUserId && (
        <div
          className="mb-2 px-3 py-1.5 rounded text-xs flex items-center justify-between"
          style={{ backgroundColor: "rgba(35, 131, 226, 0.08)", color: "#2383e2" }}
        >
          <span>
            {presenceUsers.find((u) => u.id === followingUserId)?.name ?? "사용자"}님을 팔로우 중
          </span>
          <button
            onClick={() => setFollowing(null)}
            className="px-2 py-0.5 rounded text-xs hover:bg-notion-bg-hover"
            style={{ color: "#2383e2" }}
          >
            해제
          </button>
        </div>
      )}

      <NotionEditor
        ref={editorRef}
        collaboration={{ ydoc, provider, user: { id: user.id, name: user.name, color: getColorForUser(user.id) } }}
        editable={!isLocked}
        onTyping={handleTyping}
      />
      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
          {typingUsers.map((u) => u.name).join(", ")}님이 입력 중
          <span className="inline-flex gap-0.5 ml-1">
            <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
          </span>
        </div>
      )}
    </div>
  );
}
