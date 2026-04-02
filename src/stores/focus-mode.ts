import { create } from "zustand";

type FocusModeStore = {
  isActive: boolean;
  toggle: () => void;
  setActive: (active: boolean) => void;
};

export const useFocusModeStore = create<FocusModeStore>()((set) => ({
  isActive: false,
  toggle: () => set((s) => ({ isActive: !s.isActive })),
  setActive: (active) => set({ isActive: active }),
}));
