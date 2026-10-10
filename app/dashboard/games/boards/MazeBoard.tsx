"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { E, MOVES, N, S, W, canMove } from "@/lib/games/maze";
import type { MazeView } from "../engine";
import type { BoardProps } from "../GameShell";

type Move = keyof typeof MOVES;

/**
 * Move with the arrow keys, the on-screen arrows, or by swiping. The route
 * you take is sent to the server, which walks it to check you really got there.
 */
export function MazeBoard({ view, finish, finishing }: BoardProps<MazeView>) {
  const [at, setAt] = useState(0);
  const [route, setRoute] = useState("");
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const [bump, setBump] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const goal = view.size * view.size - 1;
  const done = at === goal;

  useEffect(() => boardRef.current?.focus(), []);
  useEffect(() => {
    if (done) finish(route);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish once, when the goal is reached
  }, [done]);

  function step(move: Move) {
    if (done || finishing) return;
    if (!canMove(view, at, move)) {
      setBump(true);
      setTimeout(() => setBump(false), 150);
      return;
    }
    const next = at + MOVES[move][0] * view.size + MOVES[move][1];
    setAt(next);
    setRoute((r) => r + move);
    setVisited((v) => new Set(v).add(next));
  }

  const keyMoves: Record<string, Move> = { ArrowUp: "U", ArrowRight: "R", ArrowDown: "D", ArrowLeft: "L", w: "U", d: "R", s: "D", a: "L" };
  const cell = `clamp(1rem, calc((min(100vw, 40rem) - 5rem) / ${view.size}), 2.5rem)`;
  const row = Math.floor(at / view.size) + 1;
  const col = (at % view.size) + 1;

  return (
    <div className="card-elevated rounded-2xl p-4 sm:p-6">
      <p className="font-display text-lg font-semibold">{view.title}</p>
      <p className="text-xs text-ink/50">{view.reference}</p>

      <div
        ref={boardRef}
        tabIndex={0}
        role="application"
        aria-label={`Maze. Use the arrow keys to move. You are at row ${row}, column ${col}. The goal is the bottom-right corner.`}
        onKeyDown={(e) => {
          const move = keyMoves[e.key];
          if (move) {
            e.preventDefault();
            step(move);
          }
        }}
        onPointerDown={(e) => (swipeStart.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const start = swipeStart.current;
          swipeStart.current = null;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
          step(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "R" : "L") : dy > 0 ? "D" : "U");
        }}
        className={`mx-auto mt-4 grid w-max touch-none select-none rounded-lg border-2 border-ink/70 bg-surface p-0 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold ${
          bump ? "motion-safe:translate-x-0.5" : ""
        }`}
        style={{ gridTemplateColumns: `repeat(${view.size}, ${cell})` }}
      >
        {view.cells.map((open, i) => (
          <div
            key={i}
            aria-hidden
            className={`relative flex items-center justify-center border-ink/70 ${visited.has(i) ? "bg-gold/15" : ""}`}
            style={{
              width: cell,
              height: cell,
              borderTopWidth: open & N ? 0 : 2,
              borderRightWidth: open & E ? 0 : 2,
              borderBottomWidth: open & S ? 0 : 2,
              borderLeftWidth: open & W ? 0 : 2,
              fontSize: `calc(${cell} * 0.62)`,
            }}
          >
            {i === at ? view.start : i === goal ? view.goal : null}
          </div>
        ))}
      </div>

      <p role="status" className="sr-only">
        Row {row}, column {col}
        {done ? ". You made it!" : ""}
      </p>

      {/* On-screen arrows (and the only way to play without a keyboard or swipe). */}
      <div className="mx-auto mt-5 grid w-max grid-cols-3 gap-1.5" role="group" aria-label="Move">
        <span />
        <ArrowButton label="Up" onClick={() => step("U")}>
          <ArrowUp className="h-5 w-5" />
        </ArrowButton>
        <span />
        <ArrowButton label="Left" onClick={() => step("L")}>
          <ArrowLeft className="h-5 w-5" />
        </ArrowButton>
        <ArrowButton label="Down" onClick={() => step("D")}>
          <ArrowDown className="h-5 w-5" />
        </ArrowButton>
        <ArrowButton label="Right" onClick={() => step("R")}>
          <ArrowRight className="h-5 w-5" />
        </ArrowButton>
      </div>

      {!done && (
        <button type="button" className="btn-ghost btn-sm mt-4" onClick={() => finish(route)} disabled={finishing}>
          Give up
        </button>
      )}
    </div>
  );
}

function ArrowButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="btn-secondary btn-icon h-12 w-12">
      <span aria-hidden>{children}</span>
    </button>
  );
}
