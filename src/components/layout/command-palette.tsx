"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCommandPaletteStore } from "@/stores/command-palette";
import { trpc } from "@/server/trpc/client";
import { useTranslations } from "next-intl";
import { Search, FileText, Hash, Moon, Plus, Settings, Sun, Volume2 } from "lucide-react";
import { useThemeStore } from "@/stores/theme";
import { useToastStore } from "@/stores/toast";
import { AnimatedDialog } from "@/components/ui/animated-dialog";

export function CommandPalette() {
  const t = useTranslations("commandPalette");
  const { isOpen, query, close, setQuery } = useCommandPaletteStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string | undefined;
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setDebouncedQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  const isSearching = debouncedQuery.length > 0;

  const { data: searchResults, isLoading: isSearchLoading } = trpc.search.search.useQuery(
    { query: debouncedQuery, workspaceId: workspaceId! },
    { enabled: isOpen && isSearching && !!workspaceId },
  );

  const { data: recentPages } = trpc.search.recent.useQuery(
    { workspaceId: workspaceId! },
    { enabled: isOpen && !isSearching && !!workspaceId },
  );
  const { data: channels } = trpc.channel.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: isOpen && !!workspaceId, refetchOnWindowFocus: false },
  );

  const results = isSearching ? searchResults : recentPages;
  const matchedChannels = (channels ?? [])
    .filter((channel) => {
      if (!isSearching) {
        return true;
      }

      const haystack = [
        channel.name,
        channel.description,
        channel.topic,
        channel.teamspace?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query.toLowerCase());
    })
    .slice(0, isSearching ? 8 : 5);

  const handleSelect = (pageId: string) => {
    close();
    router.push(`/${workspaceId}/${pageId}`);
  };
  const handleChannelSelect = (channelId: string) => {
    close();
    router.push(`/${workspaceId}/channels/${channelId}`);
  };

  const { resolvedTheme, setTheme } = useThemeStore();

  const addToast = useToastStore((s) => s.addToast);

  const createPage = trpc.page.create.useMutation({
    onSuccess: (newPage) => {
      close();
      if (workspaceId) router.push(`/${workspaceId}/${newPage.id}`);
    },
    onError: (err) => {
      close();
      addToast({ message: err.message, type: "error" });
    },
  });

  const quickActions = [
    {
      id: "new-page",
      label: "New page",
      icon: <Plus size={16} />,
      action: () => {
        if (workspaceId) {
          createPage.mutate({ workspaceId, title: "" });
        }
      },
    },
    {
      id: "toggle-theme",
      label: resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      icon: resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />,
      action: () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        close();
      },
    },
    {
      id: "settings",
      label: "Open settings",
      icon: <Settings size={16} />,
      action: () => {
        close();
        if (workspaceId) router.push(`/${workspaceId}/settings`);
      },
    },
  ];

  return (
    <AnimatedDialog isOpen={isOpen} onClose={close} maxWidth="max-w-[620px]">
      <div className="rounded-lg overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b" style={{ borderColor: "var(--border-default)" }}>
          <Search size={18} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="flex-1 ml-3 bg-transparent outline-none"
            style={{ fontSize: "16px", color: "var(--text-primary)", fontFamily: "var(--notion-font-family)" }}
          />
          {isSearchLoading && isSearching && (
            <div
              className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--text-tertiary)", borderTopColor: "transparent" }}
            />
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-1" style={{ fontSize: "14px" }}>
          <div className="px-4 py-2" style={{ fontSize: "12px", color: "var(--text-tertiary)", fontWeight: 500 }}>
            {isSearching ? t("searchResults") : t("recentVisits")}
          </div>
          {results && results.length > 0 ? (
            results.map((page) => (
              <button
                key={page.id}
                onClick={() => handleSelect(page.id)}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-notion-bg-hover text-left"
                style={{ color: "var(--text-primary)" }}
              >
                <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center" style={{ fontSize: "14px" }}>
                  {page.icon || (
                    <FileText size={16} style={{ color: "var(--text-tertiary)" }} />
                  )}
                </span>
                <span className="truncate flex-1">
                  {page.title || "제목 없음"}
                </span>
                {page.updatedAt && (
                  <span className="flex-shrink-0 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {new Date(page.updatedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  </span>
                )}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-center" style={{ color: "var(--text-tertiary)" }}>
              {isSearching && isSearchLoading ? t("searching") : t("noResults")}
            </div>
          )}

          {matchedChannels.length > 0 && (
            <>
              <div className="px-4 py-2 mt-1" style={{ fontSize: "12px", color: "var(--text-tertiary)", fontWeight: 500 }}>
                Channels
              </div>
              {matchedChannels.map((channel) => {
                const Icon = channel.type === "voice" ? Volume2 : Hash;

                return (
                  <button
                    key={channel.id}
                    onClick={() => handleChannelSelect(channel.id)}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-notion-bg-hover text-left"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center" style={{ color: "var(--text-tertiary)" }}>
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{channel.name}</div>
                      {(channel.description || channel.teamspace?.name) && (
                        <div className="truncate text-xs" style={{ color: "var(--text-tertiary)" }}>
                          {channel.teamspace?.name
                            ? `${channel.teamspace.name} · ${channel.description || channel.topic || ""}`
                            : channel.description || channel.topic || ""}
                        </div>
                      )}
                    </div>
                    {(channel.unreadMessageCount ?? 0) > 0 && (
                      <span
                        className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: "rgba(35, 131, 226, 0.12)",
                          color: "#2383e2",
                        }}
                      >
                        {Math.min(channel.unreadMessageCount ?? 0, 99)}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {/* Quick Actions */}
          {(() => {
            const matchedActions = isSearching
              ? quickActions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()))
              : quickActions;

            if (matchedActions.length === 0) return null;

            return (
              <>
                <div className="px-4 py-2 mt-1" style={{ fontSize: "12px", color: "var(--text-tertiary)", fontWeight: 500 }}>
                  Actions
                </div>
                {matchedActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={action.action}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-notion-bg-hover text-left"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center" style={{ color: "var(--text-tertiary)" }}>
                      {action.icon}
                    </span>
                    <span className="flex-1">{action.label}</span>
                  </button>
                ))}
              </>
            );
          })()}
        </div>
      </div>
    </AnimatedDialog>
  );
}
