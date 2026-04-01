# Notion Web v2 — Comprehensive Feature Design Spec

**Date:** 2026-04-01
**Author:** joungminsung + Claude
**Status:** Approved
**Target:** Production-grade Notion replacement with collaboration focus
**Target Users:** Individuals + Small teams (2-10) + Medium organizations (10-50)

---

## Release Strategy

4-Phase incremental release. Each Phase is independently deployable.

| Phase | Focus | Priority |
|-------|-------|----------|
| Phase 1 | Editor UX + Mobile | UX bugs first |
| Phase 2 | Templates/Dashboard + Collaboration | Feature gaps |
| Phase 3 | Project Management + Automation | Collaboration |
| Phase 4 | MCP/Webhooks/Integrations | Extensibility |

---

# Phase 1: Editor UX + Mobile Foundation

## 1-1. Drag Handle System Redesign

### 1-1-A. State Machine Visibility Control

**Root cause:** Two independent timers (`showTimeoutRef`, `hideTimeoutRef`) race asynchronously; `position` dropping to `null` unmounts component instantly.

**Solution — 4-state machine:**
```
HIDDEN ──(mouseenter block)──> APPEARING ──(150ms)──> VISIBLE
  ^                                                       |
  └──(150ms)── DISAPPEARING <──(mouseleave block)────────┘
```

- `HIDDEN`: opacity 0, pointer-events none, stays in DOM (no unmount)
- `APPEARING`: opacity 0->1 transition, moves to VISIBLE after 150ms
- `VISIBLE`: opacity 1, pointer-events auto, all interactions enabled
- `DISAPPEARING`: opacity 1->0 transition, moves to HIDDEN after 150ms
- Mouse over handle itself: DISAPPEARING -> VISIBLE immediately (handle hover protection)
- During drag: state transitions locked (stays VISIBLE)

**Implementation:**
- `useReducer` for state machine (`state`, `dispatch`)
- Single `transitionTimeoutRef` only (eliminates timer conflicts)
- Separate `onMouseEnter`/`onMouseLeave` on `handleRef` to cancel disappear

### 1-1-B. Dynamic Position Engine

**Problem:** Fixed `editorRect.left - 44px`, breaks on sidebar resize/zoom

**Solution:**
- `ResizeObserver` on editor container -> auto-update `editorBounds`
- Handle X: `blockElement.getBoundingClientRect().left - handleWidth - gap`
  - handleWidth: 28px, gap: 8px
- Handle Y: `blockElement.getBoundingClientRect().top + (blockHeight / 2) - (handleHeight / 2)`
  - If block taller than viewport: pin to center of visible area
- Scroll correction: `IntersectionObserver` for block visibility, skip offscreen handles
- Zoom support: factor in `window.visualViewport` scale

### 1-1-C. Nested Block Handle Support

**Problem:** `$pos.before(1)` only checks depth 1, ignores blocks inside toggles/columns/tables

**Solution — `resolveBlockAtPoint(view, event)` helper:**
1. event coords -> `view.posAtCoords()` -> ProseMirror position
2. `doc.resolve(pos)` -> ResolvedPos
3. Walk depth 1 to maxDepth, find deepest block-level node
4. Return that node's start position

- Depth indicator: thin vertical line left of handle for depth 2+
- Double-click handle: select parent block (entire toggle, entire column list)
- Supported nesting: toggle > paragraph, columnList > column > block, table > row > cell > block, blockquote > block

### 1-1-D. Handle Interaction Expansion

**Current:** Click (menu), + button (new block)

**Additions:**
- Hover zone: 60px left of block (desktop), long-press entire block (mobile)
- Handle click -> context menu:
  - Delete (Cmd+Shift+D)
  - Duplicate (Cmd+D)
  - Turn into (submenu)
  - Move to (page search)
  - Copy link (anchor link)
  - Comment
  - Separator
  - Color (background/text, 8 presets + transparent)
- + button improvements:
  - Click: insert empty paragraph below + focus
  - Drag: drag down to choose insertion point
  - Shift+click: open slash command menu immediately

### 1-1-E. Drag & Drop Physics Improvements

- **Drop indicator:** 2px line (#2383e2) + 6px circle dots on ends, snaps to nearest block boundary
- **Nested drop:** hover 300ms over toggle/column -> show internal drop zone highlight
- **Auto-scroll:** start at 80px from edges, acceleration proportional to distance (0px=8px/frame, 80px=1px/frame), smooth ease-out deceleration
- **Drag preview:** block content snapshot (opacity 0.7, max 300px width), multi-block shows "N blocks" text
- **Invalid drop zones:** self-inside, child-inside -> red prohibition icon + red indicator

---

## 1-2. Block Selection System Rebuild

### 1-2-A. Selection Visuals

| State | Background (Light) | Background (Dark) | Left Border | Transition |
|-------|-------------------|-------------------|-------------|------------|
| Unselected | transparent | transparent | none | — |
| Hover | rgba(55,53,47,0.03) | rgba(255,255,255,0.03) | none | 80ms ease |
| Selected | rgba(35,131,226,0.08) | rgba(35,131,226,0.15) | 3px solid #2383e2 | 150ms ease |
| Selected+Hover | rgba(35,131,226,0.12) | rgba(35,131,226,0.20) | 3px solid #2383e2 | 80ms ease |
| Dragging (source) | rgba(35,131,226,0.05) | rgba(35,131,226,0.08) | 3px dashed #2383e2 | none |

Additional: border-radius 2px on left border, consecutive blocks connect borders (no gap), subtle box-shadow on selection area top/bottom

### 1-2-B. Selection Methods

**1) Click selection:**
- Handle click -> single block select
- Shift+handle click -> range from anchor to clicked
- Cmd/Ctrl+handle click -> toggle non-contiguous multi-select

**2) Drag selection (Lasso):**
- Mousedown in editor margin (left gutter) -> rectangle lasso
- Lasso overlapping block bounding boxes -> add to selection
- Lasso visual: `border: 1px solid #2383e2`, `background: rgba(35,131,226,0.04)`
- Auto-scroll during drag (reuse drag handle logic)
- Shift+drag: add to existing, Cmd/Ctrl+drag: XOR

