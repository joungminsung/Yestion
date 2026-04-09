"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Toast as ToastType } from "@/stores/toast";
import { useToastStore } from "@/stores/toast";
import { Check, X, Info, AlertTriangle, Loader2 } from "lucide-react";

const icons: Record<ToastType["type"], ReactNode> = {
  success: <Check size={14} />,
  error: <X size={14} />,
  info: <Info size={14} />,
  warning: <AlertTriangle size={14} />,
};

const accentColors: Record<ToastType["type"], string> = {
  success: "var(--color-green, #16a34a)",
  error: "var(--color-red, #dc2626)",
  info: "var(--color-blue, #2383e2)",
  warning: "var(--color-orange, #d97706)",
};

export function Toast({ toast }: { toast: ToastType }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const [isExiting, setIsExiting] = useState(false);
  const accentColor = accentColors[toast.type];
  const clampedProgress =
    typeof toast.progress === "number"
      ? Math.max(0, Math.min(100, toast.progress))
      : null;
  const headline = toast.title ?? toast.message;
  const supportingText = toast.title
    ? toast.message
    : toast.description;

  useEffect(() => {
    if (toast.loading || toast.persistent || toast.duration === 0) {
      return undefined;
    }

    const duration = toast.duration ?? 4000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => removeToast(toast.id), 200);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => removeToast(toast.id), 200);
  };

  return (
    <div
      className={cn(
        "min-w-[320px] max-w-[420px] rounded-lg border px-4 py-3 text-sm shadow-lg",
        "transition-all duration-300",
        isExiting
          ? "translate-y-4 opacity-0 scale-95"
          : "translate-y-0 opacity-100 scale-100",
        "bg-notion-bg-primary border border-notion-border"
      )}
      style={{
        boxShadow: "var(--shadow-popup)",
        color: "var(--text-primary)",
        fontFamily: "var(--notion-font-family)",
      }}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: `${accentColor}15`,
            color: accentColor,
          }}
        >
          {toast.loading ? <Loader2 size={14} className="animate-spin" /> : icons[toast.type]}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-5">{headline}</p>
              {supportingText && (
                <p
                  className="mt-1 text-xs leading-5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {supportingText}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {toast.undo && (
                <button
                  onClick={() => {
                    toast.undo?.();
                    handleClose();
                  }}
                  className="flex-shrink-0 text-xs font-medium underline hover:no-underline"
                  style={{ color: "var(--color-blue)" }}
                >
                  Undo
                </button>
              )}
              <button
                onClick={handleClose}
                className="flex-shrink-0 opacity-50 transition-opacity hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {(toast.loading || clampedProgress !== null) && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span style={{ color: "var(--text-tertiary)" }}>
                  {toast.loading ? "처리 중" : "진행률"}
                </span>
                {clampedProgress !== null && (
                  <span style={{ color: "var(--text-tertiary)" }}>
                    {Math.round(clampedProgress)}%
                  </span>
                )}
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--bg-tertiary)" }}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    toast.loading && clampedProgress === null && "animate-pulse"
                  )}
                  style={{
                    width: `${clampedProgress ?? 42}%`,
                    backgroundColor: accentColor,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
