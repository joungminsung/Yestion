import { create } from "zustand";
import type { FilterGroup, SortRule, GroupRule } from "@/types/database";

type DatabaseStore = {
  activeViewId: string | null;
  setActiveView: (id: string) => void;

  // Local overrides (before persisting to server)
  localFilters: FilterGroup | null;
  localSorts: SortRule[] | null;
  localGroup: GroupRule | null;

  setLocalFilters: (filters: FilterGroup | null) => void;
  setLocalSorts: (sorts: SortRule[] | null) => void;
  setLocalGroup: (group: GroupRule | null) => void;

  // Reset all local overrides
  resetLocal: () => void;
};

export const useDatabaseStore = create<DatabaseStore>((set) => ({
  activeViewId: null,
  setActiveView: (id) => set({ activeViewId: id }),

  localFilters: null,
  localSorts: null,
  localGroup: null,

  setLocalFilters: (filters) => set({ localFilters: filters }),
  setLocalSorts: (sorts) => set({ localSorts: sorts }),
  setLocalGroup: (group) => set({ localGroup: group }),

  resetLocal: () =>
    set({ localFilters: null, localSorts: null, localGroup: null }),
}));
