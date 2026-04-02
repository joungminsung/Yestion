import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Tab = {
  id: string;
  url: string;
  title: string;
  icon: string | null;
  isPinned: boolean;
};

export type SplitDirection = "horizontal" | "vertical";

type TabsStore = {
  tabs: Tab[];
  activeTabId: string | null;
  splitTabId: string | null; // the tab shown in the split pane
  splitDirection: SplitDirection;
  splitRatio: number; // 0-1, left/top pane ratio

  // Actions
  addTab: (url: string, title?: string, icon?: string | null) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Pick<Tab, "title" | "icon" | "url">>) => void;
  pinTab: (id: string) => void;
  unpinTab: (id: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  // Split view
  openSplit: (tabId: string, direction?: SplitDirection) => void;
  closeSplit: () => void;
  setSplitRatio: (ratio: number) => void;
  setSplitDirection: (direction: SplitDirection) => void;
};

let nextId = 1;

export const useTabsStore = create<TabsStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      splitTabId: null,
      splitDirection: "horizontal",
      splitRatio: 0.5,

      addTab: (url, title = "Untitled", icon = null) => {
        const id = `tab-${Date.now()}-${nextId++}`;
        // Check if a tab with this URL already exists
        const existing = get().tabs.find((t) => t.url === url);
        if (existing) {
          set({ activeTabId: existing.id });
          return existing.id;
        }
        const tab: Tab = { id, url, title, icon, isPinned: false };
        set((state) => ({
          tabs: [...state.tabs, tab],
          activeTabId: id,
        }));
        return id;
      },

      closeTab: (id) => {
        set((state) => {
          const tab = state.tabs.find((t) => t.id === id);
          if (tab?.isPinned) return state; // can't close pinned tabs

          const newTabs = state.tabs.filter((t) => t.id !== id);
          let newActiveId = state.activeTabId;
          let newSplitId = state.splitTabId;

          if (state.activeTabId === id) {
            const closedIndex = state.tabs.findIndex((t) => t.id === id);
            const nextTab = newTabs[closedIndex] || newTabs[closedIndex - 1] || null;
            newActiveId = nextTab?.id ?? null;
          }

          if (state.splitTabId === id) {
            newSplitId = null;
          }

          return {
            tabs: newTabs,
            activeTabId: newActiveId,
            splitTabId: newSplitId,
          };
        });
      },

      setActiveTab: (id) => set({ activeTabId: id }),

      updateTab: (id, updates) => {
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
      },

      pinTab: (id) => {
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, isPinned: true } : t)),
        }));
      },

      unpinTab: (id) => {
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, isPinned: false } : t)),
        }));
      },

      reorderTabs: (fromIndex, toIndex) => {
        set((state) => {
          const newTabs = [...state.tabs];
          const [moved] = newTabs.splice(fromIndex, 1);
          if (moved) newTabs.splice(toIndex, 0, moved);
          return { tabs: newTabs };
        });
      },

      openSplit: (tabId, direction) => {
        set((state) => ({
          splitTabId: tabId,
          splitDirection: direction ?? state.splitDirection,
        }));
      },

      closeSplit: () => set({ splitTabId: null }),

      setSplitRatio: (ratio) => set({ splitRatio: Math.max(0.2, Math.min(0.8, ratio)) }),

      setSplitDirection: (direction) => set({ splitDirection: direction }),
    }),
    {
      name: "notion-tabs",
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        splitDirection: state.splitDirection,
      }),
    },
  ),
);
