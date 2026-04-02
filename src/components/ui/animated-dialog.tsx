"use client";

import { m, AnimatePresence } from "framer-motion";
import { modalOverlay, modalContent } from "@/lib/motion/variants";
import type { ReactNode } from "react";

type AnimatedDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Width class, default "max-w-lg" */
  maxWidth?: string;
};

export function AnimatedDialog({
  isOpen,
  onClose,
  children,
  className = "",
  maxWidth = "max-w-lg",
}: AnimatedDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0" style={{ zIndex: "var(--z-modal)" }}>
          {/* Backdrop */}
          <m.div
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          {/* Content */}
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <m.div
              variants={modalContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={`w-full ${maxWidth} rounded-xl border shadow-2xl pointer-events-auto ${className}`}
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border-default)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </m.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
