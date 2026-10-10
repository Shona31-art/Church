"use client";

import type { Level } from "@/lib/games/catalog";
import { GameShell } from "../GameShell";
import { VersePuzzleBoard } from "./VersePuzzleBoard";

export function VersePuzzleGame({ initialLevel }: { initialLevel?: Level }) {
  return (
    <GameShell
      game="verse_puzzle"
      initialLevel={initialLevel}
      rules="Put each verse's words back in order. You get five tries per verse; revealing a verse shows it but scores no point."
      Board={VersePuzzleBoard}
    />
  );
}
