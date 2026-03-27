"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSidebarStore } from "@/stores/sidebar";
import { useThemeStore } from "@/stores/theme";
import { trpc } from "@/server/trpc/client";

type Action = {
  name: string;
  icon: string;
  action: string;
};

const ACTIONS: Action[] = [
  { name: "페이지 잠금 토글", icon: "🔒", action: "toggle-lock" },
  { name: "전체 너비 토글", icon: "↔", action: "toggle-width" },
  { name: "즐겨찾기 토글", icon: "⭐", action: "toggle-favorite" },
  { name: "페이지 복제", icon: "📋", action: "duplicate" },
  { name: "Markdown 내보내기", icon: "📤", action: "export-md" },
  { name: "HTML 내보내기", icon: "📤", action: "export-html" },
  { name: "다크모드 토글", icon: "🌙", action: "toggle-theme" },
  { name: "사이드바 토글", icon: "📑", action: "toggle-sidebar" },
  { name: "포커스 모드", icon: "👁", action: "focus-mode" },
  { name: "단축키 도움말", icon: "⌨", action: "shortcuts" },
  { name: "설정", icon: "⚙️", action: "settings" },
];

const RECENT_ACTIONS_KEY = "notion-recent-actions";

function getRecentActions(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_ACTIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentAction(actionId: string) {
  try {
    const recent = getRecentActions().filter((a) => a !== actionId);
    recent.unshift(actionId);
    localStorage.setItem(RECENT_ACTIONS_KEY, JSON.stringify(recent.slice(0, 5)));
  } catch {
    // ignore
  }
}

function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (lowerText.includes(lowerQuery)) return true;
  let qi = 0;
  for (let i = 0; i < lowerText.length && qi < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[qi]) qi++;
  }
  return qi === lowerQuery.length;
}

export function QuickActions() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string | undefined;
  const pageId = params.pageId as string | undefined;

  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const { theme, setTheme } = useThemeStore();

  const utils = trpc.useUtils();
  const updatePage = trpc.page.update.useMutation({
    onSuccess: () => utils.page.get.invalidate(),
  });
  const duplicatePage = trpc.page.duplicate.useMutation({
    onSuccess: (newPage) => {
      utils.page.list.invalidate();
      if (workspaceId) router.push(`/${workspaceId}/${newPage.id}`);
    },
  });
  const addFavorite = trpc.page.addFavorite.useMutation({
    onSuccess: () => {
      utils.page.listFavorites.invalidate();
    },
  });
  const removeFavorite = trpc.page.removeFavorite.useMutation({
    onSuccess: () => {
      utils.page.listFavorites.invalidate();
    },
  });

  const { data: currentPage } = trpc.page.get.useQuery(
    { id: pageId! },
    { enabled: !!pageId && isOpen },
  );
  const { data: favorites } = trpc.page.listFavorites.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId && isOpen },
  );

  // Build sorted action list: recent first, then filtered
  const sortedActions = (() => {
    const recentIds = getRecentActions();
    let filtered = ACTIONS;

    if (query) {
      filtered = ACTIONS.filter((a) => fuzzyMatch(a.name, query));
    }

    // Sort: recent actions first
    const recentSet = new Set(recentIds);
    const recent = filtered.filter((a) => recentSet.has(a.action));
    const rest = filtered.filter((a) => !recentSet.has(a.action));

    // Sort recent by their order in recentIds
    recent.sort((a, b) => recentIds.indexOf(a.action) - recentIds.indexOf(b.action));

    return [...recent, ...rest];
  })();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setQuery("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape" && isOpen) {
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeAction = useCallback(
    (action: Action) => {
      saveRecentAction(action.action);
      setIsOpen(false);

      switch (action.action) {
        case "toggle-lock":
          if (pageId && currentPage) {
            updatePage.mutate({ id: pageId, isLocked: !currentPage.isLocked });
          }
          break;
        case "toggle-width":
          if (pageId && currentPage) {
            updatePage.mutate({ id: pageId, isFullWidth: !currentPage.isFullWidth });
          }
          break;
        case "toggle-favorite":
          if (pageId && favorites) {
            const isFav = favorites.some((f) => f.pageId === pageId);
            if (isFav) {
              removeFavorite.mutate({ pageId });
            } else {
              addFavorite.mutate({ pageId });
            }
          }
          break;
        case "duplicate":
          if (pageId) {
            duplicatePage.mutate({ id: pageId });
          }
          break;
        case "export-md":
          if (pageId) {
            window.open(`/api/export/markdown/${pageId}`, "_blank");
          }
          break;
        case "export-html":
          if (pageId) {
            window.open(`/api/export/html/${pageId}`, "_blank");
          }
          break;
        case "toggle-theme": {
          const next = theme === "dark" ? "light" : "dark";
          setTheme(next);
          break;
        }
        case "toggle-sidebar":
          toggleSidebar();
          break;
        case "focus-mode":
          document.documentElement.classList.toggle("focus-mode");
          break;
        case "shortcuts":
          // Dispatch Cmd+/ to open shortcuts help
          window.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "/",
              metaKey: true,
              bubbles: true,
            }),
          );
          break;
        case "settings":
          if (workspaceId) router.push(`/${workspaceId}/settings`);
          break;
      }
    },
    [
      pageId,
      currentPage,
      favorites,
      theme,
      setTheme,
      toggleSidebar,
      workspaceId,
      router,
      updatePage,
      duplicatePage,
      addFavorite,
      removeFavorite,
    ],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, sortedActions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (sortedActions[selectedIndex]) {
        executeAction(sortedActions[selectedIndex]);
      }
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ zIndex: "var(--z-command-palette)", backgroundColor: "rgba(15, 15, 15, 0.6)" }}
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-[480px] rounded-lg overflow-hidden"
        style={{
          top: "max(12vh, 80px)",
          zIndex: "calc(var(--z-command-palette) + 1)",
          backgroundColor: "var(--bg-primary)",
          boxShadow: "var(--shadow-popup)",
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search */}
        <div
          className="flex items-center px-4 py-3 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          <span style={{ fontSize: "16px", marginRight: "8px" }}>⚡</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="액션 검색..."
            className="flex-1 bg-transparent outline-none"
            style={{
              fontSize: "15px",
              color: "var(--text-primary)",
              fontFamily: "var(--notion-font-family)",
            }}
          />
        </div>

        {/* Action List */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {sortedActions.length > 0 ? (
            sortedActions.map((action, index) => (
              <button
                key={action.action}
                onClick={() => executeAction(action)}
                className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
                style={{
                  backgroundColor:
                    index === selectedIndex ? "var(--bg-hover)" : "transparent",
                  color: "var(--text-primary)",
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center"
                  style={{ fontSize: "15px" }}
                >
                  {action.icon}
                </span>
                <span style={{ fontSize: "14px" }}>{action.name}</span>
                {getRecentActions().includes(action.action) && !query && (
                  <span
                    className="ml-auto text-xs px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      color: "var(--text-tertiary)",
                      fontSize: "10px",
                    }}
                  >
                    최근
                  </span>
                )}
              </button>
            ))
          ) : (
            <div
              className="px-4 py-6 text-center"
              style={{ color: "var(--text-tertiary)", fontSize: "13px" }}
            >
              일치하는 액션이 없습니다
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div
          className="px-4 py-2 border-t flex items-center gap-3"
          style={{
            borderColor: "var(--border-default)",
            fontSize: "11px",
            color: "var(--text-tertiary)",
          }}
        >
          <span>↑↓ 이동</span>
          <span>↵ 실행</span>
          <span>Esc 닫기</span>
        </div>
      </div>
    </>
  );
}