**3) Keyboard selection:**
- Cmd+A once: select all text in current block
- Cmd+A twice: select all blocks
- Shift+Up/Down during block selection: extend
- Escape: deselect
- Shift+Cmd+Up: select to document start
- Shift+Cmd+Down: select to document end

**4) Nested block rules:**
- Parent selected -> children auto-included
- Child selected then Shift+click parent -> expand to full parent
- Toggle collapsed + selected -> hidden children included

### 1-2-C. Selection Action Toolbar

2+ blocks selected -> floating action bar at editor top center:

```
┌─────────────────────────────────────────────────────┐
| 3 blocks selected | Turn into v | Color v | Trash | ... |
└─────────────────────────────────────────────────────┘
```

- position: sticky, top: 0, z-index: 50
- Turn into: bulk convert (paragraph, h1-h3, bullet, numbered, todo, toggle, callout, quote)
- Color: 8 presets (Default, Gray, Brown, Orange, Yellow, Green, Blue, Purple), background/text separate, live preview on hover
- Delete: instant (Cmd+Z to restore)
- More: Duplicate, Move to, Copy link, Create synced block

### 1-2-D. Selection Clipboard

**Copy (Cmd+C):**
- Plain text: block text content joined by newlines
- HTML: full formatting via DOMSerializer (bold, italic, code, color, lists, code block lang, images)
- Internal format: JSON block structure as `application/x-notion-blocks` MIME type

**Cut (Cmd+X):** Copy + delete (in undo history)

**Paste (Cmd+V):**
- Internal format detected -> insert block structure as-is
- HTML detected -> parse to blocks (extend markdown-paste.ts)
- Plain text -> paragraph blocks

---

## 1-3. Icon System Overhaul

### 1-3-A. UnifiedIcon Component

```
Props:
  type: 'emoji' | 'lucide' | 'custom'
  value: string          // emoji char, lucide icon name, or image URL
  color?: string         // lucide icon color (10 presets)
  size?: 'sm' | 'md' | 'lg' | 'xl'  // 14px, 18px, 24px, 32px
  className?: string
```

### 1-3-B. Icon Picker Redesign

**3-tab structure:**

**Tab 1 — Emoji:**
- Categories: Smileys & People, Animals & Nature, Food & Drink, Activities, Travel, Objects, Symbols, Flags
- Search: real-time filter, Korean/English keywords
- Skin tone: 5 levels
- Recent: top-pinned, max 32, localStorage
- Grid: 8 columns, virtual scroll (@tanstack/react-virtual)

**Tab 2 — Icons (lucide-react):**
- Categories: General, Arrows, Communication, Design, Development, Devices, Files, Layout, Math, Media, Navigation, Shapes, Text, Weather
- Search: icon name + tag search
- Color: 10 preset palette (Default, Gray, Brown, Orange, Yellow, Green, Blue, Purple, Pink, Red)
- Grid: 10 columns, virtual scroll
- ~200 prioritized icons visible, full catalog via search

**Tab 3 — Custom:**
- Image upload (PNG, JPG, SVG, WebP), max 256KB
- Auto-resize: 128x128px
- Square crop UI
- URL input support
- Recent 5 uploads shown

**Picker UI:** 340px x 420px, tab bar + search + grid + "Remove" button + preview

### 1-3-C. Full Replacement Map

| File | Location | Current | Replacement |
|------|----------|---------|-------------|
| topbar.tsx | Menu items (11 places) | Emoji strings | `<UnifiedIcon type="lucide">` |
| drag-handle.tsx | Handle icon | `"..."` text | GripVertical |
| drag-handle.tsx | + button | `"+"` text | Plus |
| page-template-picker.tsx | Template icons (5) | Emoji | UnifiedIcon |
| slash-items.tsx | Slash menu | Emoji strings | lucide icons |
| sidebar.tsx | New page menu | Emoji | lucide icons |
| sidebar-page-item.tsx | Default page icon | `"..."` | FileText |
| block-menu.tsx | Block menu items | Emoji | lucide icons |
| block-context-menu.tsx | Context menu | Emoji | lucide icons |
| command-palette.tsx | Search results | Emoji | UnifiedIcon |
| database-toolbar.tsx | View icons | Emoji | lucide icons |

---

## 1-4. Mobile Responsive Design

### 1-4-A. Responsive Architecture

**Breakpoints:**
- Mobile: 0-767px
- Tablet: 768-1023px
- Desktop: 1024-1439px
- Wide: 1440px+

**Detection:** Tailwind classes (sm/md/lg/xl) + `useMediaQuery` hook (isMobile/isTablet/isDesktop) + `<ResponsiveProvider>` context

### 1-4-B. Mobile Layout (< 768px)

**Sidebar:** Hidden by default, hamburger toggle, slide-over (85vw, max 320px), dimmed overlay, swipe to close, auto-close on page select

**Topbar:** `[hamburger] [Page Title (truncated)] [...]` — breadcrumbs/presence/actions hidden, all in "more" menu

**Editor:**
- Padding: 16px (from 96px)
- Block gap: 8px (from 4px)
- Images: max-width 100%, tap for fullscreen
- Code: horizontal scroll, 13px font
- Tables: horizontal scroll wrapper, optional fixed first column
- Columns: auto-stack to single column
- Embeds: aspect-ratio 16/9

**Mobile Editor Toolbar (bottom fixed):**
```
| B  I  S  H1v  *  checkbox  /  @  +  keyboard |
```
Fixed above keyboard (iOS safe-area), horizontal scroll, hide on blur

### 1-4-C. Tablet Layout (768-1023px)

- Sidebar: collapsed mode default (icons only, 48px), hover/click to expand overlay
- Topbar: last 2 breadcrumbs, 3 avatars, share + more
- Editor: 48px padding, 2 columns max (3+ stacks)

### 1-4-D. Touch Gesture System

| Gesture | Area | Action |
|---------|------|--------|
| Swipe right (edge) | Left 20px | Open sidebar |
| Swipe left | Over sidebar | Close sidebar |
| Long-press (500ms) | Over block | Block context menu |
| Long-press + drag | Over block | Move block |
| Double-tap | Over block | Select all text |
| Pinch zoom | Editor | Zoom in read mode |
| Swipe left | Page | Navigate back |
| Pull down | Page top | Refresh (PWA) |

Implementation: touch events, direction vector + velocity + duration, swipe threshold 50px/0.3 velocity, long-press 500ms with 10px cancel, passive listeners

