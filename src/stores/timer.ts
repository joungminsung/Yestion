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
