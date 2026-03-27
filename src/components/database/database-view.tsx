"use client";

import { useEffect, useMemo } from "react";
import { trpc } from "@/server/trpc/client";
import { useDatabaseStore } from "@/stores/database";
import { filterRows } from "@/lib/database/filter-engine";
import { sortRows } from "@/lib/database/sort-engine";
import { DatabaseToolbar } from "./database-toolbar";
import type { DatabaseData } from "@/types/database";

type DatabaseViewProps = {
  databaseId: string;
};

export function DatabaseView({ databaseId }: DatabaseViewProps) {
  const { data, isLoading, error } = trpc.database.get.useQuery({ databaseId });

  const {
    activeViewId,
    setActiveView,
    localFilters,
    localSorts,
    resetLocal,
  } = useDatabaseStore();

  // Auto-select first view
  useEffect(() => {
    if (data && data.views.length > 0 && !activeViewId) {
      setActiveView(data.views[0].id);
    }
  }, [data, activeViewId, setActiveView]);

  // Reset local overrides when switching views
  useEffect(() => {
    resetLocal();
  }, [activeViewId, resetLocal]);

  const activeView = useMemo(
    () => data?.views.find((v) => v.id === activeViewId) ?? data?.views[0],
    [data, activeViewId],
  );

  // Build property type map for sort engine
  const propertyTypes = useMemo(() => {
    if (!data) return {};
    return Object.fromEntries(
      data.properties.map((p) => [p.id, p.type]),
    );
  }, [data]);

  // Effective filter/sort (local overrides > view config)
  const effectiveFilter = localFilters ?? activeView?.config.filter;
  const effectiveSorts = localSorts ?? activeView?.config.sorts;

  // Apply filter + sort
  const processedRows = useMemo(() => {
    if (!data) return [];
    const filtered = filterRows(data.rows, effectiveFilter);
    return sortRows(filtered, effectiveSorts, propertyTypes);
  }, [data, effectiveFilter, effectiveSorts, propertyTypes]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[var(--text-secondary)]">
        Loading database...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-red-500">
        Failed to load database: {error.message}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col">
      {/* View tabs */}
      <div className="flex items-center gap-1 border-b px-2 py-1" style={{ borderColor: "var(--border-default)" }}>
        {data.views.map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              view.id === activeViewId
                ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {viewTypeIcon(view.type)} {view.name}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <DatabaseToolbar database={data} activeView={activeView ?? null} />

      {/* Active view placeholder */}
      <div className="min-h-[200px] p-2">
        <ActiveViewContent
          database={data}
          viewType={activeView?.type ?? "table"}
          rows={processedRows}
        />
      </div>
    </div>
  );
}

// Placeholder for view-specific components (table, board, etc.)
function ActiveViewContent({
  database,
  viewType,
  rows,
}: {
  database: DatabaseData;
  viewType: string;
  rows: DatabaseData["rows"];
}) {
  return (
    <div className="text-sm text-[var(--text-secondary)]">
      <p className="mb-2 font-medium text-[var(--text-primary)]">
        {viewType.charAt(0).toUpperCase() + viewType.slice(1)} view
      </p>
      <p>
        {rows.length} row{rows.length !== 1 ? "s" : ""} |{" "}
        {database.properties.length} properties
      </p>
    </div>
  );
}

function viewTypeIcon(type: string): string {
  switch (type) {
    case "table": return "\u2630";
    case "board": return "\u25A6";
    case "list": return "\u2261";
    case "gallery": return "\u25A3";
    case "calendar": return "\u{1F4C5}";
    case "timeline": return "\u2192";
    default: return "\u2630";
  }
}
