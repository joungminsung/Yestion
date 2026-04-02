"use client";

import { MotionConfig, LazyMotion, domAnimation } from "framer-motion";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { ReactNode } from "react";

export function AppMotionConfig({ children }: { children: ReactNode }) {
  const prefersReduced = useMediaQuery("(prefers-reduced-motion: reduce)");

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion={prefersReduced ? "always" : "never"}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
