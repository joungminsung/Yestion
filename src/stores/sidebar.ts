import { create } from "zustand";
import { persist } from "zustand/middleware";

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_DEFAULT_WIDTH = 280;

type SidebarStore = {
  isOpen: boolean;
  width: number;
  isResizing: boolean;
  isHoverExpanded: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  setWidth: (width: number) => void;
  setResizing: (resizing: boolean) => void;
  setHoverExpanded: (v: boolean) => void;
  closeMobile: () => void;
};

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      isOpen: true,
      width: SIDEBAR_DEFAULT_WIDTH,
      isResizing: false,
      isHoverExpanded: false,
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      setOpen: (open) => set({ isOpen: open }),
      setWidth: (width) =>
        set({ width: Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)) }),
      setResizing: (resizing) => set({ isResizing: resizing }),
      setHoverExpanded: (v) => set({ isHoverExpanded: v }),
      closeMobile: () => set({ isOpen: false }),
    }),
    {
      name: "notion-sidebar",
      partialize: (state) => ({ isOpen: state.isOpen, width: state.width }),
    }
  )
);
