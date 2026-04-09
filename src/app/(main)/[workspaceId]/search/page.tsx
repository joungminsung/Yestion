"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Search, Filter, FileText, Calendar, User, X, Loader2, History, Sparkles } from "lucide-react";
import { trpc } from "@/server/trpc/client";

type FilterState = {
  type: "all" | "page" | "database";
  authorId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
};

type SearchResultItem = {
  id: string;
  title: string;
  icon: string | null;
  parentId: string | null;
  updatedAt: string | Date;
  kind?: "page" | "database";
  matchSource?: "title" | "content";
  path?: string[];
  snippet?: string;
};

const RECENT_SEARCHES_KEY = "notion-web:recent-searches";
const RECOMMENDED_SEARCHES = [
  "meeting notes",
  "design doc",
  "roadmap",
  "retrospective",
  "weekly plan",
] as const;

function highlightText(text: string, query: string) {
  const rawTerms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!text || rawTerms.length === 0) {
    return text;
  }

  const escapedTerms = Array.from(new Set(rawTerms))
    .sort((left, right) => right.length - left.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escapedTerms.join("|")})`, "gi");
  const normalizedTerms = new Set(rawTerms.map((term) => term.toLowerCase()));

  return text.split(pattern).map((part, index) =>
    normalizedTerms.has(part.toLowerCase()) ? (
      <mark
        key={`${part}-${index}`}
        className="rounded px-0.5"
        style={{ backgroundColor: "rgba(35, 131, 226, 0.12)", color: "inherit" }}
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

export default function SearchPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const inputRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [searchItems, setSearchItems] = useState<SearchResultItem[]>([]);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    type: "all",
    authorId: null,
    dateFrom: null,
    dateTo: null,
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setRecentQueries(parsed.filter((value): value is string => typeof value === "string"));
      }
    } catch {
      // Ignore malformed local state
    }
  }, []);

  const { data: members } = trpc.workspace.members.useQuery(
    { workspaceId },
    { enabled: !!workspaceId },
  );

  useEffect(() => {
    setCursor(0);
    setSearchItems([]);
  }, [debouncedQuery, workspaceId, filters.type, filters.authorId, filters.dateFrom, filters.dateTo]);

  const { data: searchResults, isLoading, isFetching } = trpc.search.fullSearch.useQuery(
    {
      query: debouncedQuery,
      workspaceId,
      filters: {
        type: filters.type,
        authorId: filters.authorId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      },
      cursor,
      limit: 20,
    },
    { enabled: debouncedQuery.length > 0 },
  );

  const { data: recentPages } = trpc.search.recent.useQuery(
    { workspaceId },
    { enabled: debouncedQuery.length === 0 },
  );

  const navigateToPage = useCallback(
    (pageId: string) => {
      router.push(`/${workspaceId}/${pageId}`);
    },
    [router, workspaceId],
  );

  useEffect(() => {
    if (!searchResults) return;

    setSearchItems((prev) => {
      if (cursor === 0) {
        return searchResults.items;
      }

      const merged = new Map(prev.map((item) => [item.id, item] as const));
      for (const item of searchResults.items) {
        if (!merged.has(item.id)) {
          merged.set(item.id, item);
        }
      }
      return Array.from(merged.values());
    });
  }, [searchResults, cursor]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < 2) return;

    setRecentQueries((prev) => {
      const next = [trimmed, ...prev.filter((item) => item !== trimmed)].slice(0, 8);
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      return next;
    });
  }, [debouncedQuery]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || debouncedQuery.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (isFetching) return;
        if (searchResults?.nextCursor == null) return;
        setCursor((prev) =>
          prev === searchResults.nextCursor ? prev : (searchResults.nextCursor ?? prev)
        );
      },
      { rootMargin: "240px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [debouncedQuery.length, isFetching, searchResults?.nextCursor]);

  const displayResults: SearchResultItem[] | undefined =
    debouncedQuery.length > 0
      ? searchItems
      : recentPages?.map((page) => ({
          id: page.id,
          title: page.title,
          icon: page.icon,
          parentId: page.parentId,
          updatedAt: page.updatedAt,
        }));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Search header */}
      <div className="mb-6">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border-default)",
          }}
        >
          <Search size={20} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, databases, and content..."
            className="flex-1 bg-transparent outline-none text-base"
            style={{ color: "var(--text-primary)" }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setDebouncedQuery(""); }}
              className="p-1 rounded hover:bg-notion-bg-hover"
              style={{ color: "var(--text-tertiary)" }}
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-1.5 rounded hover:bg-notion-bg-hover"
            style={{ color: showFilters ? "#2383e2" : "var(--text-tertiary)" }}
          >
            <Filter size={16} />
          </button>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div
            className="flex flex-wrap items-center gap-3 mt-3 px-4 py-3 rounded-lg border"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border-default)",
            }}
          >
            {/* Type filter */}
            <div className="flex items-center gap-1.5">
              <FileText size={14} style={{ color: "var(--text-tertiary)" }} />
              <select
                value={filters.type}
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value as FilterState["type"] }))}
                className="text-sm bg-transparent outline-none cursor-pointer"
                style={{ color: "var(--text-primary)" }}
              >
                <option value="all">All types</option>
                <option value="page">Pages only</option>
                <option value="database">Databases only</option>
              </select>
            </div>

            {/* Author filter */}
            <div className="flex items-center gap-1.5">
              <User size={14} style={{ color: "var(--text-tertiary)" }} />
              <select
                value={filters.authorId ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    authorId: e.target.value || null,
                  }))
                }
                className="text-sm bg-transparent outline-none cursor-pointer"
                style={{ color: "var(--text-primary)" }}
              >
                <option value="">Any author</option>
                {members?.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <Calendar size={14} style={{ color: "var(--text-tertiary)" }} />
              <input
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, dateFrom: e.target.value || null }))
                }
                className="text-sm bg-transparent outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              <span style={{ color: "var(--text-tertiary)" }}>~</span>
              <input
                type="date"
                value={filters.dateTo ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, dateTo: e.target.value || null }))
                }
                className="text-sm bg-transparent outline-none"
                style={{ color: "var(--text-primary)" }}
              />
            </div>

            {/* Clear filters */}
            <button
              onClick={() =>
                setFilters({ type: "all", authorId: null, dateFrom: null, dateTo: null })
              }
              className="text-xs px-2 py-1 rounded hover:bg-notion-bg-hover"
              style={{ color: "var(--text-tertiary)" }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div>
        {debouncedQuery.length === 0 && (
          <div className="space-y-5 mb-5">
            <div>
              <h3
                className="text-xs font-semibold uppercase mb-2 px-1 flex items-center gap-2"
                style={{ color: "var(--text-tertiary)" }}
              >
                <History size={12} />
                Recent Searches
              </h3>
              <div className="flex flex-wrap gap-2">
                {recentQueries.length > 0 ? recentQueries.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setQuery(item);
                      setDebouncedQuery(item);
                    }}
                    className="px-3 py-1.5 text-sm rounded-full border hover:bg-notion-bg-hover"
                    style={{
                      borderColor: "var(--border-default)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {item}
                  </button>
                )) : (
                  <p className="text-sm px-1" style={{ color: "var(--text-tertiary)" }}>
                    아직 검색 기록이 없습니다.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3
                className="text-xs font-semibold uppercase mb-2 px-1 flex items-center gap-2"
                style={{ color: "var(--text-tertiary)" }}
              >
                <Sparkles size={12} />
                Recommended
              </h3>
              <div className="flex flex-wrap gap-2">
                {RECOMMENDED_SEARCHES.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setQuery(item);
                      setDebouncedQuery(item);
                    }}
                    className="px-3 py-1.5 text-sm rounded-full border hover:bg-notion-bg-hover"
                    style={{
                      borderColor: "var(--border-default)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <h3
              className="text-xs font-semibold uppercase px-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              Recent Pages
            </h3>
          </div>
        )}

        {isLoading && debouncedQuery.length > 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
          </div>
        )}

        {!isLoading && debouncedQuery.length > 0 && (!displayResults || displayResults.length === 0) && (
          <div className="text-center py-12" style={{ color: "var(--text-tertiary)" }}>
            <Search size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No results found for &quot;{debouncedQuery}&quot;</p>
          </div>
        )}

        {displayResults?.map((result) => (
          <button
            key={result.id}
            onClick={() => navigateToPage(result.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-notion-bg-hover text-left group transition-colors"
          >
            <span
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded text-lg"
              style={{ backgroundColor: "var(--bg-secondary)" }}
            >
              {result.icon || <FileText size={16} style={{ color: "var(--text-tertiary)" }} />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {highlightText(result.title || "Untitled", debouncedQuery)}
                </div>
                {result.kind && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {result.kind === "database" ? "Database" : "Page"}
                  </span>
                )}
              </div>
              <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {result.path && result.path.length > 0 && (
                  <span className="block truncate mb-0.5">{result.path.join(" / ")}</span>
                )}
                {result.snippet && debouncedQuery.length > 0 && (
                  <span className="block truncate mb-0.5">
                    {highlightText(result.snippet, debouncedQuery)}
                  </span>
                )}
                {new Date(result.updatedAt).toLocaleDateString()}
                {"matchSource" in result && result.matchSource === "content" && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    content match
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}

        {/* Load more */}
        {debouncedQuery.length > 0 && (
          <div ref={loadMoreRef} className="h-2" />
        )}

        {searchResults?.nextCursor !== null && searchResults?.nextCursor !== undefined && (
          <div className="text-center py-4">
            <button
              onClick={() => {
                if (searchResults.nextCursor !== null) {
                  setCursor(searchResults.nextCursor);
                }
              }}
              className="text-sm px-4 py-1.5 rounded hover:bg-notion-bg-hover"
              style={{ color: "#2383e2" }}
              disabled={isFetching}
            >
              {isFetching ? "Loading..." : "Load more results"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
