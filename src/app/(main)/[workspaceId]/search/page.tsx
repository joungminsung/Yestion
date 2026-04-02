"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Search, Filter, FileText, Database, Calendar, User, X, Loader2 } from "lucide-react";
import { trpc } from "@/server/trpc/client";
import { useTranslations } from "next-intl";

type FilterState = {
  type: "all" | "page" | "database";
  authorId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
};

export default function SearchPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
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

  const { data: members } = trpc.workspace.members.useQuery(
    { workspaceId },
    { enabled: !!workspaceId },
  );

  const { data: searchResults, isLoading } = trpc.search.fullSearch.useQuery(
    {
      query: debouncedQuery,
      workspaceId,
      filters: {
        type: filters.type,
        authorId: filters.authorId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      },
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

  const displayResults = debouncedQuery.length > 0 ? searchResults?.items : recentPages;

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
          <h3
            className="text-xs font-semibold uppercase mb-3 px-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            Recent Pages
          </h3>
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
              <div
                className="text-sm font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {result.title || "Untitled"}
              </div>
              <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
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
        {searchResults?.nextCursor !== null && searchResults?.nextCursor !== undefined && (
          <div className="text-center py-4">
            <button
              className="text-sm px-4 py-1.5 rounded hover:bg-notion-bg-hover"
              style={{ color: "#2383e2" }}
            >
              Load more results
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
