import { create } from "zustand";

type NavigationStore = {
  history: string[];
  currentIndex: number;
  push: (url: string) => void;
  goBack: () => string | null;
  goForward: () => string | null;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
};

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  history: [],
  currentIndex: -1,
  push: (url) =>
    set((state) => {
      // Don't push duplicate of current
      if (state.currentIndex >= 0 && state.history[state.currentIndex] === url) {
        return state;
      }
      const newHistory = state.history.slice(0, state.currentIndex + 1);
      newHistory.push(url);
      return { history: newHistory, currentIndex: newHistory.length - 1 };
    }),
  goBack: () => {
    const state = get();
    if (state.currentIndex <= 0) return null;
    const url = state.history[state.currentIndex - 1];
    if (!url) return null;
    set({ currentIndex: state.currentIndex - 1 });
    return url;
  },
  goForward: () => {
    const state = get();
    if (state.currentIndex >= state.history.length - 1) return null;
    const url = state.history[state.currentIndex + 1];
    if (!url) return null;
    set({ currentIndex: state.currentIndex + 1 });
    return url;
  },
  canGoBack: () => get().currentIndex > 0,
  canGoForward: () => get().currentIndex < get().history.length - 1,
}));
