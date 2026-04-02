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
 * Defaults to "desktop" during SSR and on the first client render to avoid
 * hydration mismatches. `isMounted` flips to `true` after the first paint,
 * at which point the real device values take effect.
 */
export function useResponsive(): {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  device: DeviceType;
  isMounted: boolean;
} {
  const [isMounted, setIsMounted] = useState(false);
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  const isTablet = useMediaQuery(BREAKPOINTS.tablet);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const device: DeviceType = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";

  return {
    isMobile: isMounted && isMobile,
    isTablet: isMounted && isTablet,
    isDesktop: !isMounted || (!isMobile && !isTablet),
    device: isMounted ? device : "desktop",
    isMounted,
  };
}
