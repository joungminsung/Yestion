"use client";

import { AnimatePresence, m } from "framer-motion";
import { usePathname } from "next/navigation";
import { fadeIn } from "@/lib/motion/variants";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={pathname}
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="flex-1 overflow-y-auto"
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}
