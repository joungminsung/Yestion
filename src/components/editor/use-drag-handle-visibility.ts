import { useReducer, useRef, useCallback, useEffect } from "react";

export type HandlePosition = { top: number; left: number };

export type VisibilityState = {
  phase: "hidden" | "appearing" | "visible" | "disappearing";
  blockPos: number | null;
  handlePosition: HandlePosition | null;
  locked?: boolean;
};

export type VisibilityAction =
  | { type: "SHOW"; blockPos: number; handlePosition: HandlePosition }
  | { type: "HIDE" }
  | { type: "TRANSITION_END" }
  | { type: "LOCK" }
  | { type: "UNLOCK" };

const INITIAL_STATE: VisibilityState = {
  phase: "hidden",
  blockPos: null,
  handlePosition: null,
  locked: false,
};

export function visibilityReducer(
  state: VisibilityState,
  action: VisibilityAction
): VisibilityState {
  switch (action.type) {
    case "SHOW": {
      const update = {
        blockPos: action.blockPos,
        handlePosition: action.handlePosition,
        locked: state.locked,
      };
      if (state.phase === "hidden" || state.phase === "appearing") {
        return { ...update, phase: "appearing" };
      }
      // VISIBLE or DISAPPEARING -> jump to VISIBLE with new position
      return { ...update, phase: "visible" };
    }
    case "HIDE": {
      if (state.locked) return state;
      if (state.phase === "visible") {
        return { ...state, phase: "disappearing" };
      }
      if (state.phase === "appearing") {
        return { ...INITIAL_STATE, locked: state.locked };
      }
      return state;
    }
    case "TRANSITION_END": {
      if (state.phase === "appearing") {
        return { ...state, phase: "visible" };
      }
      if (state.phase === "disappearing") {
        return { ...INITIAL_STATE, locked: state.locked };
      }
      return state;
    }
    case "LOCK":
      return { ...state, locked: true };
    case "UNLOCK":
      return { ...state, locked: false };
    default:
      return state;
  }
}

export function useDragHandleVisibility() {
  const [state, dispatch] = useReducer(visibilityReducer, INITIAL_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(
    (blockPos: number, handlePosition: HandlePosition) => {
      clearTimer();
      dispatch({ type: "SHOW", blockPos, handlePosition });
      timerRef.current = setTimeout(() => {
        dispatch({ type: "TRANSITION_END" });
      }, 150);
    },
    [clearTimer]
  );

  const hide = useCallback(() => {
    clearTimer();
    dispatch({ type: "HIDE" });
    timerRef.current = setTimeout(() => {
      dispatch({ type: "TRANSITION_END" });
    }, 150);
  }, [clearTimer]);

  const lock = useCallback(() => dispatch({ type: "LOCK" }), []);
  const unlock = useCallback(() => dispatch({ type: "UNLOCK" }), []);

  useEffect(() => clearTimer, [clearTimer]);

  const opacity =
    state.phase === "hidden"
      ? 0
      : state.phase === "appearing"
        ? 0.5
        : state.phase === "visible"
          ? 1
          : 0.5;

  return { state, show, hide, lock, unlock, opacity };
}
