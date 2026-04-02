# PM Hub: Sprints, Time Tracking & Project Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sprint management, time tracking, and timeline/calendar/list views to the project management hub.
**Architecture:** Extend the Prisma schema with Sprint and TimeEntry models linked to Task/Project. Create dedicated tRPC routers for sprint lifecycle (create/start/complete) and time entries (start/stop/pause/manual). A Zustand store manages the client-side timer state. Three new project views (timeline with SVG Gantt bars, calendar grid, grouped list) join the existing board view behind a tab switcher. Sprint and timer UIs are standalone panels that compose into the project layout.
**Tech Stack:** Prisma, tRPC, Zustand, React 18, date-fns, recharts (new), SVG, Tailwind CSS

---

## File Structure

### New Files
- `prisma/migrations/<timestamp>_add_sprint_time_entry/migration.sql` (auto-generated)
- `src/server/routers/sprint.ts`
- `src/server/routers/time-entry.ts`
- `src/stores/timer.ts`
- `src/components/project/project-timeline-view.tsx`
- `src/components/project/project-calendar-view.tsx`
- `src/components/project/project-list-view.tsx`
- `src/components/project/sprint-panel.tsx`
- `src/components/project/time-tracker.tsx`
- `src/app/(main)/[workspaceId]/projects/[id]/time-report/page.tsx`

### Modified Files
- `prisma/schema.prisma`
- `src/server/trpc/router.ts`
- `src/components/project/project-home.tsx`
- `package.json`

---

### Task 1: Add Sprint and TimeEntry Prisma Models
**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Sprint model after the Task model**

In `prisma/schema.prisma`, add after the closing `}` of the `Task` model (after line 419):

```prisma
model Sprint {
  id          String    @id @default(cuid())
  projectId   String
  name        String
  goal        String?
  status      String    @default("planning") // "planning" | "active" | "completed"
  startDate   DateTime?
  endDate     DateTime?
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks       Task[]    @relation("SprintTasks")

  @@index([projectId])
  @@index([status])
}
```

- [ ] **Step 2: Add TimeEntry model after Sprint**

```prisma
model TimeEntry {
  id          String    @id @default(cuid())
  taskId      String
  userId      String
  description String?
  startedAt   DateTime  @default(now())
  endedAt     DateTime?
  duration    Int?      // seconds — computed on stop, null while running
  isPaused    Boolean   @default(false)
  pausedAt    DateTime?
  pausedTotal Int       @default(0) // accumulated paused seconds
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  task        Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId])
  @@index([userId])
  @@index([userId, startedAt])
}
```

- [ ] **Step 3: Add relations to existing models**

Add to the `Project` model (after the `tasks Task[]` line):
```prisma
  sprints     Sprint[]
```

Add to the `Task` model (after the `activities TaskActivity[]` line):
```prisma
  sprintId    String?
  sprint      Sprint?     @relation("SprintTasks", fields: [sprintId], references: [id], onDelete: SetNull)
  timeEntries TimeEntry[]
```

Add `@@index([sprintId])` to the Task model's indexes.

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name add_sprint_time_entry
```

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add Sprint and TimeEntry models to Prisma schema"
```

---

### Task 2: Sprint Router
**Files:**
- Create: `src/server/routers/sprint.ts`
- Modify: `src/server/trpc/router.ts`

- [ ] **Step 1: Create the sprint router**

Create `src/server/routers/sprint.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";

async function verifyProjectMembership(db: any, projectId: string, userId: string) {
  const member = await db.projectMember.findFirst({
    where: { projectId, userId },
  });
  if (!member) throw new Error("Not authorized: not a project member");
  return member;
}

export const sprintRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyProjectMembership(ctx.db, input.projectId, ctx.session.user.id);
      return ctx.db.sprint.findMany({
        where: { projectId: input.projectId },
        include: { _count: { select: { tasks: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const sprint = await ctx.db.sprint.findUnique({
        where: { id: input.id },
        include: {
          tasks: {
            include: { _count: { select: { subtasks: true } } },
            orderBy: { position: "asc" },
          },
        },
      });
      if (!sprint) throw new Error("Sprint not found");
      await verifyProjectMembership(ctx.db, sprint.projectId, ctx.session.user.id);
      return sprint;
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      name: z.string().min(1),
      goal: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyProjectMembership(ctx.db, input.projectId, ctx.session.user.id);
      return ctx.db.sprint.create({ data: input });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      goal: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sprint = await ctx.db.sprint.findUnique({ where: { id: input.id } });
      if (!sprint) throw new Error("Sprint not found");
      await verifyProjectMembership(ctx.db, sprint.projectId, ctx.session.user.id);
      const { id, ...data } = input;
      return ctx.db.sprint.update({ where: { id }, data });
    }),

  start: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sprint = await ctx.db.sprint.findUnique({ where: { id: input.id } });
      if (!sprint) throw new Error("Sprint not found");
      await verifyProjectMembership(ctx.db, sprint.projectId, ctx.session.user.id);

      // Only one active sprint per project
      const activeSprint = await ctx.db.sprint.findFirst({
        where: { projectId: sprint.projectId, status: "active" },
      });
      if (activeSprint) throw new Error("Another sprint is already active");

      return ctx.db.sprint.update({
        where: { id: input.id },
        data: { status: "active", startDate: sprint.startDate ?? new Date() },
      });
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx: any) => {
        const sprint = await tx.sprint.findUnique({
          where: { id: input.id },
          include: { tasks: { where: { status: { not: "done" } } } },
        });
        if (!sprint) throw new Error("Sprint not found");
        await verifyProjectMembership(tx, sprint.projectId, ctx.session.user.id);

        // Move incomplete tasks back to backlog (remove sprint assignment)
        if (sprint.tasks.length > 0) {
          await tx.task.updateMany({
            where: { sprintId: input.id, status: { not: "done" } },
            data: { sprintId: null },
          });
        }

        return tx.sprint.update({
          where: { id: input.id },
          data: { status: "completed", completedAt: new Date() },
        });
      });
    }),

  addTasks: protectedProcedure
    .input(z.object({ sprintId: z.string(), taskIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const sprint = await ctx.db.sprint.findUnique({ where: { id: input.sprintId } });
      if (!sprint) throw new Error("Sprint not found");
      await verifyProjectMembership(ctx.db, sprint.projectId, ctx.session.user.id);

      await ctx.db.task.updateMany({
        where: { id: { in: input.taskIds }, projectId: sprint.projectId },
        data: { sprintId: input.sprintId },
      });
      return { count: input.taskIds.length };
    }),

  removeTasks: protectedProcedure
    .input(z.object({ sprintId: z.string(), taskIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const sprint = await ctx.db.sprint.findUnique({ where: { id: input.sprintId } });
      if (!sprint) throw new Error("Sprint not found");
      await verifyProjectMembership(ctx.db, sprint.projectId, ctx.session.user.id);

      await ctx.db.task.updateMany({
        where: { id: { in: input.taskIds }, sprintId: input.sprintId },
        data: { sprintId: null },
      });
      return { count: input.taskIds.length };
    }),

  /** Burndown data: daily remaining story points / task count */
  burndown: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const sprint = await ctx.db.sprint.findUnique({
        where: { id: input.id },
        include: { tasks: { select: { status: true, updatedAt: true, estimatedHours: true } } },
      });
      if (!sprint || !sprint.startDate) return [];
      await verifyProjectMembership(ctx.db, sprint.projectId, ctx.session.user.id);

      const start = sprint.startDate;
      const end = sprint.completedAt ?? sprint.endDate ?? new Date();
      const totalTasks = sprint.tasks.length;
      const days: { date: string; remaining: number; ideal: number }[] = [];
      const msPerDay = 86400000;
      const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerDay));

      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + msPerDay)) {
        const dateStr = d.toISOString().split("T")[0];
        const completedByDate = sprint.tasks.filter(
          (t) => t.status === "done" && t.updatedAt <= d
        ).length;
        const dayIndex = Math.ceil((d.getTime() - start.getTime()) / msPerDay);
        days.push({
          date: dateStr,
          remaining: totalTasks - completedByDate,
          ideal: Math.max(0, totalTasks - (totalTasks * dayIndex) / totalDays),
        });
      }
      return days;
    }),
});
```

