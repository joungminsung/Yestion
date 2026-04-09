"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { useDatabaseStore } from "@/stores/database";
import { filterRows } from "@/lib/database/filter-engine";
import { sortRows } from "@/lib/database/sort-engine";
import { DatabaseToolbar } from "./database-toolbar";
import { RowTemplateManager } from "./row-template-manager";
import { TableView } from "./views/table-view";
import { BoardView } from "./views/board-view";
import { ListView } from "./views/list-view";
import { GalleryView } from "./views/gallery-view";
import { CalendarView } from "./views/calendar-view";
import { TimelineView } from "./views/timeline-view";
import { RowPeekPanel } from "./row-peek-panel";
import { CellRenderer } from "./cell-renderer";
import { useDevice } from "@/components/providers/responsive-provider";
import { cn } from "@/lib/utils";
import type { ViewConfig, FilterGroup, SortRule, DatabaseData, RowData } from "@/types/database";

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
  const params = useParams();
  const workspaceId = params.workspaceId as string | undefined;
  const { isMobile } = useDevice();
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.database.get.useQuery(
    { databaseId },
    { refetchInterval: 10000 },
  );
  const updateViewMutation = trpc.database.updateView.useMutation();
  const addRowMutation = trpc.database.addRow.useMutation({
    onSuccess: () => utils.database.get.invalidate({ databaseId }),
  });
  const updateRowMutation = trpc.database.updateRow.useMutation({
    onSuccess: () => utils.database.get.invalidate({ databaseId }),
  });
  const addRowFromTemplateMutation = trpc.database.addRowFromTemplate.useMutation({
    onSuccess: () => utils.database.get.invalidate({ databaseId }),
  });
  const addPropertyMutation = trpc.database.addProperty.useMutation({
    onSuccess: () => utils.database.get.invalidate({ databaseId }),
  });
  const deleteRowMutation = trpc.database.deleteRow.useMutation({
    onSuccess: () => utils.database.get.invalidate({ databaseId }),
  });
  const bulkDeleteMutation = trpc.database.bulkDeleteRows.useMutation({
    onSuccess: () => {
      utils.database.get.invalidate({ databaseId });
      clearSelection();
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- exposed for programmatic bulk updates
  const bulkUpdateMutation = trpc.database.bulkUpdateRows.useMutation({
    onSuccess: () => {
      utils.database.get.invalidate({ databaseId });
      clearSelection();
    },
  });
  const duplicateRowMutation = trpc.database.duplicateRow.useMutation({
    onSuccess: () => utils.database.get.invalidate({ databaseId }),
  });

  const {
    activeViewId,
    setActiveView,
    localFilters,
    localSorts,
    setLocalSorts,
    localGroup,
    resetLocal,
    selectedRowIds,
    clearSelection,
    searchQuery,
    currentPage,
    pageSize,
    setCurrentPage,
  } = useDatabaseStore();

  // Ensure the current database always has a valid active view.
  useEffect(() => {
    const firstView = data?.views[0];
    if (!firstView) return;

    const hasActiveView = data.views.some((view) => view.id === activeViewId);
    if (!hasActiveView) {
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

  const normalizedRows = useMemo(() => {
    if (!data?.rows) return [];

    return data.rows.map((row) => ({
      ...row,
      values: (row.values && typeof row.values === "object" && !Array.isArray(row.values)
        ? row.values
        : {}) as Record<string, unknown>,
    }));
  }, [data?.rows]);

  // Build property type map for sort engine
  const propertyTypes = useMemo(() => {
    if (!data?.properties) return {};

    return Object.fromEntries(
      data.properties.map((p) => [p.id, p.type]),
    );
  }, [data?.properties]);

  // Effective filter/sort (local overrides > view config)
  const effectiveFilter: FilterGroup | undefined =
    localFilters ?? activeViewConfig?.filter;
  const effectiveSorts: SortRule[] | undefined =
    localSorts ?? activeViewConfig?.sorts;

  // Effective group
  const effectiveGroup = localGroup ?? activeViewConfig?.group;

  // Persist view config changes via tRPC
  const handleUpdateViewConfig = useCallback(
    (configPatch: Partial<ViewConfig>) => {
      if (!activeView) return;
      updateViewMutation.mutate({ id: activeView.id, config: configPatch });
    },
    [activeView, updateViewMutation],
  );

  // Sort change handler (from table header clicks)
  const handleSortChange = useCallback(
    (newSorts: SortRule[]) => {
      setLocalSorts(newSorts.length > 0 ? newSorts : null);
    },
    [setLocalSorts],
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

  const handleAddRowFromTemplate = useCallback(
    (templateId: string) => {
      addRowFromTemplateMutation.mutate({ databaseId, templateId });
    },
    [addRowFromTemplateMutation, databaseId],
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

  const handleAddProperty = useCallback(() => {
    addPropertyMutation.mutate({
      databaseId,
      name: "New Property",
      type: "text",
    });
  }, [addPropertyMutation, databaseId]);

  const handleBulkDelete = useCallback(() => {
    if (selectedRowIds.size === 0) return;
    bulkDeleteMutation.mutate({
      databaseId,
      rowIds: Array.from(selectedRowIds),
    });
  }, [selectedRowIds, bulkDeleteMutation, databaseId]);

  const handleDuplicateRow = useCallback(
    (rowId: string) => {
      duplicateRowMutation.mutate({ rowId });
    },
    [duplicateRowMutation],
  );

  const handleDeleteRow = useCallback(
    (rowId: string) => {
      deleteRowMutation.mutate({ id: rowId });
    },
    [deleteRowMutation],
  );

  // Apply filter + sort + search
  const allProcessedRows = useMemo(() => {
    if (normalizedRows.length === 0) return [];

    let filtered = filterRows(normalizedRows, effectiveFilter);

    // Apply search query across all text values
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((row) => {
        // Search page title
        if (row.page?.title?.toLowerCase().includes(q)) return true;
        // Search all values
        return Object.values(row.values).some((val) => {
          if (val == null) return false;
          return String(val).toLowerCase().includes(q);
        });
      });
    }

    return sortRows(filtered, effectiveSorts, propertyTypes);
  }, [normalizedRows, effectiveFilter, effectiveSorts, propertyTypes, searchQuery]);

  // Pagination
  const totalRows = allProcessedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [currentPage, totalPages, setCurrentPage]);

  const processedRows = useMemo(() => {
    const start = currentPage * pageSize;
    return allProcessedRows.slice(start, start + pageSize);
  }, [allProcessedRows, currentPage, pageSize]);

  // ── Peek view state ──────────────────────────────────────────
  const [peekRow, setPeekRow] = useState<RowData | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    resetLocal();
    setPeekRow(null);
    setCollapsedGroups(new Set());
  }, [databaseId, resetLocal]);

  const rowsByPageId = useMemo(
    () => new Map(allProcessedRows.map((row) => [row.pageId, row] as const)),
    [allProcessedRows],
  );

  const buildPageHref = useCallback(
    (pageId: string) => (workspaceId ? `/${workspaceId}/${pageId}` : `/page/${pageId}`),
    [workspaceId],
  );

  const handleRowClick = useCallback(
    (pageId: string) => {
      const row = rowsByPageId.get(pageId);
      if (row) {
        setPeekRow(row);
      } else {
        router.push(buildPageHref(pageId));
      }
    },
    [buildPageHref, router, rowsByPageId],
  );

  const handleOpenFullPage = useCallback(
    (pageId: string) => {
      setPeekRow(null);
      router.push(buildPageHref(pageId));
    },
    [buildPageHref, router],
  );

  // ── Grouping ────────────────────────────────────────────────

  const toggleGroupCollapse = useCallback((groupValue: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupValue)) {
        next.delete(groupValue);
      } else {
        next.add(groupValue);
      }
      return next;
    });
  }, []);

  const groupedRows = useMemo(() => {
    if (!effectiveGroup) return null;
    const groups = new Map<string, RowData[]>();
    processedRows.forEach((row) => {
      const rawValue = row.values[effectiveGroup.propertyId];
      const value = rawValue != null ? String(rawValue) : "No value";
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value)!.push(row);
    });
    return groups;
  }, [processedRows, effectiveGroup]);

  const allGroupKeys = useMemo(() => {
    if (!groupedRows) return [];
    return Array.from(groupedRows.keys());
  }, [groupedRows]);

  const handleCollapseAll = useCallback(() => {
    setCollapsedGroups(new Set(allGroupKeys));
  }, [allGroupKeys]);

  const handleExpandAll = useCallback(() => {
    setCollapsedGroups(new Set());
  }, []);

  // ── Render the active view component ────────────────────────

  function renderMobileCardList(rowsToRender: RowData[]) {
    if (!data) return null;
    const properties = data.properties as DatabaseData["properties"];
    const titleProp = properties.find((p) => p.type === "title") ?? properties[0];
    const visibleProps = properties.filter((p) => p.id !== titleProp?.id).slice(0, 3);

    return (
      <div className="flex flex-col gap-2 px-2 py-2">
        {rowsToRender.map((row) => (
          <div
            key={row.id}
            className="rounded-lg border p-3 active:bg-[var(--bg-hover)] transition-colors"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-default)",
            }}
            onClick={() => handleRowClick(row.pageId)}
          >
            <div className="font-medium mb-1" style={{ color: "var(--text-primary)", fontSize: "14px" }}>
              {titleProp ? String(row.values[titleProp.id] || "Untitled") : "Untitled"}
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleProps.map((prop) => (
                <div key={prop.id} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span className="font-medium">{prop.name}: </span>
                  <CellRenderer value={row.values[prop.id]} type={prop.type} config={prop.config} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={() => handleAddRow()}
          className="rounded-lg border border-dashed p-3 text-sm transition-colors hover:bg-[var(--bg-hover)]"
          style={{ borderColor: "var(--border-default)", color: "var(--text-tertiary)" }}
        >
          + New
        </button>
      </div>
    );
  }

  function renderView(rowsToRender: RowData[]) {
    if (!data || !activeViewConfig) return null;

    const viewProps = {
      databaseId: data.id ?? databaseId,
      properties: data.properties as DatabaseData["properties"],
      rows: rowsToRender,
      viewConfig: activeViewConfig,
      onAddRow: handleAddRow,
      onUpdateRow: handleUpdateRow,
      onRowClick: handleRowClick,
      onAddProperty: handleAddProperty,
    };

    switch (activeView?.type) {
      case "table":
        // On mobile, show card list instead of wide table
        if (isMobile) return renderMobileCardList(rowsToRender);
        return (
          <TableView
            {...viewProps}
            sorts={effectiveSorts}
            onSortChange={handleSortChange}
            onDeleteRow={handleDeleteRow}
            onDuplicateRow={handleDuplicateRow}
          />
        );
      case "board":
        return (
          <div className={cn(isMobile && "overflow-x-auto snap-x snap-mandatory pb-4 -mx-2 px-2")}>
            <BoardView {...viewProps} />
          </div>
        );
      case "list":
        return <ListView {...viewProps} />;
      case "gallery":
        return <GalleryView {...viewProps} />;
      case "calendar":
        return <CalendarView {...viewProps} />;
      case "timeline":
        return <TimelineView {...viewProps} />;
      default:
        if (isMobile) return renderMobileCardList(rowsToRender);
        return (
          <TableView
            {...viewProps}
            sorts={effectiveSorts}
            onSortChange={handleSortChange}
            onDeleteRow={handleDeleteRow}
            onDuplicateRow={handleDuplicateRow}
          />
        );
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
      <div
        className="flex items-center gap-0 border-b px-1"
        style={{ borderColor: "var(--border-default)" }}
      >
        {data.views.map((view) => {
          const isActive = view.id === activeViewId;
          return (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id)}
              className="relative flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors hover:bg-[var(--bg-hover)]"
              style={{
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              <span className="opacity-60">{viewTypeIcon(view.type)}</span>
              <span>{view.name}</span>
              {isActive && (
                <span
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                  style={{ backgroundColor: "#2383e2" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <DatabaseToolbar
        activeViewConfig={activeViewConfig ?? null}
        activeViewId={activeView?.id ?? null}
        properties={data.properties as DatabaseData["properties"]}
        onUpdateViewConfig={handleUpdateViewConfig}
        databaseId={databaseId}
      />

      <div
        className="flex items-center justify-end px-3 py-1.5 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <RowTemplateManager
          databaseId={databaseId}
          properties={data.properties as DatabaseData["properties"]}
          onAddRowFromTemplate={handleAddRowFromTemplate}
        />
      </div>

      {/* Group collapse/expand controls */}
      {groupedRows && (
        <div
          className="flex items-center gap-2 border-b px-3 py-1"
          style={{ borderColor: "var(--border-default)" }}
        >
          <button
            onClick={handleExpandAll}
            className="rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-secondary)" }}
          >
            Expand all
          </button>
          <button
            onClick={handleCollapseAll}
            className="rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-secondary)" }}
          >
            Collapse all
          </button>
        </div>
      )}

      {/* Bulk actions bar */}
      {selectedRowIds.size > 0 && (
        <div
          className="flex items-center gap-3 border-b px-3 py-1.5"
          style={{
            borderColor: "var(--border-default)",
            backgroundColor: "#2383e210",
          }}
        >
          <span className="text-xs font-medium" style={{ color: "#2383e2" }}>
            {selectedRowIds.size}개 선택됨
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
            className="rounded px-2 py-0.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            {bulkDeleteMutation.isPending ? "삭제 중..." : "일괄 삭제"}
          </button>
          <button
            onClick={clearSelection}
            className="rounded px-2 py-0.5 text-xs transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-secondary)" }}
          >
            선택 해제
          </button>
        </div>
      )}

      {/* Active view */}
      <div className="min-h-[200px]">
        {groupedRows ? (
          Array.from(groupedRows.entries()).map(([groupValue, groupRows]) => (
            <div key={groupValue}>
              <button
                onClick={() => toggleGroupCollapse(groupValue)}
                className="flex items-center gap-2 px-3 py-1.5 w-full text-left transition-colors hover:bg-[var(--bg-hover)]"
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                }}
              >
                <span
                  style={{
                    transform: collapsedGroups.has(groupValue)
                      ? "rotate(0deg)"
                      : "rotate(90deg)",
                    transition: "transform 150ms",
                    display: "inline-block",
                    fontSize: "10px",
                  }}
                >
                  {"\u25B6"}
                </span>
                {groupValue}
                <span
                  className="text-xs"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  ({groupRows.length})
                </span>
              </button>
              {!collapsedGroups.has(groupValue) && renderView(groupRows)}
            </div>
          ))
        ) : (
          renderView(processedRows)
        )}
      </div>

      {/* Pagination */}
      {totalRows > pageSize && (
        <div
          className="flex items-center justify-between border-t px-3 py-2"
          style={{ borderColor: "var(--border-default)" }}
        >
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {totalRows}개 중 {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, totalRows)}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="rounded px-2 py-1 text-xs transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-30"
              style={{ color: "var(--text-primary)" }}
            >
              &larr; 이전
            </button>
            <span className="px-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              className="rounded px-2 py-1 text-xs transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-30"
              style={{ color: "var(--text-primary)" }}
            >
              다음 &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Row Peek Panel */}
      {peekRow && data && (
        <RowPeekPanel
          rowId={peekRow.id}
          pageId={peekRow.pageId}
          databaseId={databaseId}
          properties={data.properties as DatabaseData["properties"]}
          values={peekRow.values}
          onClose={() => setPeekRow(null)}
          onUpdateRow={handleUpdateRow}
          onOpenFullPage={handleOpenFullPage}
        />
      )}
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