### 1-4-E. Mobile-Specific Components

**Bottom Sheet:** For slash commands, block menus, context menus. 3 heights: peek (30vh), half (50vh), full (90vh). Drag to resize, pull down to dismiss. Snap points, dimmed overlay, contained scroll.

**Mobile Navigation (optional):**
```
| Home | Search | + New |
```
Bottom tab bar, or sidebar + swipe only (configurable in settings)

---

## 1-5. Editor Micro UX

### 1-5-A. Block Type Conversion

**Turn Into menu:** TEXT (paragraph, h1-h3), LIST (bullet, numbered, todo), OTHER (toggle, callout, quote, code)

**Conversion rules:**
- paragraph <-> heading: text preserved, inline formatting preserved
- paragraph -> list: each line -> list item
- list -> paragraph: each item -> paragraph
- anything -> code: strip all inline formatting
- code -> paragraph: each line -> paragraph
- anything -> callout: wrap content inside
- anything -> toggle: content becomes summary, empty interior

All conversions as single transaction (1 undo). Multi-select: batch apply.

### 1-5-B. Multi-Column Drag Creation

- Trigger: drag block to right 1/3 of existing block
- Drop indicator changes to vertical line (split preview)
- Creates columnList with existing block in left column, dragged block in right
- Default ratio 1:1, drop on existing column adds new column (max 5)
- Column resizer: 4px handle, cursor col-resize, drag to adjust (min 120px), double-click resets to equal
- Mobile: resizer hidden, auto-stack

### 1-5-C. Empty Page Guide

New page shows: title, "Press Enter to start writing, or pick a template", 3 recent template buttons + "Browse Templates", slash command hint (first 3 visits only). Fades out on first keystroke or template selection.

### 1-5-D. Keyboard Shortcuts Expansion

| Shortcut | Action | Context |
|----------|--------|---------|
| Cmd+D | Duplicate block | Editor |
| Cmd+Shift+D | Delete block | Editor |
| Cmd+Shift+M | Add comment | Text selected |
| Cmd+Shift+H | Highlight color menu | Text selected |
| Cmd+Shift+Up/Down | Move block up/down | Editor |
| Cmd+Shift+L | Toggle page lock | Anywhere |
| Cmd+\ | Toggle sidebar | Anywhere |
| Cmd+Shift+F | Find/replace | Editor |
| Cmd+Shift+P | Move page | Anywhere |
| Cmd+Shift+O | Recent pages list | Anywhere |
| Cmd+Shift+N | New child page | Anywhere |
| Cmd+Shift+C | Insert code block | Editor |
| Cmd+Shift+T | Insert todo block | Editor |
| Cmd+Shift+1~6 | Convert to heading 1~6 | Editor |
| Alt+drag | Duplicate drag | Drag handle |

Conflict detection: Map of all shortcuts in shortcuts-provider.tsx, warn on collision.

Customization: Settings > Keyboard Shortcuts tab, click to rebind, conflict warning, "Reset to defaults", persist in localStorage + DB sync.

### 1-5-E. Undo/Redo Improvements

- Unified undo stack: editor changes + block moves + block deletes
- Undo units: continuous typing = one unit (500ms pause = new unit), block operations = individual, batch operations = 1 undo restores all
- Optional history visualization: long-press Cmd+Z -> history popup (recent 20 units)

### 1-5-F. Inline Toolbar Expansion

- Formatting: Bold, Italic, Underline, Strikethrough, Code, Link
- Colors: text color dropdown (10), background highlight dropdown (10)
- Extra: inline KaTeX, mention (@), date (@date), comment
- AI: "Ask AI" button
- Separator `|` between groups
- Position: 8px above selection, flip below if no space, clamp within editor
- Mobile: replaced by bottom fixed toolbar

---

# Phase 2: Templates/Dashboard + Collaboration

## 2-1. Template System Redesign

### 2-1-A. Template Data Model

```
Template:
  id            String    @id @default(cuid())
  workspaceId   String
  creatorId     String
  name          String
  description   String?
  icon          Json      // { type, value, color? }
  coverImage    String?
  category      String    // blank/meeting/project/personal/team/database/custom + more
  blocks        Json      // serialized block tree
  properties    Json?     // page properties (fullWidth, smallText, font)
  isPublic      Boolean   @default(false)
  isDefault     Boolean   @default(false)
  usageCount    Int       @default(0)
  tags          String[]
  createdAt     DateTime
  updatedAt     DateTime
```

### 2-1-B. Template Catalog (80 templates, 8 categories x 10)

**Category 1 — Documents (10):**
1. Blank Page
2. Meeting Notes — Agenda + Discussion + Decisions + Action Items
3. Design Document — Context, Goals/Non-Goals (2-col), Solution, Alternatives (toggles), Migration, Open Questions
4. RFC — Summary, Motivation, Detailed Design, API/Data Model changes (code blocks), Drawbacks, Decision Log (table)
5. Post-Mortem — Impact, Timeline (table), Root Cause, What Went Well/Wrong, Action Items (table), Lessons
6. SOP — Purpose, Scope, Prerequisites, Procedure (numbered), Exception Handling (toggles + callouts), Revision History
7. PRD — Problem, User Stories (table), Success Metrics (table), Must/Should/Nice-to-Have (todos), User Flow, Edge Cases, Timeline
8. Changelog / Release Notes — Highlights (callout), New Features (toggles), Improvements, Bug Fixes, Breaking Changes (callout), Migration Guide
9. API Documentation — Endpoint, Headers/Params/Body (tables), Response codes (code blocks), Examples (toggles per language), Rate Limiting
10. Runbook — Prerequisites, Common Procedures (toggles with numbered lists + code + callouts), Troubleshooting (toggles), Monitoring Links, Contact (table)

