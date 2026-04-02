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

  // Row selection (for bulk operations)
  selectedRowIds: Set<string>;
  toggleRowSelection: (rowId: string) => void;
  selectAllRows: (rowIds: string[]) => void;
  clearSelection: () => void;
  isAllSelected: (totalCount: number) => boolean;

  // Search within database
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Pagination
  currentPage: number;
  pageSize: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Reset all local overrides
  resetLocal: () => void;
};

export const useDatabaseStore = create<DatabaseStore>((set, get) => ({
  activeViewId: null,
  setActiveView: (id) => set({ activeViewId: id }),

  localFilters: null,
  localSorts: null,
  localGroup: null,

  setLocalFilters: (filters) => set({ localFilters: filters }),
  setLocalSorts: (sorts) => set({ localSorts: sorts }),
  setLocalGroup: (group) => set({ localGroup: group }),

  // Row selection
  selectedRowIds: new Set<string>(),
  toggleRowSelection: (rowId) =>
    set((state) => {
      const next = new Set(state.selectedRowIds);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return { selectedRowIds: next };
    }),
  selectAllRows: (rowIds) =>
    set((state) => {
      const allSelected = rowIds.every((id) => state.selectedRowIds.has(id));
      return {
        selectedRowIds: allSelected ? new Set<string>() : new Set(rowIds),
      };
    }),
  clearSelection: () => set({ selectedRowIds: new Set<string>() }),
  isAllSelected: (totalCount) => {
    const { selectedRowIds } = get();
    return totalCount > 0 && selectedRowIds.size === totalCount;
  },

  // Search
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query, currentPage: 0 }),

  // Pagination
  currentPage: 0,
  pageSize: 50,
  setCurrentPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size, currentPage: 0 }),

  resetLocal: () =>
    set({
      localFilters: null,
      localSorts: null,
      localGroup: null,
      selectedRowIds: new Set<string>(),
      searchQuery: "",
      currentPage: 0,
    }),
}));
