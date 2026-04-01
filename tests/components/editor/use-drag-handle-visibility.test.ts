import { describe, it, expect } from "vitest";
import {
  visibilityReducer,
  type VisibilityState,
} from "@/components/editor/use-drag-handle-visibility";

describe("visibilityReducer", () => {
  it("transitions HIDDEN -> APPEARING on SHOW", () => {
    const state: VisibilityState = { phase: "hidden", blockPos: null, handlePosition: null };
    const result = visibilityReducer(state, {
      type: "SHOW", blockPos: 0, handlePosition: { top: 100, left: 50 },
    });
    expect(result.phase).toBe("appearing");
    expect(result.blockPos).toBe(0);
    expect(result.handlePosition).toEqual({ top: 100, left: 50 });
  });

  it("transitions APPEARING -> VISIBLE on TRANSITION_END", () => {
    const state: VisibilityState = { phase: "appearing", blockPos: 0, handlePosition: { top: 100, left: 50 } };
    const result = visibilityReducer(state, { type: "TRANSITION_END" });
    expect(result.phase).toBe("visible");
  });

  it("transitions VISIBLE -> DISAPPEARING on HIDE", () => {
    const state: VisibilityState = { phase: "visible", blockPos: 0, handlePosition: { top: 100, left: 50 } };
    const result = visibilityReducer(state, { type: "HIDE" });
    expect(result.phase).toBe("disappearing");
  });

  it("transitions DISAPPEARING -> HIDDEN on TRANSITION_END", () => {
    const state: VisibilityState = { phase: "disappearing", blockPos: 0, handlePosition: { top: 100, left: 50 } };
    const result = visibilityReducer(state, { type: "TRANSITION_END" });
    expect(result.phase).toBe("hidden");
    expect(result.blockPos).toBeNull();
    expect(result.handlePosition).toBeNull();
  });

  it("DISAPPEARING -> VISIBLE on SHOW (handle hover recovery)", () => {
    const state: VisibilityState = { phase: "disappearing", blockPos: 0, handlePosition: { top: 100, left: 50 } };
    const result = visibilityReducer(state, {
      type: "SHOW", blockPos: 5, handlePosition: { top: 200, left: 50 },
    });
    expect(result.phase).toBe("visible");
    expect(result.blockPos).toBe(5);
  });

  it("VISIBLE -> VISIBLE on SHOW (update position)", () => {
    const state: VisibilityState = { phase: "visible", blockPos: 0, handlePosition: { top: 100, left: 50 } };
    const result = visibilityReducer(state, {
      type: "SHOW", blockPos: 10, handlePosition: { top: 300, left: 50 },
    });
    expect(result.phase).toBe("visible");
    expect(result.blockPos).toBe(10);
    expect(result.handlePosition).toEqual({ top: 300, left: 50 });
  });

  it("LOCK prevents HIDE", () => {
    const state: VisibilityState = { phase: "visible", blockPos: 0, handlePosition: { top: 100, left: 50 } };
    const locked = visibilityReducer(state, { type: "LOCK" });
    expect(locked.locked).toBe(true);
    const afterHide = visibilityReducer(locked, { type: "HIDE" });
    expect(afterHide.phase).toBe("visible");
  });

  it("HIDDEN ignores HIDE", () => {
    const state: VisibilityState = { phase: "hidden", blockPos: null, handlePosition: null };
    const result = visibilityReducer(state, { type: "HIDE" });
    expect(result.phase).toBe("hidden");
  });
});
