import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToastStore } from "@/stores/toast";

describe("toast store", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it("should add a toast", () => {
    const { result } = renderHook(() => useToastStore());
    act(() => {
      result.current.addToast({ message: "Hello", type: "success" });
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]!.message).toBe("Hello");
    expect(result.current.toasts[0]!.type).toBe("success");
  });

  it("should remove a toast", () => {
    const { result } = renderHook(() => useToastStore());
    act(() => {
      result.current.addToast({ message: "Hello", type: "info" });
    });
    const toastId = result.current.toasts[0]!.id;
    act(() => {
      result.current.removeToast(toastId);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("should support undo action", () => {
    const undoFn = vi.fn();
    const { result } = renderHook(() => useToastStore());
    act(() => {
      result.current.addToast({ message: "Deleted", type: "info", undo: undoFn });
    });
    expect(result.current.toasts[0]!.undo).toBe(undoFn);
  });
});
