// ── Property Types ──────────────────────────────────────────

export type PropertyType =
  | "title"
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "date"
  | "person"
  | "file"
  | "checkbox"
  | "url"
  | "email"
  | "phone"
  | "formula"
  | "relation"
  | "rollup"
  | "created_time"
  | "created_by"
  | "last_edited_time"
  | "last_edited_by"
  | "status";

// ── View Types ─────────────────────────────────────────────

export type ViewType =
  | "table"
  | "board"
  | "list"
  | "gallery"
  | "calendar"
  | "timeline";

// ── Select Option ──────────────────────────────────────────

export type SelectOption = {
  id: string;
  name: string;
  color: string;
};

// ── Property Config ────────────────────────────────────────

export type PropertyConfig = {
  // select / multi_select / status
  options?: SelectOption[];
  // number
  numberFormat?: "number" | "percent" | "dollar" | "euro" | "won" | "yen" | "pound";
  // formula
  formula?: string;
  // relation
  relatedDatabaseId?: string;
  relationDbId?: string;  // alias used by cell editors
  // rollup
  relationPropertyId?: string;    // which relation property to use
  targetPropertyId?: string;      // which property from target DB to aggregate
  rollupPropertyId?: string;
  rollupFunction?: "count" | "sum" | "average" | "min" | "max" | "show_original";
  // date
  dateFormat?: "full" | "short" | "relative";
  includeTime?: boolean;
  // status
  statusGroups?: {
    name: string;
    color: string;
    optionIds: string[];
  }[];
};

// ── Filter ─────────────────────────────────────────────────

export type FilterOperator =
  | "equals"
  | "does_not_equal"
  | "contains"
  | "does_not_contain"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal"
  | "before"
  | "after"
  | "on_or_before"
  | "on_or_after";

export type FilterCondition = {
  id?: string;
  propertyId: string;
  operator: FilterOperator;
  value?: string | number | boolean | string[];
};

export type FilterGroup = {
  operator: "and" | "or";
  conditions: (FilterCondition | FilterGroup)[];
};

// ── Sort ───────────────────────────────────────────────────

export type SortRule = {
  propertyId: string;
  direction: "asc" | "desc";
};

// ── Group ──────────────────────────────────────────────────

export type GroupRule = {
  propertyId: string;
  hidden?: string[];   // hidden group values
  sort?: "asc" | "desc" | "manual";
};

// ── View Config ────────────────────────────────────────────

export type RowHeight = "short" | "medium" | "tall" | "auto";

export type AggregationFunction = "none" | "count" | "sum" | "average" | "min" | "max";

export type DatabaseLockLevel = "none" | "structure" | "full";

export type ViewConfig = {
  filter?: FilterGroup;
  sorts?: SortRule[];
  group?: GroupRule;
  visibleProperties?: string[];   // ordered property IDs
  propertyWidths?: Record<string, number>;
  // board-specific
  boardGroupBy?: string;           // property ID for board columns
  // calendar-specific
  calendarDateProperty?: string;   // property ID for date
  // gallery-specific
  galleryCardSize?: "small" | "medium" | "large";
  galleryCoverProperty?: string;   // property ID or "__cover"
  // timeline-specific
  timelineStartProperty?: string;
  timelineEndProperty?: string;
  // wrap cells
  wrapCells?: boolean;
  // row height
  rowHeight?: RowHeight;
  // per-column summary aggregation
  columnAggregations?: Record<string, AggregationFunction>;
  // database lock
  lockLevel?: DatabaseLockLevel;
};

// ── Row Data ───────────────────────────────────────────────

export type RowData = {
  id: string;
  databaseId: string;
  pageId: string;
  values: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  page?: {
    id: string;
    title: string;
    icon: string | null;
  };
};

// ── Database Data ──────────────────────────────────────────

export type DatabaseData = {
  id: string;
  pageId: string;
  isInline: boolean;
  createdAt: Date;
  updatedAt: Date;
  properties: {
    id: string;
    databaseId: string;
    name: string;
    type: PropertyType;
    config: PropertyConfig;
    position: number;
    isVisible: boolean;
  }[];
  views: {
    id: string;
    databaseId: string;
    name: string;
    type: ViewType;
    config: ViewConfig;
    position: number;
  }[];
  rows: RowData[];
};
