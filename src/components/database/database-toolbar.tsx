"use client";

import { useMemo, useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { trpc } from "@/server/trpc/client";
import { useDatabaseStore } from "@/stores/database";
import { Button } from "@/components/ui/button";
import { DatabaseFilter } from "./database-filter";
import { DatabaseSort } from "./database-sort";
import { propertyTypeIcon } from "./property-type-icon";
import { parseCSV, detectPropertyType } from "@/lib/csv-import";
import type { ViewConfig, ViewType, FilterGroup, SortRule, GroupRule, DatabaseData, RowHeight, DatabaseLockLevel, AggregationFunction } from "@/types/database";
import { Table, Kanban, List, LayoutGrid, Calendar, ArrowRight } from "lucide-react";

const GROUPABLE_TYPES = new Set(["select", "multi_select", "status", "person"]);

const VIEW_TYPE_OPTIONS: { type: ViewType; label: string; icon: ReactNode }[] = [
  { type: "table", label: "Table", icon: <Table size={14} /> },
  { type: "board", label: "Board", icon: <Kanban size={14} /> },
  { type: "list", label: "List", icon: <List size={14} /> },
  { type: "gallery", label: "Gallery", icon: <LayoutGrid size={14} /> },
  { type: "calendar", label: "Calendar", icon: <Calendar size={14} /> },
  { type: "timeline", label: "Timeline", icon: <ArrowRight size={14} /> },
];

const ROW_HEIGHT_OPTIONS: { value: RowHeight; label: string; height: string }[] = [
  { value: "short", label: "Short", height: "33px" },
  { value: "medium", label: "Medium", height: "56px" },
  { value: "tall", label: "Tall", height: "76px" },
  { value: "auto", label: "Auto", height: "Auto" },
];

const LOCK_OPTIONS: { value: DatabaseLockLevel; label: string; description: string }[] = [
  { value: "none", label: "Unlocked", description: "Anyone can edit" },
  { value: "structure", label: "Structure lock", description: "Can edit data, not properties or views" },
  { value: "full", label: "Full lock", description: "No changes allowed" },
];

type DatabaseToolbarProps = {
  activeViewConfig: ViewConfig | null;
  activeViewId?: string | null;
  properties: DatabaseData["properties"];
  onUpdateViewConfig?: (config: Partial<ViewConfig>) => void;
  databaseId?: string;
};

export function DatabaseToolbar({
  activeViewConfig,
  properties,
  onUpdateViewConfig,
  databaseId,
}: DatabaseToolbarProps) {
  const { localFilters, localSorts, setLocalFilters, setLocalSorts, setLocalGroup } = useDatabaseStore();
  const utils = trpc.useUtils();

  const toggleLockMutation = trpc.database.toggleLock.useMutation({
    onSuccess: () => {
      if (databaseId) utils.database.get.invalidate({ databaseId });
    },
  });

  const addViewMutation = trpc.database.addView.useMutation({
    onSuccess: () => {
      if (databaseId) utils.database.get.invalidate({ databaseId });
    },
  });
  const updatePropertyMutation = trpc.database.updateProperty.useMutation({
    onSuccess: () => {
      if (databaseId) utils.database.get.invalidate({ databaseId });
    },
  });
  const importCSVMutation = trpc.database.importCSV.useMutation({
    onSuccess: () => {
      if (databaseId) utils.database.get.invalidate({ databaseId });
      setCsvPreview(null);
    },
  });

  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [showNewView, setShowNewView] = useState(false);
  const [showRowHeight, setShowRowHeight] = useState(false);
  const [showLock, setShowLock] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; rows: string[][]; propertyTypes: Record<string, string> } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const propertiesRef = useRef<HTMLDivElement>(null);
  const newViewRef = useRef<HTMLDivElement>(null);
  const rowHeightRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef<HTMLDivElement>(null);

  const effectiveFilter = localFilters ?? activeViewConfig?.filter ?? null;
  const effectiveSorts = localSorts ?? activeViewConfig?.sorts ?? null;
  const currentRowHeight = activeViewConfig?.rowHeight ?? "short";
  const currentLockLevel = activeViewConfig?.lockLevel ?? "none";
  const isLocked = currentLockLevel !== "none";

  const filterCount = useMemo(() => {
    if (!effectiveFilter) return 0;
    return effectiveFilter.conditions.length;
  }, [effectiveFilter]);

  const sortCount = useMemo(() => {
    return effectiveSorts?.length ?? 0;
  }, [effectiveSorts]);

  const hasGroup = !!activeViewConfig?.group;

  const groupableProperties = useMemo(
    () => properties.filter((p) => GROUPABLE_TYPES.has(p.type)),
    [properties],
  );

  // Listen for aggregation update events from table-view
  useEffect(() => {
    function handleAggregationUpdate(e: Event) {
      const detail = (e as CustomEvent).detail as { propertyId: string; aggregation: AggregationFunction };
      if (!onUpdateViewConfig) return;
      const current = activeViewConfig?.columnAggregations ?? {};
      onUpdateViewConfig({
        columnAggregations: {
          ...current,
          [detail.propertyId]: detail.aggregation,
        },
      });
    }
    document.addEventListener("database:updateAggregation", handleAggregationUpdate);
    return () => document.removeEventListener("database:updateAggregation", handleAggregationUpdate);
  }, [onUpdateViewConfig, activeViewConfig?.columnAggregations]);

  // Close panels on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (showFilter && filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
      if (showSort && sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSort(false);
      }
      if (showGroup && groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setShowGroup(false);
      }
      if (showProperties && propertiesRef.current && !propertiesRef.current.contains(e.target as Node)) {
        setShowProperties(false);
      }
      if (showNewView && newViewRef.current && !newViewRef.current.contains(e.target as Node)) {
        setShowNewView(false);
      }
      if (showRowHeight && rowHeightRef.current && !rowHeightRef.current.contains(e.target as Node)) {
        setShowRowHeight(false);
      }
      if (showLock && lockRef.current && !lockRef.current.contains(e.target as Node)) {
        setShowLock(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilter, showSort, showGroup, showProperties, showNewView, showRowHeight, showLock]);

  const handleFilterChange = (filter: FilterGroup | null) => {
    setLocalFilters(filter);
    if (onUpdateViewConfig) {
      onUpdateViewConfig({ filter: filter ?? undefined });
    }
  };

  const handleSortChange = (sorts: SortRule[] | null) => {
    setLocalSorts(sorts);
    if (onUpdateViewConfig) {
      onUpdateViewConfig({ sorts: sorts ?? undefined });
    }
  };

  const handleGroupSelect = useCallback(
    (propertyId: string | null) => {
      if (!propertyId) {
        setLocalGroup(null);
        if (onUpdateViewConfig) {
          onUpdateViewConfig({ group: undefined });
        }
      } else {
        const rule: GroupRule = { propertyId };
        setLocalGroup(rule);
        if (onUpdateViewConfig) {
          onUpdateViewConfig({ group: rule });
        }
      }
      setShowGroup(false);
    },
    [setLocalGroup, onUpdateViewConfig],
  );

  const handleTogglePropertyVisibility = useCallback(
    (propertyId: string, currentlyVisible: boolean) => {
      updatePropertyMutation.mutate({
        id: propertyId,
        isVisible: !currentlyVisible,
      });
    },
    [updatePropertyMutation],
  );

  const handleAddView = useCallback(
    (type: ViewType) => {
      if (!databaseId) return;
      const label = VIEW_TYPE_OPTIONS.find((v) => v.type === type)?.label ?? "View";
      addViewMutation.mutate({
        databaseId,
        name: `${label} View`,
        type,
      });
      setShowNewView(false);
    },
    [databaseId, addViewMutation],
  );

  const handleRowHeightChange = useCallback(
    (height: RowHeight) => {
      if (onUpdateViewConfig) {
        onUpdateViewConfig({ rowHeight: height });
      }
      setShowRowHeight(false);
    },
    [onUpdateViewConfig],
  );

  const handleLockChange = useCallback(
    (level: DatabaseLockLevel) => {
      if (onUpdateViewConfig) {
        onUpdateViewConfig({ lockLevel: level });
      }
      setShowLock(false);
    },
    [onUpdateViewConfig],
  );

  const handleCSVFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (!text) return;
        const { headers, rows } = parseCSV(text);
        if (headers.length === 0) return;
        // Auto-detect types
        const propertyTypes: Record<string, string> = {};
        headers.forEach((h, i) => {
          if (i === 0) return; // title column
          const colValues = rows.map((r) => r[i] ?? "");
          propertyTypes[h] = detectPropertyType(colValues);
        });
        setCsvPreview({ headers, rows, propertyTypes });
      };
      reader.readAsText(file);
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [],
  );

  const handleCSVImport = useCallback(() => {
    if (!databaseId || !csvPreview) return;
    importCSVMutation.mutate({
      databaseId,
      headers: csvPreview.headers,
      rows: csvPreview.rows,
      propertyTypes: csvPreview.propertyTypes,
    });
  }, [databaseId, csvPreview, importCSVMutation]);

  const closeAllExcept = (panel: string) => {
    if (panel !== "filter") setShowFilter(false);
    if (panel !== "sort") setShowSort(false);
    if (panel !== "group") setShowGroup(false);
    if (panel !== "properties") setShowProperties(false);
    if (panel !== "newView") setShowNewView(false);
    if (panel !== "rowHeight") setShowRowHeight(false);
    if (panel !== "lock") setShowLock(false);
  };

  return (
    <div
      className="relative flex items-center gap-1 border-b px-2 py-1"
      style={{ borderColor: "var(--border-default)" }}
    >
      {/* Lock indicator */}
      {isLocked && (
        <span
          className="mr-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: currentLockLevel === "full" ? "#ffe2dd" : "#fdecc8",
            color: currentLockLevel === "full" ? "#e03e3e" : "#a17e2b",
          }}
        >
          <LockIcon />
          {currentLockLevel === "full" ? "Locked" : "Structure locked"}
        </span>
      )}

      {/* Filter button */}
      <div className="relative" ref={filterRef}>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => { closeAllExcept("filter"); setShowFilter(!showFilter); }}
        >
          <FilterIcon />
          Filter
          {filterCount > 0 && <Badge count={filterCount} />}
        </Button>
        {showFilter && (
          <div className="absolute left-0 top-full z-50 mt-1">
            <DatabaseFilter
              properties={properties}
              filter={effectiveFilter}
              onFilterChange={handleFilterChange}
              onClose={() => setShowFilter(false)}
            />
          </div>
        )}
      </div>

      {/* Sort button */}
      <div className="relative" ref={sortRef}>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => { closeAllExcept("sort"); setShowSort(!showSort); }}
        >
          <SortIcon />
          Sort
          {sortCount > 0 && <Badge count={sortCount} />}
        </Button>
        {showSort && (
          <div className="absolute left-0 top-full z-50 mt-1">
            <DatabaseSort
              properties={properties}
              sorts={effectiveSorts}
              onSortChange={handleSortChange}
              onClose={() => setShowSort(false)}
            />
          </div>
        )}
      </div>

      {/* Group button */}
      <div className="relative" ref={groupRef}>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => { closeAllExcept("group"); setShowGroup(!showGroup); }}
        >
          <GroupIcon />
          Group
          {hasGroup && (
            <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#2383e2] text-[10px] text-white">
              1
            </span>
          )}
        </Button>
        {showGroup && (
          <div
            className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-md border bg-[var(--bg-primary)] p-1 shadow-lg"
            style={{ borderColor: "var(--border-default)" }}
          >
            {/* Remove group option */}
            {hasGroup && (
              <button
                onClick={() => handleGroupSelect(null)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-secondary)" }}
              >
                Remove grouping
              </button>
            )}
            {groupableProperties.length === 0 ? (
              <div
                className="px-2 py-1.5 text-xs"
                style={{ color: "var(--text-tertiary)" }}
              >
                No groupable properties (select, multi_select, status, or person)
              </div>
            ) : (
              groupableProperties.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleGroupSelect(p.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    color:
                      activeViewConfig?.group?.propertyId === p.id
                        ? "#2383e2"
                        : "var(--text-primary)",
                  }}
                >
                  <span className="shrink-0 opacity-60">
                    {propertyTypeIcon(p.type)}
                  </span>
                  <span className="truncate">{p.name}</span>
                  {activeViewConfig?.group?.propertyId === p.id && (
                    <span className="ml-auto text-xs">&#10003;</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Row Height button */}
      <div className="relative" ref={rowHeightRef}>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => { closeAllExcept("rowHeight"); setShowRowHeight(!showRowHeight); }}
        >
          <RowHeightIcon />
          Height
        </Button>
        {showRowHeight && (
          <div
            className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-md border bg-[var(--bg-primary)] p-1 shadow-lg"
            style={{ borderColor: "var(--border-default)" }}
          >
            {ROW_HEIGHT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleRowHeightChange(opt.value)}
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--bg-hover)]"
                style={{
                  color: currentRowHeight === opt.value ? "#2383e2" : "var(--text-primary)",
                }}
              >
                <span>{opt.label}</span>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{opt.height}</span>
                {currentRowHeight === opt.value && (
                  <span className="text-xs">&#10003;</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CSV Import */}
      <div className="relative">
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleCSVFile}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => csvInputRef.current?.click()}
        >
          CSV
        </Button>
        {csvPreview && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
            onClick={() => setCsvPreview(null)}
          >
            <div
              className="w-[560px] max-h-[80vh] overflow-auto rounded-lg border p-4 shadow-xl"
              style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                CSV Import Preview
              </h3>
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      {csvPreview.headers.map((h, i) => (
                        <th
                          key={i}
                          className="border px-2 py-1 text-left font-medium"
                          style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
                        >
                          <div>{h}</div>
                          <div className="font-normal opacity-60">
                            {i === 0 ? "title" : csvPreview.propertyTypes[h] || "text"}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.rows.slice(0, 5).map((row, ri) => (
                      <tr key={ri}>
                        {csvPreview.headers.map((_, ci) => (
                          <td
                            key={ci}
                            className="border px-2 py-1"
                            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                          >
                            {row[ci] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvPreview.rows.length > 5 && (
                  <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    ... and {csvPreview.rows.length - 5} more rows
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCsvPreview(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCSVImport}
                  disabled={importCSVMutation.isPending}
                  className="bg-[#2383e2] text-white hover:bg-[#0b6ec5]"
                >
                  {importCSVMutation.isPending ? "Importing..." : `Import (${csvPreview.rows.length} rows)`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Lock button */}
      <div className="relative" ref={lockRef}>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => { closeAllExcept("lock"); setShowLock(!showLock); }}
        >
          {isLocked ? <LockIcon /> : <UnlockIcon />}
          {isLocked ? "Locked" : "Lock"}
        </Button>
        {showLock && (
          <div
            className="absolute right-0 top-full z-50 mt-1 min-w-[240px] rounded-md border bg-[var(--bg-primary)] p-1 shadow-lg"
            style={{ borderColor: "var(--border-default)" }}
          >
            {LOCK_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleLockChange(opt.value)}
                className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
                style={{
                  color: currentLockLevel === opt.value ? "#2383e2" : "var(--text-primary)",
                }}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm font-medium">{opt.label}</span>
                  {currentLockLevel === opt.value && (
                    <span className="text-xs">&#10003;</span>
                  )}
                </div>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {opt.description}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Properties toggle */}
      <div className="relative" ref={propertiesRef}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { closeAllExcept("properties"); setShowProperties(!showProperties); }}
        >
          Properties
        </Button>
        {showProperties && (
          <div
            className="absolute right-0 top-full z-50 mt-1 min-w-[220px] max-h-[320px] overflow-y-auto rounded-md border bg-[var(--bg-primary)] p-1 shadow-lg"
            style={{ borderColor: "var(--border-default)" }}
          >
            {properties.map((p) => (
              <label
                key={p.id}
                className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-primary)" }}
              >
                <input
                  type="checkbox"
                  checked={p.isVisible}
                  onChange={() => handleTogglePropertyVisibility(p.id, p.isVisible)}
                  className="h-3.5 w-3.5 accent-[#2383e2]"
                />
                <span className="shrink-0 opacity-60 text-xs">
                  {propertyTypeIcon(p.type)}
                </span>
                <span className="truncate">{p.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* New view */}
      <div className="relative" ref={newViewRef}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { closeAllExcept("newView"); setShowNewView(!showNewView); }}
        >
          + New view
        </Button>
        {showNewView && (
          <div
            className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-md border bg-[var(--bg-primary)] p-1 shadow-lg"
            style={{ borderColor: "var(--border-default)" }}
          >
            {VIEW_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                onClick={() => handleAddView(opt.type)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-primary)" }}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#2383e2] px-1 text-[10px] text-white">
      {count}
    </span>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="14" y2="6" />
      <line x1="4" y1="12" x2="11" y2="12" />
      <line x1="4" y1="18" x2="8" y2="18" />
      <polyline points="17 9 20 6 23 9" />
      <line x1="20" y1="6" x2="20" y2="18" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function RowHeightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <polyline points="12 2 12 6" />
      <polyline points="12 18 12 22" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}