- [ ] **Step 2: Register sprint router in app router**

In `src/server/trpc/router.ts`, add import:
```typescript
import { sprintRouter } from "@/server/routers/sprint";
```

Add to the router object:
```typescript
  sprint: sprintRouter,
```

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/sprint.ts src/server/trpc/router.ts
git commit -m "feat: add sprint router with CRUD, start/complete lifecycle, burndown"
```

---

### Task 3: Time Entry Router
**Files:**
- Create: `src/server/routers/time-entry.ts`
- Modify: `src/server/trpc/router.ts`

- [ ] **Step 1: Create the time entry router**

Create `src/server/routers/time-entry.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";

async function verifyTaskAccess(db: any, taskId: string, userId: string) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  const member = await db.projectMember.findFirst({
    where: { projectId: task.projectId, userId },
  });
  if (!member) throw new Error("Not authorized");
  return task;
}

export const timeEntryRouter = router({
  /** List time entries for a task */
  list: protectedProcedure
    .input(z.object({
      taskId: z.string().optional(),
      projectId: z.string().optional(),
      userId: z.string().optional(),
      from: z.date().optional(),
      to: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.taskId) where.taskId = input.taskId;
      if (input.userId) where.userId = input.userId;
      if (input.from || input.to) {
        where.startedAt = {};
        if (input.from) (where.startedAt as any).gte = input.from;
        if (input.to) (where.startedAt as any).lte = input.to;
      }
      if (input.projectId) {
        where.task = { projectId: input.projectId };
      }

      return ctx.db.timeEntry.findMany({
        where,
        include: { task: { select: { id: true, title: true, projectId: true } } },
        orderBy: { startedAt: "desc" },
        take: 100,
      });
    }),

  /** Start a new timer for a task */
  start: protectedProcedure
    .input(z.object({ taskId: z.string(), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTaskAccess(ctx.db, input.taskId, ctx.session.user.id);

      // Stop any running timer for this user
      const running = await ctx.db.timeEntry.findFirst({
        where: { userId: ctx.session.user.id, endedAt: null },
      });
      if (running) {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - running.startedAt.getTime()) / 1000);
        await ctx.db.timeEntry.update({
          where: { id: running.id },
          data: { endedAt: now, duration: elapsed - running.pausedTotal },
        });
      }

      return ctx.db.timeEntry.create({
        data: {
          taskId: input.taskId,
          userId: ctx.session.user.id,
          description: input.description,
          startedAt: new Date(),
        },
      });
    }),

  /** Stop the running timer */
  stop: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.timeEntry.findUnique({ where: { id: input.id } });
      if (!entry || entry.userId !== ctx.session.user.id) throw new Error("Not found");
      if (entry.endedAt) throw new Error("Timer already stopped");

      const now = new Date();
      const elapsed = Math.floor((now.getTime() - entry.startedAt.getTime()) / 1000);
      const duration = elapsed - entry.pausedTotal;

      return ctx.db.timeEntry.update({
        where: { id: input.id },
        data: { endedAt: now, duration, isPaused: false },
      });
    }),

  /** Pause the running timer */
  pause: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.timeEntry.findUnique({ where: { id: input.id } });
      if (!entry || entry.userId !== ctx.session.user.id) throw new Error("Not found");
      if (entry.endedAt) throw new Error("Timer already stopped");
      if (entry.isPaused) throw new Error("Timer already paused");

      return ctx.db.timeEntry.update({
        where: { id: input.id },
        data: { isPaused: true, pausedAt: new Date() },
      });
    }),

  /** Resume a paused timer */
  resume: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.timeEntry.findUnique({ where: { id: input.id } });
      if (!entry || entry.userId !== ctx.session.user.id) throw new Error("Not found");
      if (!entry.isPaused || !entry.pausedAt) throw new Error("Timer not paused");

      const pausedSeconds = Math.floor((Date.now() - entry.pausedAt.getTime()) / 1000);

      return ctx.db.timeEntry.update({
        where: { id: input.id },
        data: {
          isPaused: false,
          pausedAt: null,
          pausedTotal: entry.pausedTotal + pausedSeconds,
        },
      });
    }),

  /** Manually create a completed time entry */
  create: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      description: z.string().optional(),
      startedAt: z.date(),
      endedAt: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyTaskAccess(ctx.db, input.taskId, ctx.session.user.id);
      const duration = Math.floor((input.endedAt.getTime() - input.startedAt.getTime()) / 1000);
      if (duration <= 0) throw new Error("End time must be after start time");

      return ctx.db.timeEntry.create({
        data: {
          taskId: input.taskId,
          userId: ctx.session.user.id,
          description: input.description,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          duration,
        },
      });
    }),

  /** Delete a time entry */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.timeEntry.findUnique({ where: { id: input.id } });
      if (!entry || entry.userId !== ctx.session.user.id) throw new Error("Not found");
      return ctx.db.timeEntry.delete({ where: { id: input.id } });
    }),

  /** Get the current user's active (running) timer */
  active: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.timeEntry.findFirst({
      where: { userId: ctx.session.user.id, endedAt: null },
      include: { task: { select: { id: true, title: true, projectId: true } } },
    });
  }),

  /** Time report: total hours grouped by task or day */
  report: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      from: z.date(),
      to: z.date(),
      groupBy: z.enum(["task", "day", "user"]).default("task"),
    }))
    .query(async ({ ctx, input }) => {
      const entries = await ctx.db.timeEntry.findMany({
        where: {
          task: { projectId: input.projectId },
          startedAt: { gte: input.from },
          endedAt: { lte: input.to },
          duration: { not: null },
        },
        include: { task: { select: { id: true, title: true } } },
      });

      if (input.groupBy === "task") {
        const map = new Map<string, { taskId: string; title: string; totalSeconds: number; count: number }>();
        for (const e of entries) {
          const key = e.taskId;
          const existing = map.get(key) ?? { taskId: key, title: e.task.title, totalSeconds: 0, count: 0 };
          existing.totalSeconds += e.duration!;
          existing.count += 1;
          map.set(key, existing);
        }
        return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
      }

      if (input.groupBy === "day") {
        const map = new Map<string, { date: string; totalSeconds: number; count: number }>();
        for (const e of entries) {
          const key = e.startedAt.toISOString().split("T")[0];
          const existing = map.get(key) ?? { date: key, totalSeconds: 0, count: 0 };
          existing.totalSeconds += e.duration!;
          existing.count += 1;
          map.set(key, existing);
        }
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      }

      // groupBy === "user"
      const map = new Map<string, { userId: string; totalSeconds: number; count: number }>();
      for (const e of entries) {
        const key = e.userId;
        const existing = map.get(key) ?? { userId: key, totalSeconds: 0, count: 0 };
        existing.totalSeconds += e.duration!;
        existing.count += 1;
        map.set(key, existing);
      }
      return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
    }),
});
```

- [ ] **Step 2: Register time entry router in app router**

In `src/server/trpc/router.ts`, add import:
```typescript
import { timeEntryRouter } from "@/server/routers/time-entry";
```

Add to the router object:
```typescript
  timeEntry: timeEntryRouter,
