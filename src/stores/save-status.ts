import { create } from "zustand";

type SaveStatusState = {
  status: "saved" | "saving" | "unsaved" | "error";
  setStatus: (status: "saved" | "saving" | "unsaved" | "error") => void;
};

export const useSaveStatusStore = create<SaveStatusState>((set) => ({
  status: "saved",
  setStatus: (status) => set({ status }),
}));
