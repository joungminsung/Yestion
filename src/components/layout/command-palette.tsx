"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCommandPaletteStore } from "@/stores/command-palette";
import { trpc } from "@/server/trpc/client";
import { useTranslations } from "next-intl";

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

  const results = isSearching ? searchResults : recentPages;

  const handleSelect = (pageId: string) => {
    close();
    router.push(`/${workspaceId}/${pageId}`);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: "var(--z-command-palette)", backgroundColor: "rgba(15, 15, 15, 0.6)" }}
        onClick={close}
      />
      <div
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-[620px] rounded-lg overflow-hidden"
        style={{
          top: "max(12vh, 80px)",
          zIndex: "calc(var(--z-command-palette) + 1)",
          backgroundColor: "var(--bg-primary)",
          boxShadow: "var(--shadow-popup)",
        }}
      >
        <div className="flex items-center px-4 py-3 border-b" style={{ borderColor: "var(--border-default)" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>
            <path d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" fill="currentColor" />
          </svg>
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
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ color: "var(--text-tertiary)" }}>
                      <path d="M4.35 2.67h7.3c.93 0 1.68.75 1.68 1.68v7.3c0 .93-.75 1.68-1.68 1.68h-7.3c-.93 0-1.68-.75-1.68-1.68v-7.3c0-.93.75-1.68 1.68-1.68z" />
                    </svg>
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
        </div>
      </div>
    </>
  );
}
