import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  message: string;
  title?: string;
  description?: string;
  type: ToastType;
  undo?: () => void;
  duration?: number;
  loading?: boolean;
  progress?: number;
  persistent?: boolean;
};

type ToastStore = {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  updateToast: (id: string, toast: Partial<Omit<Toast, "id">>) => void;
  removeToast: (id: string) => void;
};

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${++counter}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    return id;
  },
  updateToast: (id, toast) => {
    set((state) => ({
      toasts: state.toasts.map((item) =>
        item.id === id ? { ...item, ...toast } : item
      ),
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
