"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { usePageTreeStore } from "@/stores/page-tree";
import { FileText, ChevronRight, Clock } from "lucide-react";

const RECENT_KEY = "notion-recent-pages";
const MAX_RECENT = 5;

export function addRecentPage(pageId: string) {
  try {
    const stored: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    const filtered = stored.filter((id) => id !== pageId);
    filtered.unshift(pageId);
    localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT * 2)));
  } catch {
    // localStorage unavailable
  }
}

export function getRecentPageIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function SidebarRecent({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { activePageId, setActivePage } = usePageTreeStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // Read from localStorage on mount and whenever window regains focus
  const loadRecent = useCallback(() => {
    setRecentIds(getRecentPageIds());
  }, []);

  useEffect(() => {
    loadRecent();
    window.addEventListener("focus", loadRecent);
    // Also listen for storage events from other tabs
    window.addEventListener("storage", loadRecent);
    return () => {
      window.removeEventListener("focus", loadRecent);
      window.removeEventListener("storage", loadRecent);
    };
  }, [loadRecent]);

  // Also reload when activePageId changes (meaning user navigated)
  useEffect(() => {
    loadRecent();
  }, [activePageId, loadRecent]);

  // Fetch all pages for the workspace to look up page data
  const { data: flatPages } = trpc.page.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId },
  );

  // Build page map for quick lookups
  const pageMap = new Map<string, { id: string; title: string; icon: string | null }>();
  if (flatPages) {
    for (const p of flatPages) {
      pageMap.set(p.id, { id: p.id, title: p.title, icon: p.icon });
    }
  }

  // Filter to only pages that still exist in the workspace
  const recentPages = recentIds
    .map((id) => pageMap.get(id))
    .filter((p): p is NonNullable<typeof p> => p != null)
    .slice(0, MAX_RECENT);

  if (recentPages.length === 0) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-1 px-3 py-1 w-full text-left hover:bg-notion-bg-hover rounded-sm"
        style={{
          fontSize: "12px",
          fontWeight: 500,
          color: "var(--text-tertiary)",
          letterSpacing: "0.02em",
        }}
      >
        <ChevronRight
          size={12}
          style={{
            transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
            transition: "transform 0.15s",
            flexShrink: 0,
          }}
        />
        <Clock size={12} style={{ flexShrink: 0 }} />
        <span className="flex-1">최근</span>
        {isCollapsed && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-tertiary)",
            }}
          >
            {recentPages.length}
          </span>
        )}
      </button>
      {!isCollapsed &&
        recentPages.map((page) => (
          <div
            key={page.id}
            className="flex items-center gap-2 px-3 py-[3px] rounded-sm cursor-pointer hover:bg-notion-bg-hover"
            style={{
              fontSize: "14px",
              color: "var(--text-primary)",
              paddingLeft: "28px",
              backgroundColor: activePageId === page.id ? "var(--bg-active)" : undefined,
            }}
            onClick={() => {
              setActivePage(page.id);
              router.push(`/${workspaceId}/${page.id}`);
            }}
          >
            <span className="text-sm flex items-center flex-shrink-0">
              {page.icon || <FileText size={16} />}
            </span>
            <span
              className="truncate"
              style={{ color: page.title ? "var(--text-primary)" : "var(--text-tertiary)" }}
            >
              {page.title || "제목 없음"}
            </span>
          </div>
        ))}
    </div>
  );
}
