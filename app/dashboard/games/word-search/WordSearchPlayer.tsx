"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { generatePuzzle, WordSearchPuzzle } from "./generator";
import { submitQuizAttempt } from "../quiz/actions";

interface Cell {
  row: number;
  col: number;
}

// The puzzle is generated after mount (not during render) so the server and
// browser don't produce two different random grids (hydration mismatch).
// "Play again" bumps `game`, which remounts the board with fresh state.
export function WordSearchPlayer() {
  const [game, setGame] = useState(0);
  const [puzzle, setPuzzle] = useState<WordSearchPuzzle | null>(null);
  useEffect(() => setPuzzle(generatePuzzle(12, 8)), [game]);

  if (!puzzle) {
    return <div className="h-80 max-w-md rounded-2xl bg-ink/[0.06] animate-pulse motion-reduce:animate-none" aria-busy="true" />;
  }
  return <WordSearchBoard key={game} puzzle={puzzle} onPlayAgain={() => { setPuzzle(null); setGame((g) => g + 1); }} />;
}

function WordSearchBoard({ puzzle, onPlayAgain }: { puzzle: WordSearchPuzzle; onPlayAgain: () => void }) {
  const router = useRouter();
  const [start, setStart] = useState<Cell | null>(null);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const allFound = found.size === puzzle.words.length;

  function cellKey(r: number, c: number) {
    return `${r}-${c}`;
  }

  function handleCellClick(row: number, col: number) {
    if (!start) {
      setStart({ row, col });
      return;
    }

    const cells = cellsBetween(start, { row, col });
    if (cells) {
      const forward = cells.map((c) => puzzle.grid[c.row][c.col]).join("");
      const backward = [...forward].reverse().join("");

      const match = puzzle.words.find(
        (w) => (w.word === forward || w.word === backward) && !found.has(w.word)
      );

      if (match) {
        setFound((f) => new Set(f).add(match.word));
        setFoundCells((fc) => {
          const next = new Set(fc);
          cells.forEach((c) => next.add(cellKey(c.row, c.col)));
          return next;
        });
      }
    }
    setStart(null);
  }

  async function handleFinish() {
    await submitQuizAttempt(found.size, puzzle.words.length, "word_search");
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="max-w-md text-center py-8">
        <p className="text-3xl font-semibold mb-2">
          {found.size} / {puzzle.words.length} words found
        </p>
        <div className="flex gap-2 justify-center mt-4">
          <button onClick={onPlayAgain} className="bg-ember text-white px-5 py-2.5 rounded-lg text-sm font-medium">
            Play again
          </button>
          <button
            onClick={() => router.push("/dashboard/games")}
            className="border border-ink/20 px-5 py-2.5 rounded-lg text-sm font-medium"
          >
            Back to scoreboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <p className="text-xs text-ink/40 mb-3">
        Tap a letter to start, tap another to select a line. Found:{" "}
        {found.size} / {puzzle.words.length}
      </p>

      <div className="flex gap-6 flex-wrap">
        <div
          className="grid gap-0.5 select-none"
          style={{ gridTemplateColumns: `repeat(${puzzle.grid.length}, minmax(0, 1fr))`, maxWidth: 360 }}
        >
          {puzzle.grid.map((row, r) =>
            row.map((letter, c) => {
              const isFound = foundCells.has(cellKey(r, c));
              const isStart = start?.row === r && start?.col === c;
              return (
                <button
                  key={cellKey(r, c)}
                  onClick={() => handleCellClick(r, c)}
                  className={`aspect-square text-xs font-medium rounded ${
                    isFound
                      ? "bg-ember text-white"
                      : isStart
                      ? "bg-ink/20 text-ink"
                      : "bg-white/70 border border-ink/10 text-ink hover:bg-ink/5"
                  }`}
                >
                  {letter}
                </button>
              );
            })
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">Find these words</p>
          <ul className="text-sm space-y-1">
            {puzzle.words.map((w) => (
              <li key={w.word} className={found.has(w.word) ? "line-through text-ink/30" : "text-ink/80"}>
                {w.word}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {allFound && (
        <button onClick={handleFinish} className="mt-6 bg-ember text-white px-6 py-3 rounded-lg font-medium">
          Finish
        </button>
      )}
      {!allFound && (
        <button onClick={handleFinish} className="mt-6 text-sm text-ink/40">
          Give up and submit current score
        </button>
      )}
    </div>
  );
}

function cellsBetween(a: Cell, b: Cell): Cell[] | null {
  const dRow = Math.sign(b.row - a.row);
  const dCol = Math.sign(b.col - a.col);
  const rowDist = Math.abs(b.row - a.row);
  const colDist = Math.abs(b.col - a.col);

  if (rowDist !== 0 && colDist !== 0 && rowDist !== colDist) return null;
  if (rowDist === 0 && colDist === 0) return null;

  const length = Math.max(rowDist, colDist) + 1;
  const cells: Cell[] = [];
  for (let i = 0; i < length; i++) {
    cells.push({ row: a.row + dRow * i, col: a.col + dCol * i });
  }
  return cells;
}
