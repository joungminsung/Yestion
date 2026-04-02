"use client";

import { m, AnimatePresence } from "framer-motion";
import { popoverVariants } from "@/lib/motion/variants";
import { useEffect, useRef, type ReactNode } from "react";

type AnimatedPopoverProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Anchor position */
  style?: React.CSSProperties;
};

export function AnimatedPopover({
  isOpen,
  onClose,
  children,
  className = "",
  style,
}: AnimatedPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          ref={ref}
          variants={popoverVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={`rounded-lg border shadow-lg ${className}`}
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-default)",
            zIndex: "var(--z-dropdown)",
            ...style,
          }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
