"use client";

import { AnimatePresence, m } from "framer-motion";
import { useToastStore } from "@/stores/toast";
import { Toast } from "./toast";
import { slideUp } from "@/lib/motion/variants";

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col-reverse gap-2"
      style={{ zIndex: "var(--z-toast)" }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.slice(0, 3).map((toast) => (
          <m.div
            key={toast.id}
            variants={slideUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
          >
            <Toast toast={toast} />
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