**Category 2 — Personal (10):**
1. Todo List — Today + This Week + Later + Completed sections
2. Daily Journal — Morning Check-in (Mood/Gratitude/Intentions), End of Day Reflection (Wins/Challenges/Tomorrow)
3. Weekly Review — Goals + Daily Log (toggles Mon-Fri) + Metrics (table) + Retrospective + Next Week
4. Goal Setting (OKR) — 3 Objectives with KRs (todos) + Initiatives + Monthly Check-ins (table)
5. Reading Notes — Book info (callout), Summary, Key Ideas, Favorite Quotes, Applications, Action Items
6. Habit Tracker — database_inline (Habit, Day 1-31 checkboxes, Streak formula, Rate formula) + Monthly Reflection
7. Finance Tracker — database_inline (Item, Date, Category select, Amount, Payment select) with table + board views + Budget Summary
8. Travel Planner — Pre-Trip Checklist, Itinerary (toggles per day with tables), Packing List (2-col), Expenses (database_inline)
9. Meal Planner — database_inline (Meal, Day, Type, Recipe, Prep Time, Calories) with table + board views + Grocery List (2-col)
10. Personal Wiki — Quick Links, Areas (2-col toggles), Inbox (todos), Resources (database_inline)

**Category 3 — Team (10):**
1. Team Home — Members (table), Quick Links (2-col), Current Sprint (database board), Team Norms (toggles), Onboarding Guide
2. Sprint Planning — Sprint Backlog database_inline (12 properties, 3 views: table/board-status/board-assignee), Capacity Planning, Risks, Retro
3. 1:1 Meeting — Standing Agenda, repeatable dated meeting notes section with Action Items
4. Team Retrospective — Check-in, What went well/could improve/puzzles, Previous Action Items review, New Action Items (database_inline), Kudos
5. Onboarding Checklist — Before Day 1, Day 1, Week 1, Week 2-4, 30/60/90 Day Goals (table), Resources
6. Team OKRs — 3 Objectives each with KR database_inline (Target/Current/Progress%/Status), Monthly Check-ins (toggles), Dependencies
7. Standup Notes — database_inline per day (Member, Yesterday, Today, Blockers, Mood), Parking Lot
8. Team Knowledge Base — Getting Started, Architecture (toggles), Processes (toggles with numbered lists), FAQ (toggles), Glossary (table)
9. Decision Log — database_inline (Decision, Date, Category, Status, Context, Alternatives, Outcome) with 3 views
10. Meeting Cadence — database_inline (Meeting, Cadence, Day, Time, Duration, Attendees, Purpose), Meeting Norms, Focus Time Blocks

**Category 4 — Database (10):**
1. Task Board — 12 properties (Status/Priority/Assignee/Due/Estimated/Actual/Labels/Sprint/Created/Blocked_By/Description), 5 views (board-status/board-assignee/table/calendar/timeline)
2. Bug Tracker — 14 properties (Status 7-stage/Severity/Priority/Reporter/Assignee/Component/Environment/Version/Steps/Expected/Actual), 4 views
3. CRM — 15 properties (Company/Contact/Stage 7-stage/Deal Value/Probability/Expected Close/Source/Industry/Last Contact/Next Action), 5 views
4. Content Calendar — 13 properties (Status 7-stage/Type/Platform multi-select/Author/Publish Date/Topic/Keywords), 5 views including calendar
5. Product Roadmap — 14 properties (Status/Quarter/Priority/Effort/Impact/Team/Start-End dates/Dependencies/User Requests/Revenue Impact), 6 views including timeline
6. Hiring Pipeline — 14 properties (Position/Stage 8-stage/Source/Recruiter/Applied Date/Interview Score/Salary/Rejection Reason), 4 views
7. Inventory / Asset Tracker — 13 properties (Category/Status/Serial/Assigned To/Purchase Date-Price/Warranty/Condition), 4 views
8. OKR Tracker — 12 properties (Objective/Owner/Quarter/Target-Current Value/Unit/Progress formula/Confidence/Initiatives), 4 views
9. Meeting Action Items — 10 properties (Meeting/Owner/Status/Priority/Due/Category/Related Page), 4 views including overdue filter
10. Competitive Analysis — 12 properties (Category/Pricing/Target Market/Key Features multi-select/Strengths/Weaknesses/Market Share/Threat Level), 3 views including gallery

**Category 5 — Project Management (10):**
1. Project Brief — Overview (callout), Goals & Metrics (table), Scope In/Out, Stakeholders (RACI table), Timeline (database timeline), Risks (table), Budget (table), Communication Plan
2. Project Status Report — RAG status (callout), Accomplishments, Planned, Risks/Issues (table), Milestones (table), Key Metrics, Blockers (callout), Budget Tracker
3. RACI Matrix — database_inline (Activity, Person1-6 as R/A/C/I select), Role Definitions, Escalation
4. Risk Register — database_inline (12 properties including Risk Score formula, 3 views), Risk Matrix reference
5. Stakeholder Map — database_inline (10 properties including Influence/Interest/Engagement), Engagement Strategy quadrant (table)
6. Work Breakdown Structure — Phase-based with database_inline tables per phase, Summary roll-up table
7. Sprint Velocity Tracker — database_inline (Sprint, Dates, Planned/Completed Points, Velocity, Carried Over), Velocity Trend, Observations
8. Project Handoff — Current State (callout), Key Decisions (table), Open Items (database_inline), Technical Context (toggles), Stakeholder Contacts, Risks/Gotchas
9. Launch Checklist — T-4 weeks / T-2 weeks / T-1 week / Launch Day / T+1 week (todos per phase), Rollback Plan
10. Resource Allocation — database_inline (Person, Team, Role, Project allocations %, Total formula), Project Needs (table), Conflicts (callout)

**Category 6 — Education (10):**
1. Course Notes — Overview, Objectives, Lecture Notes (weekly toggles), Assignments (database_inline), Exam Prep, Resources
2. Research Paper Outline — Abstract through References (full academic structure), Literature database_inline, Writing Progress (todos)
3. Study Plan — Topics database_inline (10 properties), Weekly Schedule (toggles with tables), Practice Tests (table), Study Techniques
4. Vocabulary Builder — database_inline (Word, Translation, Part of Speech, Example, Category, Mastery, Review Date), 4 views including "Review Today" filter
5. Flashcard Set — database_inline (Front, Back, Category, Difficulty, Times Reviewed, Next Review date for spaced repetition), 3 views
6. Book Club — Current Book section, Reading Schedule (table), Discussion Questions, Book List database_inline, Voting table
7. Lesson Plan — Objectives, Materials, Lesson Structure (Opening/Instruction/Practice/Closing with times), Differentiation (table), Assessment, Reflection
8. Thesis Tracker — Timeline database_inline (timeline view), Chapter Outline (toggles with word count), Meeting Log (database_inline), References count, Writing Progress
9. Workshop / Training Plan — Objectives, Agenda database_inline (time-based), Materials Checklist, Activity Details (toggles), Feedback Survey, Post-Workshop
10. Certification Study Tracker — Exam Domains database_inline, Study Resources (table), Practice Exams (table), Weekly Study Log database_inline, Exam Day Checklist

