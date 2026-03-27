import { create } from "zustand";

type AiStore = {
  isOpen: boolean;
  context: string;
  position: { top: number; left: number } | null;
  open: (context: string, position: { top: number; left: number }) => void;
  close: () => void;
};

export const useAiStore = create<AiStore>((set) => ({
  isOpen: false,
  context: "",
  position: null,
  open: (context, position) => set({ isOpen: true, context, position }),
  close: () => set({ isOpen: false, context: "", position: null }),
}));
