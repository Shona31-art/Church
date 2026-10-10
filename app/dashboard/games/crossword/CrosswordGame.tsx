"use client";

import type { Level } from "@/lib/games/catalog";
import { GameShell } from "../GameShell";
import { CrosswordBoard } from "./CrosswordBoard";

export function CrosswordGame({ initialLevel }: { initialLevel?: Level }) {
  return (
    <GameShell
      game="crossword"
      initialLevel={initialLevel}
      rules="Fill in the grid from the clues. Tap a square twice to switch between Across and Down. Each word you get fully right scores."
      Board={CrosswordBoard}
    />
  );
}