**Category 7 — Business (10):**
1. Business Plan — Executive Summary, Problem/Solution (2-col), Market Analysis (table + competitor database_inline), Business Model (revenue table), Go-to-Market, Team (table), Financial Projections (table), Milestones (database timeline)
2. Marketing Campaign Plan — Target Audience (table), Channel Strategy database_inline, Content Calendar database_inline (calendar view), Budget (table), Success Metrics (table)
3. Competitive Analysis Framework — Market Overview, Competitor database_inline (14 properties, 3 views including gallery), Feature Comparison (table), SWOT (2x2 columns)
4. Investor Update — Metrics callout, Highlights/Lowlights, Key Metrics (table), Product/Team/Financial updates, Asks (callout)
5. Sales Playbook — ICP (table), Value Proposition (callout), Sales Process database_inline, Objection Handling (toggles), Competitor Battlecards (toggles with tables), Email Templates (toggles), Pricing Guide
6. Employee Handbook — Culture (values), Employment Policies (toggles), Compensation (toggles), Code of Conduct, Communication Tools (table), Growth (toggles), IT & Security
7. Customer Feedback Tracker — database_inline (12 properties, 4 views including "High Impact" filter)
8. Event Planning — Timeline database_inline (15 tasks, categorized), Budget (table), Speaker (table), Day-of Checklist (todos), Post-Event (todos)
9. SLA / Service Level Agreement — Service Level Targets database_inline, Exclusions, Responsibilities (2-col), Incident Classification (table), Reporting
10. Vendor Evaluation — Requirements database_inline, Vendor Comparison database_inline (weighted scoring), Demo Notes (toggles), Reference Checks (table), Recommendation

**Category 8 — Engineering (10):**
1. ADR (Architecture Decision Record) — Context, Decision Drivers, Options (toggles with pros/cons), Decision (callout), Consequences (positive/negative/risks)
2. System Design Document — Architecture (code block), Data Model (SQL code block), API Design (toggles per endpoint), Sequence Diagrams, Scaling (table), Security, Monitoring (table), Testing Strategy (table)
3. Incident Response Template — Severity callout, Impact, Live Timeline (table), Current Hypothesis, Actions (todos), Communication (internal/external), Follow-Up database_inline, Post-mortem link
4. On-Call Handbook — Expectations, Alert Playbooks (toggles with diagnosis steps + commands + escalation), Useful Commands (code block), Architecture Reference, Contact List (table), Handoff Template
5. Database Migration Plan — Current/Target Schema (SQL code blocks), Migration Steps, Data Transformation (SQL), Rollback Plan (callout + SQL), Risk Assessment (table), Testing/Execution Checklists (todos), Post-Migration Verification
6. Code Review Checklist — Before Requesting Review (todos), Reviewer Checklist sections: Correctness/Design/Performance/Security/Testing/Readability (todos each), Feedback Norms
7. Load Test Plan — Scenarios database_inline, Test Environment (table), Execution steps, Results (table), Bottlenecks, Recommendations
8. Feature Flag Rollout Plan — Flag config (code block), Rollout Plan database_inline (phased %), Metrics (table), Rollback Plan (callout), Cleanup (todos), Sign-off (table)
9. API Versioning / Deprecation Plan — Changes Summary (table), Migration Guide (code blocks), Timeline (table), Consumer Impact database_inline, Communication Templates (toggles)
10. Tech Debt Register — database_inline (11 properties, 4 views including "Quick Wins" filter), Debt Budget, Review Notes (toggles)

### 2-1-C. Template Gallery UI

- Left sidebar: category filter (All, Documents, Personal, Team, Database, My Templates)
- Top: search bar (name + tags + description, real-time)
- Center: 3-column card grid (desktop), 2 (tablet), 1 (mobile)
- Card: icon (48px) + name + description (2-line clamp) + usage count badge
- Card hover: shadow expand + "Use" / "Preview" buttons
- Modal: 800x600 (desktop), fullscreen (mobile)
- Preview: right panel slide, read-only render, "Use this template" button

### 2-1-D. Custom Template CRUD

**Create:** Page menu > "Save as Template" -> name, description, category, tags, visibility (Only me / Workspace), "Clear content" checkbox
**Edit:** Gallery > My Templates > card menu > "Edit" (metadata or blocks)
**Delete:** Card menu > "Delete" (confirmation modal, system defaults undeletable)
**Duplicate:** Card menu > "Duplicate" -> copied with "(Copy)" suffix

---

## 2-2. Dashboard / Home Page

### 2-2-A. Workspace Home Layout

Replaces empty "Select a page" with dashboard containing:
- Greeting (time-based, localized Korean/English)
- Quick Actions: New Page, New Database, Import, Search
- Recent Pages (8, with actor + time + action)
- Favorites + Assigned Tasks (2-column)
- Recent Activity (10 items, real-time SSE)
- Workspace Stats (pages, databases, members, comments, files, views)

### 2-2-B. Dashboard Widget System

Widgets: Quick Actions, Recent Pages, Favorites, Assigned Tasks, Recent Activity, Workspace Stats, Calendar (upcoming 7 days), Team Online

Customizable: "Customize" button, add/remove toggles, drag reorder, persist in localStorage + DB

---

## 2-3. Real-time Collaboration Enhancement

### 2-3-A. Cursor Tracking

- Cursor label: name + avatar (16px) + background color
- Show on typing (fade-in 200ms), hide after 2s idle (fade-out 500ms), always show on hover
- 8 preset colors per user (consistent)
- Selection highlight: other users' text selections shown in their color (semi-transparent)

### 2-3-B. Inline Comment System

- Create: text drag select -> "Comment" in inline toolbar or Cmd+Shift+M
- Display: yellow highlight on commented text, comment icon badge in right margin
- Thread: replies (flat), emoji reactions (6 fixed), "Resolve" button
- Resolved comments: move to "Resolved" tab in sidebar, reopenable
- Notification: @mention in comment -> notification, reply -> notify all thread participants

