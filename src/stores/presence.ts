import { create } from "zustand";

export type PresenceUser = {
  id: string;
  name: string;
  color: string;
  isTyping?: boolean;
  lastTypingAt?: number;
};

type PresenceStore = {
  users: PresenceUser[];
  setUsers: (users: PresenceUser[]) => void;
  followingUserId: string | null;
  setFollowing: (userId: string | null) => void;
  setUserTyping: (userId: string, isTyping: boolean) => void;
};

export const usePresenceStore = create<PresenceStore>((set) => ({
  users: [],
  setUsers: (users) => set({ users }),
  followingUserId: null,
  setFollowing: (userId) => set({ followingUserId: userId }),
  setUserTyping: (userId, isTyping) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === userId
          ? { ...u, isTyping, lastTypingAt: isTyping ? Date.now() : u.lastTypingAt }
          : u,
      ),
    })),
}));