```

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/time-entry.ts src/server/trpc/router.ts
git commit -m "feat: add time entry router with start/stop/pause/resume/report"
```

---

### Task 4: Timer Zustand Store
**Files:**
- Create: `src/stores/timer.ts`

- [ ] **Step 1: Create the timer store**

Create `src/stores/timer.ts`:

```typescript
import { create } from "zustand";

type TimerState = {
  activeEntryId: string | null;
  taskId: string | null;
  taskTitle: string | null;
  startedAt: number | null; // epoch ms
  pausedAt: number | null;
  pausedTotal: number; // ms accumulated
  elapsed: number; // seconds, updated by tick
  isRunning: boolean;
  isPaused: boolean;
  _intervalId: ReturnType<typeof setInterval> | null;
};

type TimerActions = {
  start: (entryId: string, taskId: string, taskTitle: string, startedAt?: Date) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  tick: () => void;
  reset: () => void;
  restore: (entry: {
    id: string;
    taskId: string;
    taskTitle: string;
    startedAt: Date;
    isPaused: boolean;
    pausedAt: Date | null;
    pausedTotal: number;
  }) => void;
};

const initialState: TimerState = {
  activeEntryId: null,
  taskId: null,
  taskTitle: null,
  startedAt: null,
  pausedAt: null,
  pausedTotal: 0,
  elapsed: 0,
  isRunning: false,
  isPaused: false,
  _intervalId: null,
};

export const useTimerStore = create<TimerState & TimerActions>()((set, get) => ({
  ...initialState,

  start: (entryId, taskId, taskTitle, startedAt) => {
    const state = get();
    if (state._intervalId) clearInterval(state._intervalId);

    const now = startedAt?.getTime() ?? Date.now();
    const intervalId = setInterval(() => get().tick(), 1000);

    set({
      activeEntryId: entryId,
      taskId,
      taskTitle,
      startedAt: now,
      pausedAt: null,
      pausedTotal: 0,
      elapsed: 0,
      isRunning: true,
      isPaused: false,
      _intervalId: intervalId,
    });
  },

  stop: () => {
    const state = get();
    if (state._intervalId) clearInterval(state._intervalId);
    set(initialState);
  },

  pause: () => {
    set({ isPaused: true, pausedAt: Date.now() });
  },

  resume: () => {
    const state = get();
    if (state.pausedAt) {
      const pausedMs = Date.now() - state.pausedAt;
      set({
        isPaused: false,
        pausedAt: null,
        pausedTotal: state.pausedTotal + pausedMs,
      });
    }
  },

  tick: () => {
    const state = get();
    if (!state.isRunning || state.isPaused || !state.startedAt) return;
    const totalMs = Date.now() - state.startedAt - state.pausedTotal;
    set({ elapsed: Math.floor(totalMs / 1000) });
  },

  reset: () => {
    const state = get();
    if (state._intervalId) clearInterval(state._intervalId);
    set(initialState);
  },

  restore: (entry) => {
    const state = get();
    if (state._intervalId) clearInterval(state._intervalId);

    const intervalId = entry.isPaused ? null : setInterval(() => get().tick(), 1000);
    const pausedTotalMs = entry.pausedTotal * 1000;
    const now = Date.now();
    const totalMs = now - entry.startedAt.getTime() - pausedTotalMs;

    set({
      activeEntryId: entry.id,
      taskId: entry.taskId,
      taskTitle: entry.taskTitle,
      startedAt: entry.startedAt.getTime(),
      pausedAt: entry.isPaused && entry.pausedAt ? entry.pausedAt.getTime() : null,
      pausedTotal: pausedTotalMs,
      elapsed: entry.isPaused ? Math.floor(totalMs / 1000) : Math.floor(totalMs / 1000),
      isRunning: true,
      isPaused: entry.isPaused,
      _intervalId: intervalId,
    });
  },
}));

/** Format seconds into HH:MM:SS */
export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/timer.ts
git commit -m "feat: add Zustand timer store for time tracking"
```

---

### Task 5: Project Timeline (Gantt) View
**Files:**
- Create: `src/components/project/project-timeline-view.tsx`

- [ ] **Step 1: Create the timeline view component**