### 2-3-C. Suggesting Mode

- Toggle: topbar mode selector `Editing | Suggesting | Viewing`, Cmd+Shift+E
- Suggesting mode: additions shown green+underline, deletions shown red+strikethrough, format changes shown in margin
- Each suggestion can have comment thread
- Management: per-suggestion Accept/Reject buttons, sidebar panel for all suggestions, Accept All / Reject All
- Only page owner + edit permission can Accept/Reject

**Suggestion data model:**
```
Suggestion: id, pageId, userId, type (insert/delete/format/replace), position (from/to), content, status (pending/accepted/rejected), commentId?, createdAt
```

### 2-3-D. Page Lock & Permission Granularity

- Lock levels: unlocked, suggesting_only, locked, template_locked (structure locked, content editable)
- Block-level lock: handle menu > "Lock this block" (lock icon, view/copy only)
- Section editing rights: assign editors per H1/H2 section

### 2-3-E. Version Diff View

- History panel: select 2 versions -> "Compare"
- Side-by-side or inline diff
- Block-level diff: added/deleted/modified blocks highlighted
- Text-level diff: character-level changes highlighted
- Navigate: "Previous/Next change" buttons
- Actions: "Restore this version", "Cherry-pick" specific block versions

---

## 2-4. Notification System Enhancement

### 2-4-A. Notification Types (11)

mention, comment, comment_reply, share, invite, suggestion, suggestion_resolved, task_assigned, task_due, page_updated, permission_changed

### 2-4-B. Notification Preferences

Per-type toggle for In-App and Email. Do Not Disturb mode (time range). Email digest: immediate / hourly / daily.

### 2-4-C. Real-time Delivery

SSE endpoint `/api/notifications/stream`. Client: real-time unread count + toast (bottom-right, 5s, stack 3).

### 2-4-D. Notification Panel UI

Tabs: All / Unread / Mentions / Comments. Groups: Today / Earlier / This Week / Older. Inline reply for comments. Swipe to dismiss (mobile). Type/page filters.

---

## 2-5. Search System Enhancement

### 2-5-A. Command Palette Expansion

Current: page search only. Expanded: Recent, Pages (fuzzy), Blocks (full-text), Databases, Actions (create page, toggle theme, settings). Highlight matching keywords. Block results: 30-char context, click scrolls + 3s yellow highlight. Recent 5 searches saved.

### 2-5-B. Full Search Page

Cmd+Shift+F: full-screen search UI with left filter panel (date range, author, page/database, block type) + right results (infinite scroll) + sort (relevance/date/name).

---

# Phase 3: Project Management + Automation

## 3-1. Project Management Hub

### 3-1-A. Project Data Model

```
Project: id, workspaceId, name, description, icon, coverImage, status (active/paused/completed/archived), startDate, endDate, ownerId, visibility (workspace/team/private), settings, timestamps
ProjectMember: id, projectId, userId, role (owner/admin/member/viewer), joinedAt
ProjectView: id, projectId, name, type (board/table/timeline/calendar/list), config (filters/sorts/grouping/visible fields), isDefault, position
```

### 3-1-B. Project Home Page

Dashboard with: Overview card (status, progress %, dates, members, task count), Task Summary (by status + bar chart), Recent Activity (8 items, SSE), Upcoming Deadlines (7 days), View tabs (Board/Table/Timeline/Calendar/Pages)

### 3-1-C. Task System

```
Task: id, projectId, title, description (rich text JSON), status (backlog/todo/in_progress/in_review/done/cancelled), priority (urgent/high/medium/low), assigneeId, reporterId, dueDate, startDate, estimatedHours, actualHours, labels[], sprintId, parentTaskId (subtasks), position, pageId (linked page), timestamps
TaskComment: id, taskId, userId, content, createdAt
TaskActivity: id, taskId, userId, action, oldValue, newValue, createdAt
```

Task detail side peek: all fields editable, rich text description, subtasks (inline add/check/drag), activity log, comments.

### 3-1-D. Project Views

**Board:** Kanban columns by status, cards with priority/assignee/labels/due, drag between columns = status change, WIP limits, grouping by status/assignee/priority/label/sprint

**Table:** Spreadsheet-style, inline edit, column sort/resize/hide, row selection for bulk actions, frozen title column

**Timeline (Gantt):** X-axis dates (day/week/month zoom), bars for startDate-dueDate, bar drag = date change, bar resize = duration change, dependency arrows (finish-to-start), milestone markers, today line, critical path highlight

**Calendar:** Month/week toggle, dueDate-based, max 3 cards per cell (+N more), drag to change date, click empty cell = new task

**List:** Simple grouped list with checkboxes, inline edit, subtask indentation

### 3-1-E. Sprint Management

```
Sprint: id, projectId, name, goal, startDate, endDate, status (planning/active/completed), velocity, createdAt
```

Planning: drag tasks from backlog to sprint. Active: board view tracking. Complete: incomplete tasks auto-move to next sprint/backlog. Velocity chart: last 6 sprints bar graph. Burndown chart: ideal vs actual line chart (daily update).

---

## 3-2. Automation Engine

### 3-2-A. Architecture

"When [trigger] -> Then [action]" rule-based.

```
Automation: id, workspaceId, name, description, isEnabled, trigger (JSON), conditions (JSON[]), actions (JSON[]), createdBy, lastTriggered, triggerCount, timestamps
AutomationLog: id, automationId, triggeredBy, triggerData, actionsExecuted, status, error, executedAt
```

### 3-2-B. Triggers (14)

page.created, page.updated, page.moved, database.row_created, database.row_updated, database.property_changed, task.status_changed, task.assigned, task.due_approaching, task.overdue, comment.created, member.joined, schedule.cron, webhook.received

### 3-2-C. Conditions

Filter chains (AND/OR). Operators: text (equals/contains/starts_with/ends_with/is_empty), number (eq/gt/gte/lt/lte/between), date (is_before/is_after/is_between/is_within), select (equals/in/not_in), multi-select (contains/not_contains), checkbox (is_true/is_false)

### 3-2-D. Actions (14)

update_property, assign_user, add_label, remove_label, move_to, create_page, create_task, send_notification, send_email, post_comment, call_webhook, duplicate_page, lock_page, archive

