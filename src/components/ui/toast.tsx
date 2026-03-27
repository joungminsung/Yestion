"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Toast as ToastType } from "@/stores/toast";
import { useToastStore } from "@/stores/toast";
import { Check, X, Info, AlertTriangle } from "lucide-react";

const icons: Record<ToastType["type"], ReactNode> = {
  success: <Check size={14} />,
  error: <X size={14} />,
  info: <Info size={14} />,
  warning: <AlertTriangle size={14} />,
};

export function Toast({ toast }: { toast: ToastType }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
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
        "flex items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-lg",
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
      <span className="flex-shrink-0">{icons[toast.type]}</span>
      <span className="flex-1">{toast.message}</span>
      {toast.undo && (
        <button
          onClick={() => { toast.undo?.(); handleClose(); }}
          className="flex-shrink-0 font-medium underline hover:no-underline"
          style={{ color: "var(--color-blue)" }}
        >
          Undo
        </button>
      )}
      <button onClick={handleClose} className="flex-shrink-0 ml-1 opacity-50 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}
