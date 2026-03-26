"use client";

import { useEffect, useRef, useState } from "react";
import { NotionEditor, type NotionEditorHandle } from "./editor";
import { createCollaborationProvider, getColorForUser } from "@/lib/collaboration/provider";
import { usePresenceStore } from "@/stores/presence";
import { blocksToTiptap } from "./utils/block-serializer";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type * as Y from "yjs";
import type { BlockType, BlockContent } from "@/types/editor";

type Props = {
  pageId: string;
  /**
   * I4: Session token passed from server component. Ideally this should be
   * replaced with a short-lived, scoped collaboration token to reduce exposure.
   * The session cookie is httpOnly so this server-to-client prop pass is the
   * current mechanism — acceptable for an internal team tool.
   */
  sessionToken: string;
  user: { id: string; name: string };
  isLocked?: boolean;
  // C3: Initial blocks for hydrating an empty Yjs doc
  initialBlocks?: { id: string; type: string; content: unknown; position: number; parentId: string | null }[];
};

export function CollaborativeEditor({ pageId, sessionToken, user, isLocked, initialBlocks }: Props) {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // C3: Flag to hydrate Yjs doc from blocks when doc is empty
  const [needsHydration, setNeedsHydration] = useState(false);
  const editorRef = useRef<NotionEditorHandle | null>(null);

  useEffect(() => {
    // I7: Cancellation guard to prevent stale state updates
    let cancelled = false;

    const { ydoc: doc, provider: prov } = createCollaborationProvider({ pageId, token: sessionToken });

    prov.on("synced", () => {
      if (cancelled) return;
      setIsConnected(true);

      // C3: If Yjs doc is empty but we have initial blocks, flag for hydration
      const fragment = doc.getXmlFragment("default");
      if (fragment.length === 0 && initialBlocks && initialBlocks.length > 0) {
        setNeedsHydration(true);
      }
    });
    prov.on("disconnect", () => { if (!cancelled) setIsConnected(false); });
    prov.on("connect", () => { if (!cancelled) setIsConnected(true); });

    // Set presence
    const color = getColorForUser(user.id);
    prov.awareness?.setLocalStateField("user", { id: user.id, name: user.name, color });

    // Track remote users
    const updatePresence = () => {
      if (!prov.awareness) return;
      const states = prov.awareness.getStates();
      const users: { id: string; name: string; color: string }[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      states.forEach((state: Record<string, any>, clientId: number) => {
        if (state.user && clientId !== prov.awareness?.clientID) {
          users.push({ id: state.user.id, name: state.user.name, color: state.user.color });
        }
      });
      usePresenceStore.getState().setUsers(users);
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

  // C3: Hydrate Yjs doc from initial blocks once editor is mounted and doc is synced
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
      <NotionEditor
        ref={editorRef}
        collaboration={{ ydoc, provider, user: { id: user.id, name: user.name, color: getColorForUser(user.id) } }}
        editable={!isLocked}
      />
    </div>
  );
}
