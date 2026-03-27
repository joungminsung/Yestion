"use client";

import { useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { useDatabaseStore } from "@/stores/database";
import { filterRows } from "@/lib/database/filter-engine";
import { sortRows } from "@/lib/database/sort-engine";
import { DatabaseToolbar } from "./database-toolbar";
import { TableView } from "./views/table-view";
import { BoardView } from "./views/board-view";
import { ListView } from "./views/list-view";
import { GalleryView } from "./views/gallery-view";
import { CalendarView } from "./views/calendar-view";
import { TimelineView } from "./views/timeline-view";
import type { ViewConfig, FilterGroup, SortRule, DatabaseData } from "@/types/database";

type DatabaseViewProps = {
  databaseId: string;
};

/** Safely cast Prisma JSON config to ViewConfig */
function asViewConfig(config: unknown): ViewConfig {
  if (config && typeof config === "object") return config as ViewConfig;
  return {};
}

export function DatabaseView({ databaseId }: DatabaseViewProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.database.get.useQuery({ databaseId });
  const updateViewMutation = trpc.database.updateView.useMutation();
  const addRowMutation = trpc.database.addRow.useMutation({
    onSuccess: () => utils.database.get.invalidate({ databaseId }),
  });
  const updateRowMutation = trpc.database.updateRow.useMutation({
    onSuccess: () => utils.database.get.invalidate({ databaseId }),
  });
  const addPropertyMutation = trpc.database.addProperty.useMutation({
    onSuccess: () => utils.database.get.invalidate({ databaseId }),
  });

  const {
    activeViewId,
    setActiveView,
    localFilters,
    localSorts,
    resetLocal,
  } = useDatabaseStore();

  // Auto-select first view
  useEffect(() => {
    const firstView = data?.views[0];
    if (firstView && !activeViewId) {
      setActiveView(firstView.id);
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

  const activeViewConfig = useMemo(
    () => (activeView ? asViewConfig(activeView.config) : undefined),
    [activeView],
  );

  // Build property type map for sort engine
  const propertyTypes = useMemo(() => {
    if (!data) return {};
    return Object.fromEntries(
      data.properties.map((p) => [p.id, p.type]),
    );
  }, [data]);

  // Effective filter/sort (local overrides > view config)
  const effectiveFilter: FilterGroup | undefined =
    localFilters ?? activeViewConfig?.filter;
  const effectiveSorts: SortRule[] | undefined =
    localSorts ?? activeViewConfig?.sorts;

  // Persist view config changes via tRPC
  const handleUpdateViewConfig = useCallback(
    (configPatch: Partial<ViewConfig>) => {
      if (!activeView) return;
      updateViewMutation.mutate({ id: activeView.id, config: configPatch });
    },
    [activeView, updateViewMutation],
  );

  // ── View callback handlers ──────────────────────────────────

  const handleAddRow = useCallback(
    (defaultValues?: Record<string, unknown>) => {
      addRowMutation.mutate({
        databaseId,
        values: defaultValues ?? {},
      });
    },
    [addRowMutation, databaseId],
  );

  const handleUpdateRow = useCallback(
    (rowId: string, propertyId: string, value: unknown) => {
      updateRowMutation.mutate({
        id: rowId,
        values: { [propertyId]: value },
      });
    },
    [updateRowMutation],
  );

  const handleRowClick = useCallback(
    (pageId: string) => {
      router.push(`/page/${pageId}`);
    },
    [router],
  );

  const handleAddProperty = useCallback(() => {
    addPropertyMutation.mutate({
      databaseId,
      name: "New Property",
      type: "text",
    });
  }, [addPropertyMutation, databaseId]);

  // Apply filter + sort
  const processedRows = useMemo(() => {
    if (!data) return [];
    // Cast rows: Prisma values field is JsonValue; treat as Record<string, unknown>
    const rows = data.rows.map((r) => ({
      ...r,
      values: (r.values && typeof r.values === "object" && !Array.isArray(r.values)
        ? r.values
        : {}) as Record<string, unknown>,
    }));
    const filtered = filterRows(rows, effectiveFilter);
    return sortRows(filtered, effectiveSorts, propertyTypes);
  }, [data, effectiveFilter, effectiveSorts, propertyTypes]);

  // ── Render the active view component ────────────────────────

  function renderView() {
    if (!data || !activeViewConfig) return null;

    const viewProps = {
      databaseId: data.id ?? databaseId,
      properties: data.properties as DatabaseData["properties"],
      rows: processedRows,
      viewConfig: activeViewConfig,
      onAddRow: handleAddRow,
      onUpdateRow: handleUpdateRow,
      onRowClick: handleRowClick,
      onAddProperty: handleAddProperty,
    };

    switch (activeView?.type) {
      case "table":
        return <TableView {...viewProps} />;
      case "board":
        return <BoardView {...viewProps} />;
      case "list":
        return <ListView {...viewProps} />;
      case "gallery":
        return <GalleryView {...viewProps} />;
      case "calendar":
        return <CalendarView {...viewProps} />;
      case "timeline":
        return <TimelineView {...viewProps} />;
      default:
        return <TableView {...viewProps} />;
    }
  }

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
      <DatabaseToolbar
        activeViewConfig={activeViewConfig ?? null}
        activeViewId={activeView?.id ?? null}
        properties={data.properties as DatabaseData["properties"]}
        onUpdateViewConfig={handleUpdateViewConfig}
        databaseId={databaseId}
      />

      {/* Active view */}
      <div className="min-h-[200px]">
        {renderView()}
      </div>
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
