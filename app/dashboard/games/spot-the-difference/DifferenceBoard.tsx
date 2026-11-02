"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { DifferenceArt } from "@/components/games/DifferenceArt";
import { PICTURE_HEIGHT, PICTURE_WIDTH, differenceSpots, markTaps } from "@/lib/games/differences";
import type { DifferenceView } from "../engine";
import type { BoardProps } from "../GameShell";

type Tap = [number, number];

/**
 * Two pictures side by side (one above the other on a phone). Tap a
 * difference on either one. The taps are sent to the server, which marks
 * them the same way.
 */
export function DifferenceBoard({ view, finish, finishing }: BoardProps<DifferenceView>) {
  const [taps, setTaps] = useState<Tap[]>([]);
  const [miss, setMiss] = useState<Tap | null>(null);
  const missTimer = useRef<ReturnType<typeof setTimeout>>();
  const spots = useMemo(() => differenceSpots(view.left, view.right), [view]);
  const result = useMemo(() => markTaps(spots, taps, view.mistakes), [spots, taps, view.mistakes]);
  const left = view.mistakes - result.mistakes;

  useEffect(() => {
    if (result.over) finish(taps);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish once, when the game is over
  }, [result.over]);
  useEffect(() => () => clearTimeout(missTimer.current), []);

  function tap(e: React.MouseEvent<HTMLDivElement>) {
    if (result.over || finishing) return;
    const box = e.currentTarget.getBoundingClientRect();
    const point: Tap = [
      Math.round(((e.clientX - box.left) / box.width) * PICTURE_WIDTH * 10) / 10,
      Math.round(((e.clientY - box.top) / box.height) * PICTURE_HEIGHT * 10) / 10,
    ];
    const next = [...taps, point];
    const outcome = markTaps(spots, next, view.mistakes).taps.at(-1);
    if (outcome === -1) {
      setMiss(point);
      clearTimeout(missTimer.current);
      missTimer.current = setTimeout(() => setMiss(null), 700);
      if (typeof navigator !== "undefined") navigator.vibrate?.(60);
    }
    setTaps(next);
  }

  const marks = (
    <>
      {result.found.map((i) => (
        <circle key={i} cx={spots[i].x} cy={spots[i].y} r={spots[i].r} fill="none" stroke="#16a34a" strokeWidth="1.6" />
      ))}
      {miss && (
        <g transform={`translate(${miss[0]} ${miss[1]})`} stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round">
          <line x1="-4" y1="-4" x2="4" y2="4" />
          <line x1="4" y1="-4" x2="-4" y2="4" />
        </g>
      )}
    </>
  );

  return (
    <div className="card-elevated rounded-2xl p-4 sm:p-6">
      <p className="font-display text-lg font-semibold">{view.title}</p>
      <p className="text-xs text-ink/60">{view.reference}</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm" role="status">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Check aria-hidden className="h-4 w-4 text-green-600" />
          Found {result.found.length} of {view.count}
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink/70">
          <X aria-hidden className="h-4 w-4 text-danger" />
          {left} wrong {left === 1 ? "tap" : "taps"} left
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[view.left, view.right].map((objects, i) => (
          <div
            key={i}
            onClick={tap}
            aria-label={i === 0 ? "First picture" : "Second picture"}
            className="cursor-crosshair touch-manipulation select-none overflow-hidden rounded-xl border border-line"
          >
            <DifferenceArt background={view.background} objects={objects}>
              {marks}
            </DifferenceArt>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-ink/60">Tap anything that&apos;s different in either picture. Things can be missing, a different colour or size, turned round or moved.</p>

      {!result.over && (
        <button type="button" className="btn-ghost btn-sm mt-3" onClick={() => finish(taps)} disabled={finishing}>
          Give up
        </button>
      )}
    </div>
  );
}
