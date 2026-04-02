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
