"use client";

import { useRef, useEffect, useCallback } from "react";

export type SwipeDirection = "left" | "right" | "up" | "down";

type TouchGestureOptions = {
  onSwipe?: (direction: SwipeDirection) => void;
  onLongPress?: (e: TouchEvent) => void;
  swipeThreshold?: number;
  longPressMs?: number;
  /** Element ref -- if not provided, uses document */
  ref?: React.RefObject<HTMLElement | null>;
};

export function useTouchGestures({
  onSwipe,
  onLongPress,
  swipeThreshold = 50,
  longPressMs = 500,
  ref,
}: TouchGestureOptions) {
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const el = ref?.current ?? document;

    const handleTouchStart = (e: Event) => {
      const touch = (e as TouchEvent).touches[0];
      if (!touch) return;
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      startTime.current = Date.now();
      moved.current = false;

      if (onLongPress) {
        longPressTimer.current = setTimeout(() => {
          if (!moved.current) {
            onLongPress(e as TouchEvent);
          }
        }, longPressMs);
      }
    };

    const handleTouchMove = (e: Event) => {
      const touch = (e as TouchEvent).touches[0];
      if (!touch) return;
      const dx = Math.abs(touch.clientX - startX.current);
      const dy = Math.abs(touch.clientY - startY.current);
      if (dx > 10 || dy > 10) {
        moved.current = true;
        clearLongPress();
      }
    };

    const handleTouchEnd = (e: Event) => {
      clearLongPress();
      const touch = (e as TouchEvent).changedTouches[0];
      if (!touch || !onSwipe) return;

      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;
      const elapsed = Date.now() - startTime.current;

      // Must complete within 300ms to count as swipe
      if (elapsed > 300) return;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx > swipeThreshold && absDx > absDy) {
        onSwipe(dx > 0 ? "right" : "left");
      } else if (absDy > swipeThreshold && absDy > absDx) {
        onSwipe(dy > 0 ? "down" : "up");
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      clearLongPress();
    };
  }, [ref, onSwipe, onLongPress, swipeThreshold, longPressMs, clearLongPress]);
}
