# SP-5: Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Notion's database system — inline/full-page databases with properties, 6 view types (table, board, timeline, calendar, gallery, list), filtering, sorting, and grouping.

**Architecture:** Database = special Page with a linked Database record. Each database has Properties (columns), Views (display configurations), and Rows (each row = a Page). tRPC router handles all CRUD. Views are rendered by dedicated React components. Filter/sort/group logic runs client-side for responsiveness, with server-side query support for large datasets.

**Tech Stack:** Prisma (Database/Property/View/Row models), tRPC (database router), React (view components), Zustand (active view state), date-fns (date handling)

---

## File Structure

```
prisma/
└── schema.prisma                        # Add: Database, Property, View, Row models
src/
├── types/
│   └── database.ts                      # Database types, property types, view types, filter types
├── server/routers/
│   └── database.ts                      # Database tRPC router (CRUD for DB, properties, views, rows)
├── components/database/
│   ├── database-view.tsx                # Main wrapper: renders active view + view tabs + toolbar
│   ├── database-toolbar.tsx             # Filter/sort/group controls bar
│   ├── database-filter.tsx              # Filter builder UI
│   ├── database-sort.tsx                # Sort configuration UI
│   ├── property-editor.tsx              # Property name/type editor popover
│   ├── cell-renderer.tsx                # Renders cell value by property type
│   ├── cell-editor.tsx                  # Edit cell value by property type
│   ├── views/
│   │   ├── table-view.tsx              # Spreadsheet view
│   │   ├── board-view.tsx              # Kanban board view
│   │   ├── list-view.tsx               # Simple list view
│   │   ├── gallery-view.tsx            # Card grid view
│   │   ├── calendar-view.tsx           # Monthly calendar view
│   │   └── timeline-view.tsx           # Gantt-style timeline view
│   └── new-database.tsx                # Create database dialog
├── stores/
│   └── database.ts                      # Active view, filter/sort state
├── lib/
│   └── database/
│       ├── filter-engine.ts            # Client-side filter logic
│       └── sort-engine.ts              # Client-side sort logic
tests/
└── server/routers/
    └── database.test.ts                # Database router tests
```

---

## Task 1: Prisma Schema + Types

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/types/database.ts`

- [ ] **Step 1: Add Database models to Prisma**

Add to `prisma/schema.prisma`:

```prisma
model Database {
  id          String   @id @default(cuid())
  pageId      String   @unique
  isInline    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  page       Page       @relation(fields: [pageId], references: [id], onDelete: Cascade)
  properties Property[]
  views      DatabaseView[]
  rows       Row[]

  @@index([pageId])
}

model Property {
  id         String  @id @default(cuid())
  databaseId String
  name       String
  type       String
  config     Json    @default("{}")
  position   Int     @default(0)
  isVisible  Boolean @default(true)

  database Database @relation(fields: [databaseId], references: [id], onDelete: Cascade)

  @@index([databaseId])
  @@index([databaseId, position])
}

model DatabaseView {
  id         String @id @default(cuid())
  databaseId String
  name       String
  type       String
  config     Json   @default("{}")
  position   Int    @default(0)

  database Database @relation(fields: [databaseId], references: [id], onDelete: Cascade)

  @@index([databaseId])
}

model Row {
  id         String   @id @default(cuid())
  databaseId String
  pageId     String   @unique
  values     Json     @default("{}")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  database Database @relation(fields: [databaseId], references: [id], onDelete: Cascade)
  page     Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@index([databaseId])
  @@index([pageId])
}
```

Add to Page model: `database Database?` and `row Row?` relations.

Run: `pnpm prisma generate && pnpm prisma db push`

- [ ] **Step 2: Create database types**

`src/types/database.ts`:

```typescript
export type PropertyType =
  | "title" | "text" | "number" | "select" | "multi_select"
  | "date" | "person" | "files" | "checkbox" | "url"
  | "email" | "phone" | "formula" | "relation" | "rollup"
  | "created_time" | "created_by" | "last_edited_time" | "last_edited_by" | "status";

export type ViewType = "table" | "board" | "timeline" | "calendar" | "gallery" | "list";

export type SelectOption = { id: string; name: string; color: string };

