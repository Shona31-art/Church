"use client";

import { useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { JigsawArt } from "@/components/games/JigsawArt";
import { swapPieces } from "@/lib/games/jigsaw";
import { haptic } from "@/lib/haptics";
import type { JigsawView } from "../engine";
import type { BoardProps } from "../GameShell";

/**
 * Tap two pieces to swap them, or drag one onto another. Pieces in their
 * right place lock with a gold glow. Done when every piece is home.
 */
export function JigsawBoard({ view, finish, finishing }: BoardProps<JigsawView>) {
  const [order, setOrder] = useState<number[]>(view.order);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [peek, setPeek] = useState(false);
  const drag = useRef<{ from: number; moved: boolean } | null>(null);
  const n = view.size;
  const placed = order.filter((p, i) => p === i).length;
  const done = placed === n * n;

  function swap(a: number, b: number) {
    if (a === b) return;
    const next = swapPieces(order, a, b);
    setOrder(next);
    setMoves((m) => m + 1);
    setSelected(null);
    const nowHome = (next[a] === a ? 1 : 0) + (next[b] === b ? 1 : 0);
    haptic(nowHome ? "success" : "tap");
    if (next.every((p, i) => p === i)) setTimeout(() => finish(next), 900);
  }

  function slotAt(x: number, y: number) {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-slot]");
    return el ? Number(el.dataset.slot) : null;
  }

  function onPointerDown(e: React.PointerEvent, slot: number) {
    if (done || order[slot] === slot) return; // locked
    e.preventDefault();
    drag.current = { from: slot, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const over = slotAt(e.clientX, e.clientY);
    if (over !== null && over !== drag.current.from) drag.current.moved = true;
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const over = slotAt(e.clientX, e.clientY);
    if (d.moved && over !== null && over !== d.from && order[over] !== over) return swap(d.from, over);
    // A tap: choose, or swap with the chosen piece.
    if (selected === null) {
      setSelected(d.from);
      haptic("select");
    } else if (selected === d.from) setSelected(null);
    else swap(selected, d.from);
  }

  return (
    <div className="card-elevated rounded-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <button
          type="button"
          onPointerDown={() => setPeek(true)}
          onPointerUp={() => setPeek(false)}
          onPointerLeave={() => setPeek(false)}
          onKeyDown={(e) => e.key === " " && setPeek(true)}
          onKeyUp={() => setPeek(false)}
          className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line"
          aria-label="Hold to see the whole picture"
        >
          <JigsawArt scene={view.scene} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{view.title}</p>
          <p className="text-xs text-ink/60">{view.reference}</p>
          <p className="mt-1 text-sm text-ink/70">
            <span className="tabular font-semibold text-ink">
              {placed} / {n * n}
            </span>{" "}
            in place · <span className="tabular">{moves}</span> {moves === 1 ? "move" : "moves"}
          </p>
        </div>
      </div>
      <p className="mb-3 text-sm text-ink/60">Tap two pieces to swap them, or drag one onto another. Hold the small picture to peek.</p>

      <div className="relative mx-auto aspect-square w-full max-w-[26rem]">
        <div
          className="grid h-full w-full touch-none select-none gap-[2px] rounded-xl bg-line p-[2px]"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
          role="grid"
          aria-label="Jigsaw"
        >
          {order.map((piece, slot) => {
            const home = piece === slot;
            const isSelected = selected === slot;
            return (
              <button
                key={slot}
                type="button"
                data-slot={slot}
                onPointerDown={(e) => onPointerDown(e, slot)}
                onClick={(e) => {
                  // Keyboard: Enter/Space picks and swaps like a tap.
                  if (e.detail !== 0 || home || done) return;
                  if (selected === null) setSelected(slot);
                  else swap(selected, slot);
                }}
                aria-label={`Piece ${piece + 1} in space ${slot + 1}${home ? ", in the right place" : ""}${isSelected ? ", chosen" : ""}`}
                className={`relative overflow-hidden rounded-[4px] transition-transform ${isSelected ? "z-10 scale-[1.06] ring-4 ring-gold shadow-lg" : ""} ${
                  home && !done ? "ring-2 ring-inset ring-[#f6cd6a]" : ""
                } ${home ? "cursor-default" : "cursor-grab"}`}
              >
                <span
                  aria-hidden
                  className="absolute block"
                  style={{ width: `${n * 100}%`, height: `${n * 100}%`, left: `${-(piece % n) * 100}%`, top: `${-Math.floor(piece / n) * 100}%` }}
                >
                  <JigsawArt scene={view.scene} />
                </span>
              </button>
            );
          })}
        </div>
        {peek && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl shadow-xl">
            <JigsawArt scene={view.scene} />
          </div>
        )}
      </div>

      {done ? (
        <p role="status" className="mt-4 flex items-center justify-center gap-2 font-semibold text-success">
          <CheckCircle2 aria-hidden className="h-5 w-5" /> Complete in {moves} moves!
        </p>
      ) : (
        <button type="button" className="btn-ghost btn-sm mt-6" onClick={() => finish(order)} disabled={finishing}>
          {finishing ? "Saving…" : "Finish with what I've placed"}
        </button>
      )}
    </div>
  );
}