Template variables: `{{trigger.user.name}}`, `{{trigger.page.title}}`, `{{trigger.task.title}}`, `{{trigger.oldValue}}`, `{{trigger.newValue}}`, `{{now}}`, `{{now + 7d}}`, `{{workspace.name}}`

### 3-2-E. Automation Builder UI

Visual WHEN/IF/THEN sections with dropdowns, dynamic config forms, multiple actions (max 10, drag reorder), AND/OR toggle for conditions, "Test Run" simulation, execution logs (recent 20).

### 3-2-F. Preset Automations (10)

Task Complete Notification, Overdue Alert, Due Soon Reminder, Auto-assign on Create, Move Done to Archive, Welcome New Member, Bug Critical Notify (webhook), Weekly Status Report (cron), Page Shared Lock, Sprint Complete

---

## 3-3. Workflows (Advanced Automation)

### 3-3-A. Workflow vs Automation

Automation: single trigger -> actions, stateless, no human intervention
Workflow: multi-step, branching, waiting, stateful, approval steps possible

### 3-3-B. Workflow Node Types

Trigger nodes (same as automation + manual.trigger)
Action nodes (same as automation actions)
Control nodes: condition (if/else), wait (duration or until condition), approval (approvers, minApprovals, timeout), parallel (branches), loop (collection + action), delay, end

### 3-3-C. Visual Workflow Editor

Node-based flow editor with left palette (drag nodes), canvas (pan/zoom/minimap), node connections (output port -> input port), right config panel on node click, auto-layout (dagre), execution status per node (pending/running/complete/failed)

### 3-3-D. Preset Workflows (5)

1. Content Approval Flow (create -> assign editor -> wait review -> approval -> publish/reject)
2. New Member Onboarding (join -> create checklist page -> assign -> 7d check-in -> 30d review)
3. Bug Triage (new bug -> critical? -> parallel assign+slack+incident / queue+notify PM)
4. Sprint Automation (cron start -> move tasks -> notify -> wait end -> loop incomplete -> velocity -> summary)
5. Document Review Cycle (monthly cron -> loop pages tagged review -> >90 days? -> remind owner)

---

## 3-4. Time Tracking

### 3-4-A. Timer System

In task detail: estimated vs logged display, Start Timer / Log Time buttons. Active timer: topbar badge with elapsed time + task name + stop button. One timer at a time (starting new auto-stops current). Stop -> auto-create TimeEntry (with note input). Manual log: date, duration, note.

### 3-4-B. Time Reports

Project level: member time bar chart, weekly/monthly trend line, estimated vs actual table, label distribution pie chart.
Personal level: today/week/month totals, project distribution, daily heatmap (GitHub style).

---

## 3-5. Mention & Link System

### 3-5-A. Mention Types

@user (profile link + notification), @page (page link + hover preview), @date (inline date pill + reminder), @task (inline card + status badge), @database (inline preview), @everyone (workspace notification), @here (online members notification)

### 3-5-B. Date Mention

Input: @today, @tomorrow, @next monday, @April 15, @in 3 days. Display: yellow pill badge. Hover: detail popover. Click: set reminder (same day, 1 day before, 1 hour before, custom). Past: turns red.

### 3-5-C. Backlinks

Page bottom: "Backlinks (N)" section showing source pages + context text (30 chars around link). Click navigates to source. Real-time update on link add/remove.

### 3-5-D. Graph View

Cmd+Shift+G or sidebar button. Nodes = pages (circle, icon + title), edges = links (directed arrows). Node size proportional to connections. Current page highlighted. Interactions: drag nodes, zoom/pan, click to navigate, hover for preview. Filters: depth (1/2/all), subgraph. Search within graph. Rendering: d3-force or @visx/network.

---

# Phase 4: MCP/Webhooks/Integration Ecosystem

## 4-1. MCP Management System

### 4-1-A. MCP Data Model

```
McpServer: id, workspaceId, name, description, icon, type (builtin/custom/marketplace), transport (stdio/sse/streamable_http), config (command/args/url/headers/env), authType (none/api_key/oauth2/bearer), authConfig (encrypted), status (connected/disconnected/error/configuring), lastHealthCheck, healthError, capabilities (cached tools/resources/prompts), isEnabled, installedBy, permissions (allowedTools/deniedTools), rateLimitRpm, timestamps
McpUsageLog: id, serverId, userId, toolName, input, output, status, durationMs, error, createdAt
```

### 4-1-B. MCP Settings UI

Server list with status indicators, "Add Server" button, marketplace link. Each server card: status icon, name, tool/resource counts, last used.

### 4-1-C. Server Add Flow

3 options:
1. Quick Setup (JSON): paste Claude Desktop-compatible config, auto-parse, test connection
2. Manual: name, transport select, transport-specific fields, auth type + config
3. Marketplace: browse catalog

All env secrets AES-256 encrypted at rest.

### 4-1-D. Server Management Detail

Tabs: Overview (config, status, uptime, usage stats, Edit/Restart/Disable/Delete), Tools (list with descriptions, per-tool enable/disable, "Try it" test runner), Resources (URI list with preview), Permissions (whitelist/blacklist, rate limit, allowed users, confirmation requirement), Logs (recent 100, filter by tool/user/status, CSV export)

### 4-1-E. MCP Editor Integration

1. Slash commands: `/mcp` -> server list, `/mcp github search_repositories "query"` -> execute + insert result
2. AI menu: "Use MCP Tool" -> server -> tool -> params -> execute -> insert as code block or table
3. Inline MCP block: new `mcp_result` block type, cached result, "Refresh" button, auto-refresh interval (5m/15m/1h/manual)
4. Automation integration: `call_mcp_tool` action type

### 4-1-F. MCP Marketplace

Catalog UI: search, category filter (Developer/Productivity/Data/Communication/AI/Finance/Custom), cards with icon/name/tool count/rating/install count, "Install" button.

Install flow: review tools & permissions -> enter required env vars -> install & connect -> auto-add to server list.

50+ pre-registered servers across categories: GitHub, GitLab, Jira, Linear, Sentry, Vercel, Slack, Discord, Teams, Gmail, PostgreSQL, MongoDB, Redis, OpenAI, Anthropic, Stripe, Web Search, RSS, etc.

### 4-1-G. Built-in MCP Server Enhancement

