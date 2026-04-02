"use client";

import { useEffect } from "react";
import { cacheManager } from "@/lib/offline/cache-manager";

type Props = {
  pageId: string;
  workspaceId: string;
  title: string;
  blocks: { id: string; type: string; content: unknown; position: number; parentId: string | null }[];
};

/**
 * Invisible component that automatically caches the current page
 * to IndexedDB whenever it mounts or content changes.
 * This enables offline reading of previously visited pages.
 */
export function OfflinePageCache({ pageId, workspaceId, title, blocks }: Props) {
  useEffect(() => {
    cacheManager.setPage({
      id: pageId,
      title: title || "제목 없음",
      content: blocks,
      updatedAt: new Date().toISOString(),
      workspaceId,
    });
  }, [pageId, workspaceId, title, blocks]);

  return null;
}
