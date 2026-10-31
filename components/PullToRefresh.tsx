"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { haptic } from "@/lib/haptics";

const TRIGGER = 72; // px of pull that refreshes
const MAX = 110;

/**
 * Pull down at the top of a page to refresh its data (router.refresh — no
 * full reload, so form drafts and scroll elsewhere are kept).
 *
 * Only in the installed app (Home Screen): phone browsers already have their
 * own pull-to-reload, and two at once would fight. Touch screens only.
 */
export function PullToRefresh({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (!standalone || !window.matchMedia("(pointer: coarse)").matches) return;

    const onStart = (e: TouchEvent) => {
      // Only from the very top, and not from inside something that scrolls itself (chat log, dialogs).
      const target = e.target as HTMLElement;
      start.current = window.scrollY <= 0 && !target.closest("[role=log], dialog, [data-no-pull]") ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const distance = e.touches[0].clientY - start.current;
      if (distance <= 0 || window.scrollY > 0) return setPull(0);
      const eased = Math.min(MAX, distance * 0.5);
      setPull(eased);
      if (eased >= TRIGGER && !armed.current) {
        armed.current = true;
        haptic("tap");
      } else if (eased < TRIGGER) armed.current = false;
    };
    const onEnd = () => {
      if (start.current === null) return;
      start.current = null;
      if (armed.current) {
        armed.current = false;
        setRefreshing(true);
        setPull(TRIGGER);
        router.refresh();
        // router.refresh() has no completion promise; the new data usually lands within a second.
        setTimeout(() => {
          setRefreshing(false);
          setPull(0);
        }, 900);
      } else setPull(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [enabled, router]);

  if (!pull && !refreshing) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-30 flex justify-center md:hidden" style={{ transform: `translateY(${pull - 40}px)` }}>
      <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-gold-deep shadow-card">
        <RefreshCw className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`} style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }} />
      </span>
      {refreshing && <span className="sr-only" role="status">Refreshing…</span>}
    </div>
  );
}
