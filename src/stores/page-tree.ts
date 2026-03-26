import { create } from "zustand";
import { persist } from "zustand/middleware";

type PageTreeStore = {
  expandedNodes: Set<string>;
  activePageId: string | null;
  toggleExpanded: (pageId: string) => void;
  setExpanded: (pageId: string, expanded: boolean) => void;
  setActivePage: (pageId: string | null) => void;
};

export const usePageTreeStore = create<PageTreeStore>()(
  persist(
    (set) => ({
      expandedNodes: new Set<string>(),
      activePageId: null,
      toggleExpanded: (pageId) =>
        set((state) => {
          const next = new Set(state.expandedNodes);
          if (next.has(pageId)) next.delete(pageId); else next.add(pageId);
          return { expandedNodes: next };
        }),
      setExpanded: (pageId, expanded) =>
        set((state) => {
          const next = new Set(state.expandedNodes);
          if (expanded) next.add(pageId); else next.delete(pageId);
          return { expandedNodes: next };
        }),
      setActivePage: (pageId) => set({ activePageId: pageId }),
    }),
    {
      name: "notion-page-tree",
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          if (parsed?.state?.expandedNodes) {
            parsed.state.expandedNodes = new Set(parsed.state.expandedNodes);
          }
          return parsed;
        },
        setItem: (name, value) => {
          const toStore = {
            ...value,
            state: {
              ...value.state,
              expandedNodes: Array.from(value.state.expandedNodes),
            },
          };
          localStorage.setItem(name, JSON.stringify(toStore));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
