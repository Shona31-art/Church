"use client";

import { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";

export interface SwipeAction {
  label: string;
  icon: React.ReactNode;
  tone?: "neutral" | "gold";
  onAction: () => void | Promise<void>;
}

const ACTION_WIDTH = 76;

/**
 * Swipe a list row left (touch screens) to reveal quick actions, like a
 * phone's mail app. A shortcut only: the same actions are always available
 * elsewhere (e.g. the chat's own menu), so keyboard and screen-reader users
 * lose nothing — the revealed buttons are hidden from them.
 */
export function SwipeActions({ actions, children }: { actions: SwipeAction[]; children: React.ReactNode }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; base: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);
  const moved = useRef(false);
  const row = useRef<HTMLDivElement>(null);
  const max = actions.length * ACTION_WIDTH;

  // Tap anywhere else closes an open row.
  useEffect(() => {
    if (!offset) return;
    const close = (e: Event) => {
      if (!row.current?.contains(e.target as Node)) setOffset(0);
    };
    document.addEventListener("touchstart", close, { passive: true });
    return () => document.removeEventListener("touchstart", close);
  }, [offset]);

  return (
    <div ref={row} className="relative overflow-hidden rounded-xl">
      <div aria-hidden className={`absolute inset-y-0 right-0 flex ${offset || dragging ? "" : "invisible"}`} style={{ width: max }}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            tabIndex={-1}
            onClick={async () => {
              setOffset(0);
              haptic("tap");
              await a.onAction();
            }}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-micro font-semibold ${
              a.tone === "gold" ? "bg-ember text-on-ember" : "bg-surface-raised text-ink"
            }`}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
      <div
        className={`relative bg-surface ${dragging ? "" : "transition-transform duration-200 ease-out"}`}
        style={{ transform: `translateX(${-offset}px)` }}
        onTouchStart={(e) => {
          start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: offset };
          horizontal.current = null;
          moved.current = false;
        }}
        onTouchMove={(e) => {
          if (!start.current) return;
          const dx = start.current.x - e.touches[0].clientX;
          const dy = e.touches[0].clientY - start.current.y;
          // Decide once per gesture whether it's a sideways swipe or a scroll.
          if (horizontal.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) horizontal.current = Math.abs(dx) > Math.abs(dy);
          if (!horizontal.current) return;
          moved.current = true;
          setDragging(true);
          setOffset(Math.max(0, Math.min(max + 24, start.current.base + dx)));
        }}
        onTouchEnd={() => {
          setDragging(false);
          if (horizontal.current) setOffset((o) => (o > max / 2 ? max : 0));
          start.current = null;
        }}
        // A swipe must not also open the row's link.
        onClickCapture={(e) => {
          if (moved.current || offset) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
            if (offset) setOffset(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
