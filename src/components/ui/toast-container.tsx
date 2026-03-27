"use client";

import { useToastStore } from "@/stores/toast";
import { Toast } from "./toast";

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col-reverse gap-2"
      style={{ zIndex: "var(--z-toast)" }}
    >
      {toasts.slice(0, 3).map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
