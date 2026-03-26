import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCommandPaletteStore } from "@/stores/command-palette";

describe("command palette store", () => {
  beforeEach(() => {
    useCommandPaletteStore.setState({ isOpen: false, query: "" });
  });

  it("should toggle open state", () => {
    const { result } = renderHook(() => useCommandPaletteStore());
    act(() => { result.current.toggle(); });
    expect(result.current.isOpen).toBe(true);
    act(() => { result.current.toggle(); });
    expect(result.current.isOpen).toBe(false);
  });

  it("should clear query on close", () => {
    const { result } = renderHook(() => useCommandPaletteStore());
    act(() => { result.current.open(); result.current.setQuery("test"); });
    expect(result.current.query).toBe("test");
    act(() => { result.current.close(); });
    expect(result.current.query).toBe("");
    expect(result.current.isOpen).toBe(false);
  });
});
