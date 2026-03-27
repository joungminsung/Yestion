"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/server/trpc/client";
import { useDatabaseStore } from "@/stores/database";
import { Button } from "@/components/ui/button";
import { DatabaseFilter } from "./database-filter";
import { DatabaseSort } from "./database-sort";
import { propertyTypeIcon } from "./property-type-icon";
import type { ViewConfig, ViewType, FilterGroup, SortRule, GroupRule, DatabaseData } from "@/types/database";

const GROUPABLE_TYPES = new Set(["select", "multi_select", "status", "person"]);

const VIEW_TYPE_OPTIONS: { type: ViewType; label: string; icon: string }[] = [
  { type: "table", label: "Table", icon: "\u2630" },
  { type: "board", label: "Board", icon: "\u25A6" },
  { type: "list", label: "List", icon: "\u2261" },
  { type: "gallery", label: "Gallery", icon: "\u25A3" },
  { type: "calendar", label: "Calendar", icon: "\uD83D\uDCC5" },
  { type: "timeline", label: "Timeline", icon: "\u2192" },
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

  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [showNewView, setShowNewView] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const propertiesRef = useRef<HTMLDivElement>(null);
  const newViewRef = useRef<HTMLDivElement>(null);

  const effectiveFilter = localFilters ?? activeViewConfig?.filter ?? null;
  const effectiveSorts = localSorts ?? activeViewConfig?.sorts ?? null;

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
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilter, showSort, showGroup, showProperties, showNewView]);

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

  const closeAllExcept = (panel: string) => {
    if (panel !== "filter") setShowFilter(false);
    if (panel !== "sort") setShowSort(false);
    if (panel !== "group") setShowGroup(false);
    if (panel !== "properties") setShowProperties(false);
    if (panel !== "newView") setShowNewView(false);
  };

  return (
    <div
      className="relative flex items-center gap-1 border-b px-2 py-1"
      style={{ borderColor: "var(--border-default)" }}
    >
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

      {/* Spacer */}
      <div className="flex-1" />

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