export type PropertyConfig = {
  options?: SelectOption[];       // select, multi_select, status
  numberFormat?: "number" | "percent" | "currency";
  dateFormat?: "relative" | "full" | "short";
  formula?: string;               // formula
  relationDbId?: string;           // relation
  rollupPropertyId?: string;       // rollup
  rollupFunction?: "count" | "sum" | "average" | "min" | "max";
};

export type FilterOperator =
  | "equals" | "not_equals" | "contains" | "not_contains"
  | "starts_with" | "ends_with"
  | "is_empty" | "is_not_empty"
  | "greater_than" | "less_than"
  | "before" | "after" | "on_or_before" | "on_or_after";

export type FilterCondition = {
  propertyId: string;
  operator: FilterOperator;
  value?: string | number | boolean | string[];
};

export type FilterGroup = {
  operator: "and" | "or";
  conditions: FilterCondition[];
};

export type SortRule = {
  propertyId: string;
  direction: "asc" | "desc";
};

export type GroupRule = {
  propertyId: string;
};

export type ViewConfig = {
  filters?: FilterGroup;
  sorts?: SortRule[];
  group?: GroupRule;
  columnWidths?: Record<string, number>;   // table
  hiddenProperties?: string[];
  coverProperty?: string;                  // gallery
  cardSize?: "small" | "medium" | "large"; // gallery
  boardGroupBy?: string;                   // board — propertyId
  timelineProperty?: string;               // timeline — date propertyId
  timelineEndProperty?: string;            // timeline — end date
  calendarProperty?: string;               // calendar — date propertyId
};

export type RowData = {
  id: string;
  databaseId: string;
  pageId: string;
  values: Record<string, unknown>;
  page: { id: string; title: string; icon: string | null };
  createdAt: string;
  updatedAt: string;
};

export type DatabaseData = {
  id: string;
  pageId: string;
  isInline: boolean;
  properties: {
    id: string;
    name: string;
    type: PropertyType;
    config: PropertyConfig;
    position: number;
    isVisible: boolean;
  }[];
  views: {
    id: string;
    name: string;
    type: ViewType;
    config: ViewConfig;
    position: number;
  }[];
};
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma src/types/database.ts
git commit -m "feat(sp5): add Database, Property, View, Row models and types"
```

---

## Task 2: Database tRPC Router

**Files:**
- Create: `src/server/routers/database.ts`, `tests/server/routers/database.test.ts`
- Modify: `src/server/trpc/router.ts`

- [ ] **Step 1: Write tests**

Create `tests/server/routers/database.test.ts` with tests for:
- create database (linked to page)
- get database with properties/views/rows
- add/update/delete property
- add/update/delete view
- add/update/delete row
- query rows with filter/sort

- [ ] **Step 2: Implement database router**

`src/server/routers/database.ts` — comprehensive router with procedures:
- `create` — create database + default "Title" property + default table view
- `get` — get database with properties, views, rows (with row pages)
- `addProperty` — add property with auto-position
- `updateProperty` — update property name/type/config/visibility
- `deleteProperty` — remove property
- `reorderProperties` — batch reorder
- `addView` — add view with type + default config
- `updateView` — update view config (filters, sorts, groups, column widths)
- `deleteView` — remove view
- `addRow` — create row (creates a page for it) with initial values
- `updateRow` — update row values
- `deleteRow` — delete row + its page
- `queryRows` — server-side filtered/sorted query

Register in root router.

- [ ] **Step 3: Run tests and commit**

```bash
pnpm test tests/server/routers/database.test.ts
git commit -m "feat(sp5): add database tRPC router with full CRUD for DB, properties, views, rows"
```

---

## Task 3: Filter & Sort Engine

**Files:**
- Create: `src/lib/database/filter-engine.ts`, `src/lib/database/sort-engine.ts`

- [ ] **Step 1: Implement filter engine**

Client-side filter logic that takes rows + FilterGroup and returns matching rows. Supports all operators for text, number, date, select, checkbox, etc.

- [ ] **Step 2: Implement sort engine**

Client-side multi-column sort. Handles different property types (text → localeCompare, number → numeric, date → chronological, checkbox → boolean).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(sp5): add client-side filter and sort engines"
```

---

## Task 4: Database Store + Main View Component

**Files:**
- Create: `src/stores/database.ts`, `src/components/database/database-view.tsx`, `src/components/database/database-toolbar.tsx`

