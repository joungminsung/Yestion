import { create } from "zustand";

type CommandPaletteStore = {
  isOpen: boolean;
  query: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (query: string) => void;
};

export const useCommandPaletteStore = create<CommandPaletteStore>((set) => ({
  isOpen: false,
  query: "",
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, query: "" }),
  toggle: () => set((s) => (s.isOpen ? { isOpen: false, query: "" } : { isOpen: true })),
  setQuery: (query) => set({ query }),
}));
