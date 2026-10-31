"use client";

import { useRef } from "react";

/**
 * A quick sideways swipe on touch screens (e.g. next/previous Bible
 * chapter). Ignores vertical scrolling, slow drags and text selection, so
 * reading and selecting verses still work normally.
 * Returns touch handlers to spread on the swipeable element.
 */
export function useSwipe({ onLeft, onRight, minDistance = 70 }: { onLeft?: () => void; onRight?: () => void; minDistance?: number }) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      start.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.changedTouches[0].clientX - s.x;
      const dy = e.changedTouches[0].clientY - s.y;
      const quick = Date.now() - s.t < 600;
      const sideways = Math.abs(dx) >= minDistance && Math.abs(dx) > Math.abs(dy) * 2;
      if (!quick || !sideways || window.getSelection()?.toString()) return;
      if (dx < 0) onLeft?.();
      else onRight?.();
    },
  };
}
