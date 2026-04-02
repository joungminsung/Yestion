"use client";

import { useMemo, useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { trpc } from "@/server/trpc/client";
import { useDatabaseStore } from "@/stores/database";
import { DatabaseFilter } from "./database-filter";
import { DatabaseSort } from "./database-sort";
import { propertyTypeIcon } from "./property-type-icon";
import { parseCSV, detectPropertyType } from "@/lib/csv-import";
import type { ViewConfig, ViewType, FilterGroup, SortRule, GroupRule, DatabaseData, RowHeight, DatabaseLockLevel, AggregationFunction } from "@/types/database";
import {
  Filter, ArrowUpDown, LayoutGrid, Rows3, GalleryHorizontalEnd,
  Calendar, ArrowRight, Kanban, List, Search, X,
  Lock, Unlock, ChevronDown, Plus, Copy, Database, Upload,
  Eye, MoreHorizontal, Maximize2,
} from "lucide-react";

const GROUPABLE_TYPES = new Set(["select", "multi_select", "status", "person"]);

const VIEW_TYPE_OPTIONS: { type: ViewType; label: string; icon: ReactNode }[] = [
  { type: "table", label: "테이블", icon: <Rows3 size={14} /> },
  { type: "board", label: "보드", icon: <Kanban size={14} /> },
  { type: "list", label: "리스트", icon: <List size={14} /> },
  { type: "gallery", label: "갤러리", icon: <GalleryHorizontalEnd size={14} /> },
  { type: "calendar", label: "캘린더", icon: <Calendar size={14} /> },
  { type: "timeline", label: "타임라인", icon: <ArrowRight size={14} /> },
];

const ROW_HEIGHT_OPTIONS: { value: RowHeight; label: string }[] = [
  { value: "short", label: "짧게" },
  { value: "medium", label: "보통" },
  { value: "tall", label: "길게" },
  { value: "auto", label: "자동" },
];

const LOCK_OPTIONS: { value: DatabaseLockLevel; label: string; desc: string }[] = [
  { value: "none", label: "잠금 해제", desc: "누구나 편집 가능" },
  { value: "structure", label: "구조 잠금", desc: "데이터만 편집 가능" },
  { value: "full", label: "전체 잠금", desc: "모든 변경 불가" },
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
  activeViewId,
  properties,
  onUpdateViewConfig,
  databaseId,
}: DatabaseToolbarProps) {
  const { localFilters, localSorts, setLocalFilters, setLocalSorts, setLocalGroup, searchQuery, setSearchQuery } = useDatabaseStore();
  const utils = trpc.useUtils();

  const addViewMutation = trpc.database.addView.useMutation({
    onSuccess: () => { if (databaseId) utils.database.get.invalidate({ databaseId }); },
  });
  const updatePropertyMutation = trpc.database.updateProperty.useMutation({
    onSuccess: () => { if (databaseId) utils.database.get.invalidate({ databaseId }); },
  });
  const importCSVMutation = trpc.database.importCSV.useMutation({
    onSuccess: () => { if (databaseId) utils.database.get.invalidate({ databaseId }); setCsvPreview(null); },
  });
  const duplicateViewMutation = trpc.database.duplicateView.useMutation({
    onSuccess: () => { if (databaseId) utils.database.get.invalidate({ databaseId }); },
  });
  const duplicateDatabaseMutation = trpc.database.duplicateDatabase.useMutation();

  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; rows: string[][]; propertyTypes: Record<string, string> } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const effectiveFilter = localFilters ?? activeViewConfig?.filter ?? null;
  const effectiveSorts = localSorts ?? activeViewConfig?.sorts ?? null;
  const currentRowHeight = activeViewConfig?.rowHeight ?? "short";
  const currentLockLevel = activeViewConfig?.lockLevel ?? "none";
  const isLocked = currentLockLevel !== "none";

  const filterCount = useMemo(() => effectiveFilter?.conditions?.length ?? 0, [effectiveFilter]);
  const sortCount = useMemo(() => effectiveSorts?.length ?? 0, [effectiveSorts]);
  const hasGroup = !!activeViewConfig?.group;

  const groupableProperties = useMemo(
    () => properties.filter((p) => GROUPABLE_TYPES.has(p.type)),
    [properties],
  );

  // Listen for aggregation update events
  useEffect(() => {
    function handleAggregationUpdate(e: Event) {
      const detail = (e as CustomEvent).detail as { propertyId: string; aggregation: AggregationFunction };
      if (!onUpdateViewConfig) return;
      const current = activeViewConfig?.columnAggregations ?? {};
      onUpdateViewConfig({ columnAggregations: { ...current, [detail.propertyId]: detail.aggregation } });
    }
    document.addEventListener("database:updateAggregation", handleAggregationUpdate);
    return () => document.removeEventListener("database:updateAggregation", handleAggregationUpdate);
  }, [onUpdateViewConfig, activeViewConfig?.columnAggregations]);

  // Listen for pinned properties update events
  useEffect(() => {
    function handlePinnedUpdate(e: Event) {
      const detail = (e as CustomEvent).detail as { pinnedProperties: string[] };
      if (!onUpdateViewConfig) return;
      onUpdateViewConfig({ pinnedProperties: detail.pinnedProperties });
    }
    document.addEventListener("database:updatePinnedProperties", handlePinnedUpdate);
    return () => document.removeEventListener("database:updatePinnedProperties", handlePinnedUpdate);
  }, [onUpdateViewConfig]);

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (activePanel && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setActivePanel(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activePanel]);

  // Focus search input when shown
  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
  }, [showSearch]);

  const togglePanel = (panel: string) => setActivePanel((prev) => (prev === panel ? null : panel));

  const handleFilterChange = (filter: FilterGroup | null) => {
    setLocalFilters(filter);
    onUpdateViewConfig?.({ filter: filter ?? undefined });
  };

  const handleSortChange = (sorts: SortRule[] | null) => {
    setLocalSorts(sorts);
    onUpdateViewConfig?.({ sorts: sorts ?? undefined });
  };

  const handleGroupSelect = useCallback((propertyId: string | null) => {
    if (!propertyId) {
      setLocalGroup(null);
      onUpdateViewConfig?.({ group: undefined });
    } else {
      const rule: GroupRule = { propertyId };
      setLocalGroup(rule);
      onUpdateViewConfig?.({ group: rule });
    }
    setActivePanel(null);
  }, [setLocalGroup, onUpdateViewConfig]);

  const handleTogglePropertyVisibility = useCallback((propertyId: string, currentlyVisible: boolean) => {
    updatePropertyMutation.mutate({ id: propertyId, isVisible: !currentlyVisible });
  }, [updatePropertyMutation]);

  const handleAddView = useCallback((type: ViewType) => {
    if (!databaseId) return;
    const label = VIEW_TYPE_OPTIONS.find((v) => v.type === type)?.label ?? "View";
    addViewMutation.mutate({ databaseId, name: `${label} 뷰`, type });
    setActivePanel(null);
  }, [databaseId, addViewMutation]);

  const handleRowHeightChange = useCallback((height: RowHeight) => {
    onUpdateViewConfig?.({ rowHeight: height });
    setActivePanel(null);
  }, [onUpdateViewConfig]);

  const handleLockChange = useCallback((level: DatabaseLockLevel) => {
    onUpdateViewConfig?.({ lockLevel: level });
    setActivePanel(null);
  }, [onUpdateViewConfig]);

  const handleCSVFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0) return;
      const propertyTypes: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (i === 0) return;
        const colValues = rows.map((r) => r[i] ?? "");
        propertyTypes[h] = detectPropertyType(colValues);
      });
      setCsvPreview({ headers, rows, propertyTypes });
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleCSVImport = useCallback(() => {
    if (!databaseId || !csvPreview) return;
    importCSVMutation.mutate({
      databaseId,
      headers: csvPreview.headers,
      rows: csvPreview.rows,
      propertyTypes: csvPreview.propertyTypes,
    });
  }, [databaseId, csvPreview, importCSVMutation]);

  return (
    <div className="relative" ref={panelRef}>
      <div
        className="flex items-center gap-0.5 px-2 py-1 border-b"
        style={{ borderColor: "var(--border-default)", minHeight: 36 }}
      >
        {/* Lock indicator */}
        {isLocked && (
          <span
            className="mr-1 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: currentLockLevel === "full" ? "rgba(235,87,87,0.08)" : "rgba(203,145,47,0.08)",
              color: currentLockLevel === "full" ? "#eb5757" : "#cb912f",
            }}
          >
            <Lock size={11} />
            {currentLockLevel === "full" ? "잠금" : "구조 잠금"}
          </span>
        )}

        {/* Filter */}
        <ToolbarButton
          icon={<Filter size={14} />}
          label="필터"
          badge={filterCount}
          active={activePanel === "filter"}
          onClick={() => togglePanel("filter")}
        />

        {/* Sort */}
        <ToolbarButton
          icon={<ArrowUpDown size={14} />}
          label="정렬"
          badge={sortCount}
          active={activePanel === "sort"}
          onClick={() => togglePanel("sort")}
        />

        {/* Group */}
        <ToolbarButton
          icon={<LayoutGrid size={14} />}
          label="그룹"
          badge={hasGroup ? 1 : 0}
          active={activePanel === "group"}
          onClick={() => togglePanel("group")}
        />

        {/* Search toggle */}
        {showSearch ? (
          <div className="flex items-center gap-1 ml-1">
            <Search size={13} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="검색..."
              className="h-6 w-[140px] bg-transparent border-none text-xs outline-none"
              style={{ color: "var(--text-primary)" }}
              onKeyDown={(e) => { if (e.key === "Escape") { setShowSearch(false); setSearchQuery(""); } }}
            />
            <button
              onClick={() => { setShowSearch(false); setSearchQuery(""); }}
              className="rounded-sm p-0.5 hover:bg-[var(--bg-hover)]"
            >
              <X size={12} style={{ color: "var(--text-tertiary)" }} />
            </button>
          </div>
        ) : (
          <ToolbarButton
            icon={<Search size={14} />}
            onClick={() => setShowSearch(true)}
          />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* More menu (Properties, Height, Lock, CSV, Duplicate) */}
        <ToolbarButton
          icon={<MoreHorizontal size={14} />}
          active={activePanel === "more"}
          onClick={() => togglePanel("more")}
        />

        {/* New view */}
        <ToolbarButton
          icon={<Plus size={14} />}
          label="뷰"
          active={activePanel === "newView"}
          onClick={() => togglePanel("newView")}
        />
      </div>

      {/* ── Dropdown Panels ────────────────────────── */}

      {/* Filter panel */}
      {activePanel === "filter" && (
        <div className="absolute left-0 top-full z-50 mt-0.5">
          <DatabaseFilter
            properties={properties}
            filter={effectiveFilter}
            onFilterChange={handleFilterChange}
            onClose={() => setActivePanel(null)}
          />
        </div>
      )}

      {/* Sort panel */}
      {activePanel === "sort" && (
        <div className="absolute left-0 top-full z-50 mt-0.5">
          <DatabaseSort
            properties={properties}
            sorts={effectiveSorts}
            onSortChange={handleSortChange}
            onClose={() => setActivePanel(null)}
          />
        </div>
      )}

      {/* Group panel */}
      {activePanel === "group" && (
        <DropdownPanel style={{ left: 0 }}>
          <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            그룹 기준
          </div>
          {hasGroup && (
            <DropdownItem onClick={() => handleGroupSelect(null)} danger>
              그룹 해제
            </DropdownItem>
          )}
          {groupableProperties.length === 0 ? (
            <div className="px-3 py-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
              그룹 가능한 속성이 없습니다
            </div>
          ) : (
            groupableProperties.map((p) => (
              <DropdownItem
                key={p.id}
                onClick={() => handleGroupSelect(p.id)}
                active={activeViewConfig?.group?.propertyId === p.id}
                icon={<span className="opacity-50 text-xs">{propertyTypeIcon(p.type)}</span>}
              >
                {p.name}
              </DropdownItem>
            ))
          )}
        </DropdownPanel>
      )}

      {/* More menu */}
      {activePanel === "more" && (
        <DropdownPanel style={{ right: 48 }} width={220}>
          <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            옵션
          </div>

          {/* Properties */}
          <DropdownItem
            icon={<Eye size={14} />}
            onClick={() => setActivePanel("properties")}
            suffix={<ChevronDown size={12} className="-rotate-90" />}
          >
            속성
          </DropdownItem>

          {/* Row height */}
          <DropdownItem
            icon={<Maximize2 size={14} />}
            onClick={() => setActivePanel("rowHeight")}
            suffix={<span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              {ROW_HEIGHT_OPTIONS.find((o) => o.value === currentRowHeight)?.label}
            </span>}
          >
            행 높이
          </DropdownItem>

          {/* Lock */}
          <DropdownItem
            icon={isLocked ? <Lock size={14} /> : <Unlock size={14} />}
            onClick={() => setActivePanel("lock")}
            suffix={<span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              {LOCK_OPTIONS.find((o) => o.value === currentLockLevel)?.label}
            </span>}
          >
            잠금
          </DropdownItem>

          <DropdownDivider />

          {/* CSV Import */}
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVFile} />
          <DropdownItem icon={<Upload size={14} />} onClick={() => csvInputRef.current?.click()}>
            CSV 가져오기
          </DropdownItem>

          {/* Duplicate view */}
          {activeViewId && (
            <DropdownItem
              icon={<Copy size={14} />}
              onClick={() => {
                duplicateViewMutation.mutate({ viewId: activeViewId });
                setActivePanel(null);
              }}
              disabled={duplicateViewMutation.isPending}
            >
              뷰 복제
            </DropdownItem>
          )}

          {/* Duplicate database */}
          {databaseId && (
            <DropdownItem
              icon={<Database size={14} />}
              onClick={() => {
                duplicateDatabaseMutation.mutate({ databaseId });
                setActivePanel(null);
              }}
              disabled={duplicateDatabaseMutation.isPending}
            >
              데이터베이스 복제
            </DropdownItem>
          )}
        </DropdownPanel>
      )}

      {/* Properties panel */}
      {activePanel === "properties" && (
        <DropdownPanel style={{ right: 48 }} width={240}>
          <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            속성 표시
          </div>
          {properties.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
              style={{ color: "var(--text-primary)" }}
            >
              <input
                type="checkbox"
                checked={p.isVisible}
                onChange={() => handleTogglePropertyVisibility(p.id, p.isVisible)}
                className="h-3.5 w-3.5 rounded accent-[#2383e2]"
              />
              <span className="opacity-50 text-xs">{propertyTypeIcon(p.type)}</span>
              <span className="truncate text-[13px]">{p.name}</span>
            </label>
          ))}
        </DropdownPanel>
      )}

      {/* Row height panel */}
      {activePanel === "rowHeight" && (
        <DropdownPanel style={{ right: 48 }} width={180}>
          {ROW_HEIGHT_OPTIONS.map((opt) => (
            <DropdownItem
              key={opt.value}
              onClick={() => handleRowHeightChange(opt.value)}
              active={currentRowHeight === opt.value}
            >
              {opt.label}
            </DropdownItem>
          ))}
        </DropdownPanel>
      )}

      {/* Lock panel */}
      {activePanel === "lock" && (
        <DropdownPanel style={{ right: 48 }} width={240}>
          {LOCK_OPTIONS.map((opt) => (
            <DropdownItem
              key={opt.value}
              onClick={() => handleLockChange(opt.value)}
              active={currentLockLevel === opt.value}
            >
              <div>
                <div className="text-[13px]">{opt.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{opt.desc}</div>
              </div>
            </DropdownItem>
          ))}
        </DropdownPanel>
      )}

      {/* New view panel */}
      {activePanel === "newView" && (
        <DropdownPanel style={{ right: 0 }} width={200}>
          <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            뷰 추가
          </div>
          {VIEW_TYPE_OPTIONS.map((opt) => (
            <DropdownItem key={opt.type} onClick={() => handleAddView(opt.type)} icon={opt.icon}>
              {opt.label}
            </DropdownItem>
          ))}
        </DropdownPanel>
      )}

      {/* CSV Preview Modal */}
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
              CSV 미리보기
            </h3>
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    {csvPreview.headers.map((h, i) => (
                      <th key={i} className="border px-2 py-1 text-left font-medium"
                        style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
                        <div>{h}</div>
                        <div className="font-normal opacity-60">{i === 0 ? "title" : csvPreview.propertyTypes[h] || "text"}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.rows.slice(0, 5).map((row, ri) => (
                    <tr key={ri}>
                      {csvPreview.headers.map((_, ci) => (
                        <td key={ci} className="border px-2 py-1"
                          style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}>
                          {row[ci] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {csvPreview.rows.length > 5 && (
                <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  ... 외 {csvPreview.rows.length - 5}개 행
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCsvPreview(null)}
                className="rounded px-3 py-1.5 text-xs font-medium hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-secondary)" }}
              >
                취소
              </button>
              <button
                onClick={handleCSVImport}
                disabled={importCSVMutation.isPending}
                className="rounded px-3 py-1.5 text-xs font-medium text-white transition-colors"
                style={{ backgroundColor: "#2383e2" }}
              >
                {importCSVMutation.isPending ? "가져오는 중..." : `가져오기 (${csvPreview.rows.length}행)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reusable Toolbar Components ────────────────────────────

function ToolbarButton({
  icon,
  label,
  badge,
  active,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label?: string;
  badge?: number;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
      style={{
        color: active ? "#2383e2" : "var(--text-secondary)",
        backgroundColor: active ? "rgba(35,131,226,0.06)" : undefined,
      }}
    >
      {icon}
      {label && <span>{label}</span>}
      {badge != null && badge > 0 && (
        <span
          className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
          style={{ backgroundColor: "#2383e2" }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function DropdownPanel({
  children,
  style,
  width = 200,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
  width?: number;
}) {
  return (
    <div
      className="absolute top-full z-50 mt-0.5 rounded-lg py-1 shadow-lg"
      style={{
        backgroundColor: "var(--bg-primary)",
        border: "1px solid var(--border-default)",
        width,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function DropdownItem({
  children,
  onClick,
  icon,
  suffix,
  active,
  danger,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  suffix?: ReactNode;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
      style={{
        color: danger ? "#eb5757" : active ? "#2383e2" : "var(--text-primary)",
      }}
    >
      {icon && <span className="shrink-0" style={{ color: "var(--text-tertiary)" }}>{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {active && <span className="text-[#2383e2] text-xs">&#10003;</span>}
      {suffix && <span className="shrink-0 ml-auto">{suffix}</span>}
    </button>
  );
}

function DropdownDivider() {
  return <div className="my-1 mx-2" style={{ height: 1, backgroundColor: "var(--border-default)" }} />;
}
