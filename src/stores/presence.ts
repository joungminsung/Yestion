import { create } from "zustand";

export type PresenceUser = { id: string; name: string; color: string };

type PresenceStore = {
  users: PresenceUser[];
  setUsers: (users: PresenceUser[]) => void;
};

export const usePresenceStore = create<PresenceStore>((set) => ({
  users: [],
  setUsers: (users) => set({ users }),
}));
