import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";

const USER_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
];

export function getColorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]!;
}

export function createCollaborationProvider({ pageId, token }: { pageId: string; token: string }) {
  const ydoc = new Y.Doc();
  const provider = new HocuspocusProvider({
    url: process.env.NEXT_PUBLIC_COLLAB_URL || "ws://localhost:4000",
    name: `page:${pageId}`,
    document: ydoc,
    token,
  });
  return { ydoc, provider };
}
