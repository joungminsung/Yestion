"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useDatabaseStore } from "@/stores/database";
import { Button } from "@/components/ui/button";
import { DatabaseFilter } from "./database-filter";
import { DatabaseSort } from "./database-sort";
import type { ViewConfig, FilterGroup, SortRule, DatabaseData } from "@/types/database";

type DatabaseToolbarProps = {
  activeViewConfig: ViewConfig | null;
  activeViewId?: string | null;
  properties: DatabaseData["properties"];
  onUpdateViewConfig?: (config: Partial<ViewConfig>) => void;
};

export function DatabaseToolbar({
  activeViewConfig,
  properties,
  onUpdateViewConfig,
}: DatabaseToolbarProps) {
  const { localFilters, localSorts, setLocalFilters, setLocalSorts } = useDatabaseStore();

  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

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

  // Close panels on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (showFilter && filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
      if (showSort && sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSort(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilter, showSort]);

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
          onClick={() => { setShowFilter(!showFilter); setShowSort(false); }}
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
          onClick={() => { setShowSort(!showSort); setShowFilter(false); }}
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
      <Button variant="ghost" size="sm" className="gap-1">
        <GroupIcon />
        Group
        {hasGroup && (
          <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#2383e2] text-[10px] text-white">
            1
          </span>
        )}
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Properties toggle */}
      <Button variant="ghost" size="sm">
        Properties
      </Button>

      {/* New view */}
      <Button variant="ghost" size="sm">
        + New view
      </Button>
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
