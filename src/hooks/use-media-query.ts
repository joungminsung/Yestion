"use client";

import { useState, useEffect } from "react";

/**
 * Hook that tracks a CSS media query match state.
 * Returns `false` during SSR to avoid hydration mismatch (defaults to desktop).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** Breakpoint queries matching Tailwind defaults */
export const BREAKPOINTS = {
  mobile: "(max-width: 767px)",
  tablet: "(min-width: 768px) and (max-width: 1023px)",
  desktop: "(min-width: 1024px)",
} as const;

export type DeviceType = "mobile" | "tablet" | "desktop";

/**
 * Returns current device type based on viewport width.
 * Defaults to "desktop" during SSR.
 */
export function useResponsive(): {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  device: DeviceType;
} {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  const isTablet = useMediaQuery(BREAKPOINTS.tablet);

  const device: DeviceType = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    device,
  };
}
