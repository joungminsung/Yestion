"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useResponsive, type DeviceType } from "@/hooks/use-media-query";

type ResponsiveContextValue = {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  device: DeviceType;
};

const ResponsiveContext = createContext<ResponsiveContextValue>({
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  device: "desktop",
});

export function ResponsiveProvider({ children }: { children: ReactNode }) {
  const value = useResponsive();
  return (
    <ResponsiveContext.Provider value={value}>
      {children}
    </ResponsiveContext.Provider>
  );
}

/**
 * Use responsive context value without calling useMediaQuery again.
 * Must be wrapped in ResponsiveProvider.
 */
export function useDevice() {
  return useContext(ResponsiveContext);
}
