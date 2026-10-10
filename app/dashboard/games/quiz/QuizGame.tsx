"use client";

import type { Level } from "@/lib/games/catalog";
import { GameShell } from "../GameShell";
import { QuizBoard } from "./QuizBoard";

export function QuizGame({ initialLevel }: { initialLevel?: Level }) {
  return (
    <GameShell
      game="quiz"
      initialLevel={initialLevel}
      rules="Ten multiple-choice questions. Your first answer counts — then you'll see the right one."
      Board={QuizBoard}
    />
  );
}