Expand from 13 to 30 tools, 3 to 8 resources. Additional tools: list_pages, get_page_content, update_block_content, move_block, get/add/resolve_comments, get_page_history, restore_version, share_page, get/create/update_project_tasks, get_workspace_members, search_blocks, export_page, create_from_template. Additional resources: workspace://members, workspace://templates, workspace://projects, project://{id}/tasks, workspace://automations.

---

## 4-2. Webhook System

### 4-2-A. Incoming Webhooks

```
IncomingWebhook: id, workspaceId, name, path (unique), secret (HMAC), isEnabled, targetType (automation/database/page), targetId, fieldMapping, lastReceived, totalReceived, createdBy, createdAt
```

Field mapping: JSONPath for external payload -> internal fields. Transform functions (uppercase/lowercase/truncate/date/default). Test with sample payload. Security: HMAC-SHA256, IP whitelist (optional), rate limit 60/min, 1MB payload max.

### 4-2-B. Outgoing Webhooks

```
OutgoingWebhook: id, workspaceId, name, url, secret, events[], headers, isEnabled, retryPolicy, lastDelivered, totalDelivered, failureCount, createdAt
WebhookDelivery: id, webhookId, event, payload, responseStatus, responseBody, durationMs, attempt, status, error, deliveredAt
```

20+ subscribable events (page/block/database/comment/task/member/automation CRUD). Standard payload format (id, type, timestamp, workspace, actor, data with changes). Retry: 3xx follow redirects, 4xx no retry, 5xx retry (1s->5s->30s, max 3), 10s timeout, auto-disable after 10 consecutive failures.

### 4-2-C. Webhook Management UI

Settings > Integrations > Webhooks (Incoming/Outgoing tabs). Per webhook: status, events, URL, delivery stats, manage button. Delivery log: per-delivery request/response view, "Redeliver" button.

---

## 4-3. Native Service Integrations

### 4-3-A. Slack

OAuth2 connect. Features: notification forwarding (events -> Slack channels), channel mapping (project -> channel), slash commands (/notion search/create/task), rich unfurl for Notion links, message save to Notion page. Config: channel mappings, event selection, message format.

### 4-3-B. GitHub

OAuth App/GitHub App. Features: Issue <-> Task bidirectional sync, PR link on tasks (status display), commit reference (task ID in commit -> auto-link), release -> changelog page, branch protection via task status, code block embed from GitHub URLs. Config: repo selection, label->project mapping, milestone->sprint mapping, master side for conflicts.

### 4-3-C. Google Calendar

OAuth2. Features: database date property -> Calendar events, Calendar event -> auto-create meeting notes page (30min before), task due dates on Calendar, bidirectional date sync.

### 4-3-D. Email Integration

Outbound: automation emails, "Email this page" (HTML conversion), weekly digest. Inbound: dedicated address per workspace, email -> new page conversion, email -> database row (e.g., email -> bug report).

---

## 4-4. REST API Enhancement

### 4-4-A. Versioning

Notion-Version header (date-based). Backward compatible additions, version bump for removals. Deprecation/Sunset headers.

### 4-4-B. Additional Endpoints

Projects CRUD, Tasks CRUD (with filter/sort/pagination), Comments CRUD, Template instantiation, Export (md/html/pdf), Activity log, Notifications (list + mark read).

### 4-4-C. Rate Limiting

Tiered: Free 60/min, Pro 300/min, Team 600/min, Enterprise custom. Headers: X-RateLimit-Limit/Remaining/Reset, Retry-After. Redis sliding window per API key.

### 4-4-D. API Documentation UI

Auto-generated OpenAPI 3.0 spec from tRPC routers. Swagger UI-style interactive docs with "Try it". Code examples: cURL, JavaScript, Python, Go.

---

## 4-5. Import/Export Expansion

### 4-5-A. Import Sources

Existing: Markdown, HTML. Added: Notion (API JSON), Confluence (HTML ZIP), Google Docs (DOCX), Trello (JSON), Asana (CSV), Jira (CSV/JSON), CSV (auto-detect types), Obsidian (vault, [[links]]->page links), Evernote (ENEX).

Import flow: select source -> upload/connect -> preview tree -> adjust mappings -> async import with progress -> result report.

### 4-5-B. Export Formats

Existing: Markdown, HTML, PDF, JSON. Added: DOCX, EPUB, CSV (databases), JSON (Notion-compatible), Static HTML Site (with index + navigation), Slide HTML (H2-based slides, presentation mode).

### 4-5-C. Bidirectional Sync Engine

Supported: Notion DB <-> Google Sheets, Notion Tasks <-> Jira Issues, Notion Calendar DB <-> Google Calendar. Conflict resolution: last-write-wins (default), Notion master, external master, manual (notification on conflict). Sync status UI with item counts, conflict alerts, sync/pause/history controls.

---

## 4-6. Security & Admin Tools

### 4-6-A. Audit Log

Records: auth events, member management, page sharing/permissions, API keys, MCP servers, webhooks, automations, data import/export. UI: filterable (date/user/event type), exportable CSV.

### 4-6-B. Admin Dashboard

Settings > Admin (owner only): usage stats (pages/DBs/members/storage/API calls), active sessions, storage breakdown, API usage graphs, MCP usage, automation status.

### 4-6-C. RBAC Extension

Roles: Owner (full), Admin (full except ownership), Member (create/edit own, assigned tasks, use MCP/API), Guest (shared pages only), Viewer (read only). Custom roles: per-permission toggle matrix, assignable to members.

---

## Appendix: Shared Design Tokens

```css
--accent-blue: #2383e2;
--selection-bg-light: rgba(35, 131, 226, 0.08);
--selection-bg-dark: rgba(35, 131, 226, 0.15);
--selection-hover-light: rgba(35, 131, 226, 0.12);
--selection-hover-dark: rgba(35, 131, 226, 0.20);
--drag-indicator: #2383e2;
--comment-highlight: rgba(255, 212, 0, 0.3);
--suggestion-insert: rgba(0, 180, 0, 0.15);
--suggestion-delete: rgba(255, 0, 0, 0.15);
```

Cursor colors: #FF6B6B, #4ECDC4, #45B7D1, #96CEB4, #FFEAA7, #DDA0DD, #98D8C8, #F7DC6F
