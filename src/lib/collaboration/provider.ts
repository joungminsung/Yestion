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

export function getCollaborationUrl(): string | null {
  const configuredUrl = process.env.NEXT_PUBLIC_COLLAB_URL?.trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.hostname || "localhost";
    return `${protocol}://${host}:4000`;
  }

  return "ws://localhost:4000";
}

export function createCollaborationProvider({ pageId, token }: { pageId: string; token: string }) {
  const ydoc = new Y.Doc();
  const url = getCollaborationUrl();

  if (!url) {
    throw new Error("Collaboration URL is not configured");
  }

  const provider = new HocuspocusProvider({
    url,
    name: `page:${pageId}`,
    document: ydoc,
    token,
  });
  return { ydoc, provider };
}
