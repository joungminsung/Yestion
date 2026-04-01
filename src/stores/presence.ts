import { create } from "zustand";

export type PresenceUser = { id: string; name: string; color: string };

type PresenceStore = {
  users: PresenceUser[];
  setUsers: (users: PresenceUser[]) => void;
  followingUserId: string | null;
  setFollowing: (userId: string | null) => void;
};

export const usePresenceStore = create<PresenceStore>((set) => ({
  users: [],
  setUsers: (users) => set({ users }),
  followingUserId: null,
  setFollowing: (userId) => set({ followingUserId: userId }),
}));
