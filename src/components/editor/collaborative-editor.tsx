"use client";

import { useEffect, useState } from "react";
import { NotionEditor } from "./editor";
import { createCollaborationProvider, getColorForUser } from "@/lib/collaboration/provider";
import { usePresenceStore } from "@/stores/presence";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type * as Y from "yjs";

type Props = {
  pageId: string;
  sessionToken: string;
  user: { id: string; name: string };
  isLocked?: boolean;
};

export function CollaborativeEditor({ pageId, sessionToken, user, isLocked }: Props) {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const { ydoc: doc, provider: prov } = createCollaborationProvider({ pageId, token: sessionToken });

    prov.on("synced", () => setIsConnected(true));
    prov.on("disconnect", () => setIsConnected(false));
    prov.on("connect", () => setIsConnected(true));

    // Set presence
    const color = getColorForUser(user.id);
    prov.awareness?.setLocalStateField("user", { id: user.id, name: user.name, color });

    // Track remote users
    const updatePresence = () => {
      if (!prov.awareness) return;
      const states = prov.awareness.getStates();
      const users: { id: string; name: string; color: string }[] = [];
      states.forEach((state: any, clientId: number) => {
        if (state.user && clientId !== prov.awareness?.clientID) {
          users.push({ id: state.user.id, name: state.user.name, color: state.user.color });
        }
      });
      usePresenceStore.getState().setUsers(users);
    };
    prov.awareness?.on("change", updatePresence);

    setYdoc(doc);
    setProvider(prov);

    return () => {
      prov.awareness?.off("change", updatePresence);
      usePresenceStore.getState().setUsers([]);
      prov.destroy();
      doc.destroy();
    };
  }, [pageId, sessionToken, user.id, user.name]);

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
        collaboration={{ ydoc, provider, user: { id: user.id, name: user.name, color: getColorForUser(user.id) } }}
        editable={!isLocked}
      />
    </div>
  );
}
