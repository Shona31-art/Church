"use client";

import type { Level } from "@/lib/games/catalog";
import { GameShell } from "../GameShell";
import { WordSearchBoard } from "./WordSearchBoard";

export function WordSearchGame({ initialLevel }: { initialLevel?: Level }) {
  return (
    <GameShell
      game="word_search"
      initialLevel={initialLevel}
      rules="Find every Bible name and place hidden in the grid. Harder levels hide words diagonally and backwards."
      Board={WordSearchBoard}
    />
  );
}
