import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSidebarStore } from "@/stores/sidebar";

describe("sidebar store", () => {
  beforeEach(() => {
    useSidebarStore.setState({ isOpen: true, width: 280, isResizing: false });
  });

  it("should toggle sidebar", () => {
    const { result } = renderHook(() => useSidebarStore());
    act(() => { result.current.toggle(); });
    expect(result.current.isOpen).toBe(false);
    act(() => { result.current.toggle(); });
    expect(result.current.isOpen).toBe(true);
  });

  it("should clamp width to min/max", () => {
    const { result } = renderHook(() => useSidebarStore());
    act(() => { result.current.setWidth(100); });
    expect(result.current.width).toBe(200);
    act(() => { result.current.setWidth(600); });
    expect(result.current.width).toBe(480);
  });

  it("should set width within range", () => {
    const { result } = renderHook(() => useSidebarStore());
    act(() => { result.current.setWidth(350); });
    expect(result.current.width).toBe(350);
  });
});