- [ ] **Step 1: Create database store**

Zustand store for active view ID, local filter/sort/group overrides.

- [ ] **Step 2: Create database view wrapper**

Main component that fetches database via tRPC, renders view tabs, toolbar, and delegates to the active view component (table/board/etc).

- [ ] **Step 3: Create toolbar**

Filter/sort/group buttons with dropdown menus. "New view" button.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(sp5): add database store, view wrapper, and toolbar"
```

---

## Task 5: Cell Renderer & Editor

**Files:**
- Create: `src/components/database/cell-renderer.tsx`, `src/components/database/cell-editor.tsx`, `src/components/database/property-editor.tsx`

- [ ] **Step 1: Cell renderer** — displays values by property type (text, number, select badge, date, checkbox, url link, person avatar, etc.)

- [ ] **Step 2: Cell editor** — edit UI by property type (text input, number input, select dropdown with color options, date picker, checkbox toggle, etc.)

- [ ] **Step 3: Property editor** — popover to edit property name, change type, configure options (select colors), delete property.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(sp5): add cell renderer, cell editor, and property editor"
```

---

## Task 6: Table View

**Files:**
- Create: `src/components/database/views/table-view.tsx`

- [ ] **Step 1: Implement table view**

Spreadsheet-style grid with:
- Columns from properties (with header showing name + type icon)
- Column resize via drag
- Rows with editable cells (using cell-editor)
- "+" column button to add property
- "+" row button to add row
- Row click opens page
- Sticky header row

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(sp5): add table view with column resize, editable cells"
```

---

## Task 7: Board (Kanban) View

**Files:**
- Create: `src/components/database/views/board-view.tsx`

- [ ] **Step 1: Implement board view**

Kanban columns grouped by select/status property:
- Each column = one option value
- Cards show title + configured visible properties
- Drag cards between columns (updates the groupBy property value)
- "+" button at bottom of each column to add row
- "No status" column for rows without a value

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(sp5): add board (kanban) view with drag between columns"
```

---

## Task 8: List + Gallery Views

**Files:**
- Create: `src/components/database/views/list-view.tsx`, `src/components/database/views/gallery-view.tsx`

- [ ] **Step 1: List view** — simple rows with title + a few visible properties. Click to open page.

- [ ] **Step 2: Gallery view** — card grid (3 columns). Each card shows cover image (from configured property), title, and visible properties. Click to open page.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(sp5): add list and gallery views"
```

---

## Task 9: Calendar + Timeline Views

**Files:**
- Create: `src/components/database/views/calendar-view.tsx`, `src/components/database/views/timeline-view.tsx`

- [ ] **Step 1: Install date-fns**

```bash
pnpm add date-fns
```

- [ ] **Step 2: Calendar view** — month grid showing rows on their date. Navigate months. Click date to add row. Click row to open page.

- [ ] **Step 3: Timeline view** — horizontal scrolling timeline. Rows as bars positioned by date property. Drag to resize duration.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(sp5): add calendar and timeline views"
```

---

## Task 10: Filter & Sort UI

**Files:**
- Create: `src/components/database/database-filter.tsx`, `src/components/database/database-sort.tsx`

- [ ] **Step 1: Filter UI** — add/remove filter conditions, property dropdown, operator dropdown, value input. Support AND/OR grouping. Saves to view config.

- [ ] **Step 2: Sort UI** — add/remove sort rules, property dropdown, asc/desc toggle. Multiple sorts.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(sp5): add filter and sort configuration UI"
```

---

## Task 11: Database Block in Editor + New Database

**Files:**
- Create: `src/components/database/new-database.tsx`
- Modify: `src/components/editor/slash-command/slash-items.ts`

- [ ] **Step 1: New database dialog** — creates a database (inline or full-page) with a name and default properties.

- [ ] **Step 2: Add slash commands** — "데이터베이스 - 인라인", "데이터베이스 - 풀페이지" entries in slash-items.ts.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(sp5): add database creation and slash command integration"
```

---

## Task 12: Final Integration & Build

- [ ] **Step 1: Run all tests** — `pnpm test`
- [ ] **Step 2: Run build** — `pnpm build`
- [ ] **Step 3: Final commit**

```bash
git commit -m "chore(sp5): database system complete — 6 views, properties, filter/sort, inline/fullpage"
```