Create `src/components/project/project-timeline-view.tsx`:

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { trpc } from "@/server/trpc/client";
import {
  startOfWeek,
  endOfWeek,
  addDays,
  differenceInDays,
  format,
  isToday,
  addWeeks,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = { projectId: string };

const ROW_HEIGHT = 36;
const DAY_WIDTH = 40;
const HEADER_HEIGHT = 52;
const LEFT_PANEL_WIDTH = 220;

const STATUS_COLORS: Record<string, string> = {
  backlog: "#9CA3AF",
  todo: "#3B82F6",
  in_progress: "#F59E0B",
  in_review: "#8B5CF6",
  done: "#10B981",
};

export function ProjectTimelineView({ projectId }: Props) {
  const { data: tasks } = trpc.task.list.useQuery({ projectId });
  const [viewStart, setViewStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weeksToShow = 6;
  const viewEnd = addWeeks(viewStart, weeksToShow);
  const totalDays = differenceInDays(viewEnd, viewStart);

  const days = useMemo(() => {
    const d: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      d.push(addDays(viewStart, i));
    }
    return d;
  }, [viewStart, totalDays]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const tasksWithDates = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter((t) => t.startDate || t.dueDate)
      .map((t) => ({
        ...t,
        barStart: t.startDate ? new Date(t.startDate) : t.dueDate ? new Date(t.dueDate) : new Date(),
        barEnd: t.dueDate ? new Date(t.dueDate) : t.startDate ? addDays(new Date(t.startDate), 3) : new Date(),
      }));
  }, [tasks]);

  const getBarStyle = (barStart: Date, barEnd: Date) => {
    const startOffset = differenceInDays(barStart, viewStart);
    const duration = Math.max(1, differenceInDays(barEnd, barStart) + 1);
    return {
      left: startOffset * DAY_WIDTH,
      width: duration * DAY_WIDTH - 4,
    };
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Navigation bar */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <button
          onClick={() => setViewStart(subWeeks(viewStart, 2))}
          className="p-1 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {format(viewStart, "MMM d")} - {format(viewEnd, "MMM d, yyyy")}
        </span>
        <button
          onClick={() => setViewStart(addWeeks(viewStart, 2))}
          className="p-1 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setViewStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          className="ml-2 px-2 py-1 text-xs rounded border"
          style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
        >
          Today
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: task names */}
        <div
          className="flex-shrink-0 overflow-y-auto border-r"
          style={{ width: LEFT_PANEL_WIDTH, borderColor: "var(--border-default)" }}
        >
          <div
            className="sticky top-0 px-3 flex items-center text-xs font-medium"
            style={{ height: HEADER_HEIGHT, color: "var(--text-tertiary)", backgroundColor: "var(--bg-primary)", borderBottom: "1px solid var(--border-default)" }}
          >
            Task
          </div>
          {tasksWithDates.map((task) => (
            <div
              key={task.id}
              className="flex items-center px-3 text-sm truncate border-b"
              style={{ height: ROW_HEIGHT, color: "var(--text-primary)", borderColor: "var(--border-light)" }}
            >
              <div
                className="w-2 h-2 rounded-full mr-2 shrink-0"
                style={{ backgroundColor: STATUS_COLORS[task.status] ?? "#9CA3AF" }}
              />
              <span className="truncate">{task.title}</span>
            </div>
          ))}
        </div>

        {/* Right panel: Gantt chart */}
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <svg
            width={totalDays * DAY_WIDTH}
            height={HEADER_HEIGHT + tasksWithDates.length * ROW_HEIGHT}
            className="block"
          >
            {/* Date headers */}
            {days.map((day, i) => {
              const x = i * DAY_WIDTH;
              const today = isToday(day);
              const isMonday = day.getDay() === 1;
              return (
                <g key={i}>
                  {/* Column background */}
                  {today && (
                    <rect
                      x={x}
                      y={0}
                      width={DAY_WIDTH}
                      height={HEADER_HEIGHT + tasksWithDates.length * ROW_HEIGHT}
                      fill="var(--accent-blue-light, rgba(35,131,226,0.06))"
                    />
                  )}
                  {/* Grid line */}
                  <line
                    x1={x}
                    y1={HEADER_HEIGHT}
                    x2={x}
                    y2={HEADER_HEIGHT + tasksWithDates.length * ROW_HEIGHT}
                    stroke="var(--border-light, #eee)"
                    strokeWidth={isMonday ? 1 : 0.5}
                  />
                  {/* Month label on 1st */}
                  {day.getDate() === 1 && (
                    <text
                      x={x + 4}
                      y={14}
                      fontSize={11}
                      fontWeight={600}
                      fill="var(--text-secondary)"
                    >
                      {format(day, "MMM")}
                    </text>
                  )}
                  {/* Day number */}
                  <text
                    x={x + DAY_WIDTH / 2}
                    y={HEADER_HEIGHT - 8}
                    fontSize={10}
                    fill={today ? "var(--accent-blue, #2383e2)" : "var(--text-tertiary)"}
                    fontWeight={today ? 600 : 400}
                    textAnchor="middle"
                  >
                    {format(day, "d")}
                  </text>
                  {/* Weekday */}
                  {isMonday && (
                    <text
                      x={x + DAY_WIDTH / 2}
                      y={HEADER_HEIGHT - 22}
                      fontSize={9}
                      fill="var(--text-tertiary)"
                      textAnchor="middle"
                    >
                      {format(day, "EEE")}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Header bottom line */}
            <line
              x1={0}
              y1={HEADER_HEIGHT}
              x2={totalDays * DAY_WIDTH}
              y2={HEADER_HEIGHT}
              stroke="var(--border-default)"
              strokeWidth={1}
            />

            {/* Row separators */}
            {tasksWithDates.map((_, i) => (
              <line
                key={i}
                x1={0}
                y1={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT}
                x2={totalDays * DAY_WIDTH}
                y2={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT}
                stroke="var(--border-light, #eee)"
                strokeWidth={0.5}
              />
            ))}

            {/* Today marker */}
            {(() => {
              const todayOffset = differenceInDays(new Date(), viewStart);
              if (todayOffset < 0 || todayOffset >= totalDays) return null;
              const x = todayOffset * DAY_WIDTH + DAY_WIDTH / 2;
              return (
                <line
                  x1={x}
                  y1={HEADER_HEIGHT}
                  x2={x}
                  y2={HEADER_HEIGHT + tasksWithDates.length * ROW_HEIGHT}
                  stroke="var(--accent-blue, #2383e2)"
                  strokeWidth={2}
                  strokeDasharray="4,4"
                />
              );
            })()}

            {/* Task bars */}
            {tasksWithDates.map((task, i) => {
              const { left, width } = getBarStyle(task.barStart, task.barEnd);
              const y = HEADER_HEIGHT + i * ROW_HEIGHT + 8;
              const barHeight = ROW_HEIGHT - 16;
              return (
                <g key={task.id}>
                  <rect
                    x={left}
                    y={y}
                    width={Math.max(width, 8)}
                    height={barHeight}
                    rx={4}
                    fill={STATUS_COLORS[task.status] ?? "#9CA3AF"}
                    opacity={0.85}
                    className="cursor-pointer hover:opacity-100 transition-opacity"
                  />
                  {width > 60 && (
                    <text
                      x={left + 8}
                      y={y + barHeight / 2 + 4}
                      fontSize={10}
                      fill="white"
                      fontWeight={500}
                    >
                      {task.title.length > width / 7 ? task.title.slice(0, Math.floor(width / 7)) + "..." : task.title}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Empty state */}
      {tasksWithDates.length === 0 && tasks && tasks.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Add start dates or due dates to tasks to see them on the timeline
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/project/project-timeline-view.tsx
git commit -m "feat: add project timeline (Gantt) view with SVG bars and date axis"
```

---

### Task 6: Project Calendar View
**Files:**
- Create: `src/components/project/project-calendar-view.tsx`

- [ ] **Step 1: Create the calendar view component**

Create `src/components/project/project-calendar-view.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/server/trpc/client";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = { projectId: string };

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "var(--color-red)",
  high: "var(--color-orange)",
  medium: "var(--color-yellow)",
  low: "var(--color-green)",
};

export function ProjectCalendarView({ projectId }: Props) {
  const { data: tasks } = trpc.task.list.useQuery({ projectId });
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    let day = calStart;
    while (day <= calEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(day);
        day = addDays(day, 1);
      }
      result.push(week);
    }
    return result;
  }, [calStart, calEnd]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    if (!tasks) return map;
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = format(new Date(task.dueDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [tasks]);

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex flex-col h-full p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          <ChevronRight size={18} />
        </button>
        <button
          onClick={() => setCurrentMonth(new Date())}
          className="ml-2 px-2 py-1 text-xs rounded border"
          style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
        >
          Today
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {weekDays.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium py-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px flex-1 border rounded-lg overflow-hidden" style={{ borderColor: "var(--border-default)" }}>
        {weeks.flatMap((week) =>
          week.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate.get(dateKey) ?? [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            return (
              <div
                key={dateKey}
                className="flex flex-col p-1.5 min-h-[90px] border-b border-r"
                style={{
                  borderColor: "var(--border-light, #eee)",
                  backgroundColor: inMonth ? "var(--bg-primary)" : "var(--bg-secondary)",
                  opacity: inMonth ? 1 : 0.5,
                }}
              >
                <span
                  className="text-xs mb-1 w-6 h-6 flex items-center justify-center rounded-full"
                  style={{
                    color: today ? "white" : "var(--text-secondary)",
                    backgroundColor: today ? "var(--accent-blue, #2383e2)" : "transparent",
                    fontWeight: today ? 600 : 400,
                  }}
                >
                  {format(day, "d")}
                </span>

                <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                      style={{
                        backgroundColor: PRIORITY_COLORS[task.priority] ? `${PRIORITY_COLORS[task.priority]}22` : "var(--bg-hover)",
                        color: "var(--text-primary)",
                        borderLeft: `2px solid ${PRIORITY_COLORS[task.priority] ?? "var(--color-gray)"}`,
                      }}
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-xs px-1.5" style={{ color: "var(--text-tertiary)" }}>
                      +{dayTasks.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/project/project-calendar-view.tsx
git commit -m "feat: add project calendar view with monthly grid and task display"
```

---

### Task 7: Project List View
**Files:**
- Create: `src/components/project/project-list-view.tsx`

- [ ] **Step 1: Create the list view component**

Create `src/components/project/project-list-view.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/server/trpc/client";
import { ChevronRight, ChevronDown, Calendar, User } from "lucide-react";

type Props = { projectId: string };

type GroupBy = "status" | "priority" | "assignee" | "none";

const STATUS_ORDER = ["backlog", "todo", "in_progress", "in_review", "done"];
const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};
const PRIORITY_ORDER = ["urgent", "high", "medium", "low"];
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "var(--color-red)",
  high: "var(--color-orange)",
  medium: "var(--color-yellow)",
  low: "var(--color-green)",
};

export function ProjectListView({ projectId }: Props) {
  const { data: tasks } = trpc.task.list.useQuery({ projectId });
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    if (!tasks) return [];

    if (groupBy === "none") {
      return [{ key: "all", label: "All Tasks", tasks: [...tasks].sort((a, b) => a.position - b.position) }];
    }

    if (groupBy === "status") {
      return STATUS_ORDER.map((status) => ({
        key: status,
        label: STATUS_LABELS[status] ?? status,
        tasks: tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position),
      })).filter((g) => g.tasks.length > 0);
    }

    if (groupBy === "priority") {
      return PRIORITY_ORDER.map((priority) => ({
        key: priority,
        label: PRIORITY_LABELS[priority] ?? priority,
        tasks: tasks.filter((t) => t.priority === priority).sort((a, b) => a.position - b.position),
      })).filter((g) => g.tasks.length > 0);
    }

    // groupBy === "assignee"
    const map = new Map<string, typeof tasks>();
    for (const task of tasks) {
      const key = task.assigneeId ?? "unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return Array.from(map.entries()).map(([key, groupTasks]) => ({
      key,
      label: key === "unassigned" ? "Unassigned" : key,
      tasks: groupTasks.sort((a, b) => a.position - b.position),
    }));
  }, [tasks, groupBy]);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-4 py-2 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
          Group by:
        </span>
        {(["status", "priority", "assignee", "none"] as GroupBy[]).map((g) => (
          <button
            key={g}
            onClick={() => setGroupBy(g)}
            className="px-2 py-1 text-xs rounded"
            style={{
              backgroundColor: groupBy === g ? "var(--bg-hover)" : "transparent",
              color: groupBy === g ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: groupBy === g ? 500 : 400,
            }}
          >
            {g === "none" ? "None" : g.charAt(0).toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {/* Column headers */}
        <div
          className="grid grid-cols-[1fr_100px_80px_100px_80px] gap-2 px-4 py-2 text-xs font-medium sticky top-0"
          style={{ color: "var(--text-tertiary)", backgroundColor: "var(--bg-primary)", borderBottom: "1px solid var(--border-default)" }}
        >
          <span>Title</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Due Date</span>
          <span>Assignee</span>
        </div>

        {groups.map((group) => (
          <div key={group.key}>
            {/* Group header */}
            {groupBy !== "none" && (
              <button
                onClick={() => toggleCollapse(group.key)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium hover:bg-notion-bg-hover"
                style={{ color: "var(--text-primary)" }}
              >
                {collapsed.has(group.key) ? (
                  <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />
                ) : (
                  <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} />
                )}
                {group.label}
                <span className="text-xs px-1.5 rounded-full" style={{ color: "var(--text-tertiary)", backgroundColor: "var(--bg-hover)" }}>
                  {group.tasks.length}
                </span>
              </button>
            )}

            {/* Tasks */}
            {!collapsed.has(group.key) &&
              group.tasks.map((task) => (
                <div
                  key={task.id}
                  className="grid grid-cols-[1fr_100px_80px_100px_80px] gap-2 px-4 py-2 border-b hover:bg-notion-bg-hover cursor-pointer"
                  style={{ borderColor: "var(--border-light, #eee)" }}
                >
                  <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                    {task.title}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full w-fit"
                    style={{
                      backgroundColor: "var(--bg-hover)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {STATUS_LABELS[task.status] ?? task.status}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? "var(--color-gray)" }}
                    />
                    {PRIORITY_LABELS[task.priority] ?? task.priority}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {task.dueDate ? (
                      <>
                        <Calendar size={10} />
                        {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {task.assigneeId ? <User size={10} /> : "—"}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/project/project-list-view.tsx
git commit -m "feat: add project list view with grouping by status/priority/assignee"
```

---

### Task 8: Sprint Panel UI
**Files:**
- Create: `src/components/project/sprint-panel.tsx`
- Modify: `package.json` (add recharts)

- [ ] **Step 1: Install recharts**

```bash
npm install recharts
```

- [ ] **Step 2: Create the sprint panel component**

Create `src/components/project/sprint-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { Play, CheckCircle, Plus, X, Target } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Props = { projectId: string };

export function SprintPanel({ projectId }: Props) {
  const { data: sprints, refetch } = trpc.sprint.list.useQuery({ projectId });
  const createSprint = trpc.sprint.create.useMutation({ onSuccess: () => refetch() });
  const startSprint = trpc.sprint.start.useMutation({ onSuccess: () => refetch() });
  const completeSprint = trpc.sprint.complete.useMutation({ onSuccess: () => refetch() });

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);

  const activeSprint = sprints?.find((s) => s.status === "active");
  const burndownSprint = selectedSprintId ?? activeSprint?.id;

  const { data: burndownData } = trpc.sprint.burndown.useQuery(
    { id: burndownSprint! },
    { enabled: !!burndownSprint }
  );

  const handleCreate = () => {
    if (!newName.trim()) return;
    createSprint.mutate({ projectId, name: newName.trim(), goal: newGoal.trim() || undefined });
    setNewName("");
    setNewGoal("");
    setShowCreate(false);
  };

  const STATUS_BADGES: Record<string, { label: string; color: string; bg: string }> = {
    planning: { label: "Planning", color: "var(--text-secondary)", bg: "var(--bg-hover)" },
    active: { label: "Active", color: "var(--color-green)", bg: "rgba(16,185,129,0.1)" },
    completed: { label: "Completed", color: "var(--text-tertiary)", bg: "var(--bg-hover)" },
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Sprints
        </h3>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          <Plus size={12} />
          New Sprint
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div
          className="p-3 rounded-lg border"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              New Sprint
            </span>
            <button onClick={() => setShowCreate(false)} style={{ color: "var(--text-tertiary)" }}>
              <X size={14} />
            </button>
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Sprint name..."
            className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none mb-2"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            autoFocus
          />
          <input
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            placeholder="Sprint goal (optional)..."
            className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none mb-3"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
          />
          <button
            onClick={handleCreate}
            className="px-3 py-1.5 text-xs rounded"
            style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
          >
            Create Sprint
          </button>
        </div>
      )}

      {/* Sprint list */}
      {sprints?.map((sprint) => {
        const badge = STATUS_BADGES[sprint.status] ?? STATUS_BADGES.planning;
        return (
          <div
            key={sprint.id}
            className="p-3 rounded-lg border cursor-pointer"
            style={{ borderColor: selectedSprintId === sprint.id ? "var(--accent-blue)" : "var(--border-default)" }}
            onClick={() => setSelectedSprintId(sprint.id)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {sprint.name}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ color: badge.color, backgroundColor: badge.bg }}
              >
                {badge.label}
              </span>
            </div>

            {sprint.goal && (
              <div className="flex items-center gap-1 mb-2">
                <Target size={10} style={{ color: "var(--text-tertiary)" }} />
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {sprint.goal}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
              <span>{sprint._count.tasks} tasks</span>
              {sprint.startDate && (
                <span>
                  {new Date(sprint.startDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  {sprint.endDate && ` - ${new Date(sprint.endDate).toLocaleDateString("en", { month: "short", day: "numeric" })}`}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-2">
              {sprint.status === "planning" && (
                <button
                  onClick={(e) => { e.stopPropagation(); startSprint.mutate({ id: sprint.id }); }}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded"
                  style={{ backgroundColor: "var(--color-green)", color: "white" }}
                >
                  <Play size={10} />
                  Start Sprint
                </button>
              )}
              {sprint.status === "active" && (
                <button
                  onClick={(e) => { e.stopPropagation(); completeSprint.mutate({ id: sprint.id }); }}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded"
                  style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
                >
                  <CheckCircle size={10} />
                  Complete Sprint
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Burndown chart */}
      {burndownData && burndownData.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
            Burndown Chart
          </h4>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={burndownData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light, #eee)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
                  tickFormatter={(v: string) => v.slice(5)} // MM-DD
                />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="remaining"
                  name="Remaining"
                  stroke="var(--accent-blue, #2383e2)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="ideal"
                  name="Ideal"
                  stroke="var(--text-tertiary)"
                  strokeDasharray="5 5"
                  strokeWidth={1}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/project/sprint-panel.tsx package.json package-lock.json
git commit -m "feat: add sprint panel UI with create/start/complete and burndown chart"
```

---

### Task 9: Timer UI
**Files:**
- Create: `src/components/project/time-tracker.tsx`

- [ ] **Step 1: Create the time tracker component**

Create `src/components/project/time-tracker.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { trpc } from "@/server/trpc/client";
import { useTimerStore, formatElapsed } from "@/stores/timer";
import { Play, Pause, Square, Clock } from "lucide-react";

/** Compact timer button for task cards */
export function TaskTimer({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const { activeEntryId, taskId: activeTaskId, isRunning, isPaused, elapsed, start, stop, pause, resume } =
    useTimerStore();

  const startMutation = trpc.timeEntry.start.useMutation();
  const stopMutation = trpc.timeEntry.stop.useMutation();
  const pauseMutation = trpc.timeEntry.pause.useMutation();
  const resumeMutation = trpc.timeEntry.resume.useMutation();

  const isThisTask = activeTaskId === taskId;

  const handleStart = async () => {
    const entry = await startMutation.mutateAsync({ taskId });
    start(entry.id, taskId, taskTitle);
  };

  const handleStop = async () => {
    if (!activeEntryId) return;
    await stopMutation.mutateAsync({ id: activeEntryId });
    stop();
  };

  const handlePause = async () => {
    if (!activeEntryId) return;
    await pauseMutation.mutateAsync({ id: activeEntryId });
    pause();
  };

  const handleResume = async () => {
    if (!activeEntryId) return;
    await resumeMutation.mutateAsync({ id: activeEntryId });
    resume();
  };

  if (isThisTask && isRunning) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono" style={{ color: "var(--accent-blue)" }}>
          {formatElapsed(elapsed)}
        </span>
        {isPaused ? (
          <button
            onClick={(e) => { e.stopPropagation(); handleResume(); }}
            className="p-0.5 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--color-green)" }}
            title="Resume"
          >
            <Play size={12} />
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); handlePause(); }}
            className="p-0.5 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--color-yellow)" }}
            title="Pause"
          >
            <Pause size={12} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); handleStop(); }}
          className="p-0.5 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--color-red)" }}
          title="Stop"
        >
          <Square size={12} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleStart(); }}
      className="p-0.5 rounded hover:bg-notion-bg-hover opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ color: "var(--text-tertiary)" }}
      title="Start timer"
    >
      <Play size={12} />
    </button>
  );
}

/** Global topbar timer display — shows active timer from any page */
export function TopbarTimer() {
  const { activeEntryId, taskTitle, isRunning, isPaused, elapsed, stop, pause, resume, restore } =
    useTimerStore();

  const stopMutation = trpc.timeEntry.stop.useMutation();
  const pauseMutation = trpc.timeEntry.pause.useMutation();
  const resumeMutation = trpc.timeEntry.resume.useMutation();
  const { data: activeEntry } = trpc.timeEntry.active.useQuery(undefined, {
    refetchInterval: false,
  });

  // Restore timer from server on mount if one is running
  useEffect(() => {
    if (activeEntry && !activeEntryId) {
      restore({
        id: activeEntry.id,
        taskId: activeEntry.taskId,
        taskTitle: activeEntry.task.title,
        startedAt: new Date(activeEntry.startedAt),
        isPaused: activeEntry.isPaused,
        pausedAt: activeEntry.pausedAt ? new Date(activeEntry.pausedAt) : null,
        pausedTotal: activeEntry.pausedTotal,
      });
    }
  }, [activeEntry, activeEntryId, restore]);

  if (!isRunning || !activeEntryId) return null;

  const handleStop = async () => {
    await stopMutation.mutateAsync({ id: activeEntryId });
    stop();
  };

  const handleTogglePause = async () => {
    if (isPaused) {
      await resumeMutation.mutateAsync({ id: activeEntryId });
      resume();
    } else {
      await pauseMutation.mutateAsync({ id: activeEntryId });
      pause();
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
      style={{ borderColor: "var(--accent-blue)", backgroundColor: "rgba(35,131,226,0.05)" }}
    >
      <Clock size={14} style={{ color: "var(--accent-blue)" }} />
      <span className="text-xs max-w-[120px] truncate" style={{ color: "var(--text-secondary)" }}>
        {taskTitle}
      </span>
      <span
        className="text-sm font-mono font-medium"
        style={{ color: isPaused ? "var(--color-yellow)" : "var(--accent-blue)" }}
      >
        {formatElapsed(elapsed)}
      </span>
      <button
        onClick={handleTogglePause}
        className="p-1 rounded hover:bg-notion-bg-hover"
        style={{ color: isPaused ? "var(--color-green)" : "var(--color-yellow)" }}
      >
        {isPaused ? <Play size={14} /> : <Pause size={14} />}
      </button>
      <button
        onClick={handleStop}
        className="p-1 rounded hover:bg-notion-bg-hover"
        style={{ color: "var(--color-red)" }}
      >
        <Square size={14} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/project/time-tracker.tsx
git commit -m "feat: add task timer and topbar timer display components"
```

---

### Task 10: Time Report Page
**Files:**
- Create: `src/app/(main)/[workspaceId]/projects/[id]/time-report/page.tsx`

- [ ] **Step 1: Create the time report page**

Create `src/app/(main)/[workspaceId]/projects/[id]/time-report/page.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import { Clock, BarChart3, Users, ListTodo } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type GroupBy = "task" | "day" | "user";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function TimeReportPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [groupBy, setGroupBy] = useState<GroupBy>("task");
  const [range, setRange] = useState(7); // days

  const from = useMemo(() => startOfDay(subDays(new Date(), range)), [range]);
  const to = useMemo(() => endOfDay(new Date()), []);

  const { data: report, isLoading } = trpc.timeEntry.report.useQuery({
    projectId,
    from,
    to,
    groupBy,
  });

  const totalSeconds = useMemo(() => {
    if (!report) return 0;
    return report.reduce((sum: number, r: any) => sum + (r.totalSeconds ?? 0), 0);
  }, [report]);

  const totalEntries = useMemo(() => {
    if (!report) return 0;
    return report.reduce((sum: number, r: any) => sum + (r.count ?? 0), 0);
  }, [report]);

  const chartData = useMemo(() => {
    if (!report) return [];
    return report.map((r: any) => ({
      name: r.title ?? r.date ?? r.userId ?? "Unknown",
      hours: Math.round((r.totalSeconds / 3600) * 100) / 100,
    }));
  }, [report]);

  const groupByOptions: { id: GroupBy; label: string; icon: typeof ListTodo }[] = [
    { id: "task", label: "By Task", icon: ListTodo },
    { id: "day", label: "By Day", icon: BarChart3 },
    { id: "user", label: "By User", icon: Users },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Clock size={24} style={{ color: "var(--accent-blue)" }} />
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Time Report
          </h1>
        </div>

        {/* Controls */}
        <div
          className="flex items-center gap-4 mb-6 pb-4 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          {/* Date range */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
              Range:
            </span>
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setRange(d)}
                className="px-2 py-1 text-xs rounded"
                style={{
                  backgroundColor: range === d ? "var(--bg-hover)" : "transparent",
                  color: range === d ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: range === d ? 500 : 400,
                }}
              >
                {d}d
              </button>
            ))}
          </div>

          <div className="w-px h-5" style={{ backgroundColor: "var(--border-default)" }} />

          {/* Group by */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
              Group:
            </span>
            {groupByOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setGroupBy(opt.id)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded"
                style={{
                  backgroundColor: groupBy === opt.id ? "var(--bg-hover)" : "transparent",
                  color: groupBy === opt.id ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: groupBy === opt.id ? 500 : 400,
                }}
              >
                <opt.icon size={12} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div
            className="p-4 rounded-lg border"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
              Total Time
            </div>
            <div className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {formatDuration(totalSeconds)}
            </div>
          </div>
          <div
            className="p-4 rounded-lg border"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
              Entries
            </div>
            <div className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {totalEntries}
            </div>
          </div>
          <div
            className="p-4 rounded-lg border"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
              Daily Average
            </div>
            <div className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {formatDuration(Math.round(totalSeconds / Math.max(1, range)))}
            </div>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div
            className="p-4 rounded-lg border mb-6"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light, #eee)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
                    label={{ value: "Hours", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "var(--text-tertiary)" } }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`${value}h`, "Time"]}
                  />
                  <Bar dataKey="hours" fill="var(--accent-blue, #2383e2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Table */}
        <div
          className="rounded-lg border overflow-hidden"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div
            className="grid grid-cols-[1fr_100px_80px] gap-2 px-4 py-2 text-xs font-medium"
            style={{ color: "var(--text-tertiary)", backgroundColor: "var(--bg-secondary)" }}
          >
            <span>{groupBy === "task" ? "Task" : groupBy === "day" ? "Date" : "User"}</span>
            <span>Time</span>
            <span>Entries</span>
          </div>
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
              Loading...
            </div>
          ) : report?.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
              No time entries in this period
            </div>
          ) : (
            report?.map((row: any, i: number) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_100px_80px] gap-2 px-4 py-2 border-t"
                style={{ borderColor: "var(--border-light, #eee)" }}
              >
                <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                  {row.title ?? (row.date ? format(new Date(row.date), "EEE, MMM d") : row.userId)}
                </span>
                <span className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
                  {formatDuration(row.totalSeconds)}
                </span>
                <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                  {row.count}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(main\)/\[workspaceId\]/projects/\[id\]/time-report/page.tsx
git commit -m "feat: add time report page with chart, summary, and table"
```

---

### Task 11: Update Project Home with View Tabs
**Files:**
- Modify: `src/components/project/project-home.tsx`

- [ ] **Step 1: Add view tab switching to project-home.tsx**

Replace the entire content of `src/components/project/project-home.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus, BarChart3, LayoutGrid, CalendarDays, List, GanttChart, Timer } from "lucide-react";
import { trpc } from "@/server/trpc/client";
import { BoardView } from "./board-view";
import { ProjectTimelineView } from "./project-timeline-view";
import { ProjectCalendarView } from "./project-calendar-view";
import { ProjectListView } from "./project-list-view";
import { SprintPanel } from "./sprint-panel";

type ViewType = "board" | "list" | "timeline" | "calendar";

const VIEW_TABS: { id: ViewType; label: string; icon: typeof LayoutGrid }[] = [
  { id: "board", label: "Board", icon: LayoutGrid },
  { id: "list", label: "List", icon: List },
  { id: "timeline", label: "Timeline", icon: GanttChart },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
];

export function ProjectHome() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const { data: projects, isLoading } = trpc.project.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const utils = trpc.useUtils();
  const createProject = trpc.project.create.useMutation({
    onSuccess: () => utils.project.list.invalidate(),
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [activeView, setActiveView] = useState<ViewType>("board");
  const [showSprints, setShowSprints] = useState(false);

  const selectedProject = projects?.find((p) => p.id === selectedProjectId) ?? projects?.[0];

  const handleCreate = () => {
    if (!newName.trim()) return;
    createProject.mutate({ workspaceId, name: newName.trim() });
    setNewName("");
    setShowCreate(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span style={{ color: "var(--text-tertiary)" }}>Loading projects...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Project selector bar */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b overflow-x-auto"
        style={{ borderColor: "var(--border-default)" }}
      >
        {projects?.map((project) => (
          <button
            key={project.id}
            onClick={() => setSelectedProjectId(project.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors"
            style={{
              color: selectedProject?.id === project.id ? "var(--text-primary)" : "var(--text-secondary)",
              backgroundColor: selectedProject?.id === project.id ? "var(--bg-hover)" : undefined,
              fontWeight: selectedProject?.id === project.id ? 500 : 400,
            }}
          >
            <span>{project.icon || "📁"}</span>
            <span>{project.name}</span>
            <span className="text-xs opacity-60">{project._count.tasks}</span>
          </button>
        ))}

        {showCreate ? (
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
              placeholder="Project name..."
              className="px-2 py-1 text-sm rounded border bg-transparent outline-none"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", width: "160px" }}
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-sm hover:bg-notion-bg-hover whitespace-nowrap"
            style={{ color: "var(--text-tertiary)" }}
          >
            <Plus size={14} />
            New Project
          </button>
        )}
      </div>

      {selectedProject ? (
        <>
          {/* View tabs */}
          <div
            className="flex items-center gap-1 px-4 py-1.5 border-b"
            style={{ borderColor: "var(--border-default)" }}
          >
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors"
                style={{
                  color: activeView === tab.id ? "var(--text-primary)" : "var(--text-tertiary)",
                  backgroundColor: activeView === tab.id ? "var(--bg-hover)" : "transparent",
                  fontWeight: activeView === tab.id ? 500 : 400,
                }}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}

            <div className="w-px h-4 mx-1" style={{ backgroundColor: "var(--border-default)" }} />

            <button
              onClick={() => setShowSprints(!showSprints)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors"
              style={{
                color: showSprints ? "var(--text-primary)" : "var(--text-tertiary)",
                backgroundColor: showSprints ? "var(--bg-hover)" : "transparent",
              }}
            >
              <Timer size={13} />
              Sprints
            </button>
          </div>

          {/* Content area */}
          <div className="flex flex-1 overflow-hidden">
            {/* Main view */}
            <div className="flex-1 overflow-hidden">
              {activeView === "board" && <BoardView projectId={selectedProject.id} />}
              {activeView === "list" && <ProjectListView projectId={selectedProject.id} />}
              {activeView === "timeline" && <ProjectTimelineView projectId={selectedProject.id} />}
              {activeView === "calendar" && <ProjectCalendarView projectId={selectedProject.id} />}
            </div>

            {/* Sprint side panel */}
            {showSprints && (
              <div
                className="w-[320px] flex-shrink-0 border-l overflow-y-auto"
                style={{ borderColor: "var(--border-default)" }}
              >
                <SprintPanel projectId={selectedProject.id} />
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <BarChart3 size={48} style={{ color: "var(--text-placeholder)" }} />
          <p style={{ color: "var(--text-tertiary)" }}>Create a project to get started</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
          >
            New Project
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/project/project-home.tsx
git commit -m "feat: update project home with view tabs (board/list/timeline/calendar) and sprint panel"
```
