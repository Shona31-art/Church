"use client";

import type { GameKey, Level } from "@/lib/games/catalog";
import { GameShell, type BoardProps } from "./GameShell";
import type { GameMode } from "./actions";
import { QuizBoard } from "./quiz/QuizBoard";
import { CrosswordBoard } from "./crossword/CrosswordBoard";
import { WordSearchBoard } from "./word-search/WordSearchBoard";
import { VersePuzzleBoard } from "./verse-puzzle/VersePuzzleBoard";
import { SetBoard } from "./boards/SetBoard";
import { ScrambleBoard } from "./boards/ScrambleBoard";
import { BooksBoard } from "./boards/BooksBoard";
import { MazeBoard } from "./boards/MazeBoard";

// Each game's board and one-line rules. The shell around them (levels, timer,
// results) is shared — see GameShell.
const SCREENS: Record<GameKey, { rules: string; Board: (props: BoardProps<any>) => React.ReactNode }> = {
  quiz: { rules: "Ten multiple-choice questions. Your first answer counts — then you'll see the right one.", Board: QuizBoard },
  crossword: {
    rules: "Fill in the grid from the clues. Tap a square twice to switch between Across and Down. Each word you get fully right scores.",
    Board: CrosswordBoard,
  },
  word_search: { rules: "Find every Bible name and place hidden in the grid. Harder levels hide words diagonally and backwards.", Board: WordSearchBoard },
  emoji: { rules: "Each row of emoji tells a Bible story. Pick it — or on Hard, type it.", Board: (p) => <SetBoard {...p} promptStyle="emoji" /> },
  scramble: { rules: "Unscramble each set of letters. Easier levels give you a clue; Hard only gives the first letter.", Board: ScrambleBoard },
  verse_puzzle: {
    rules: "Put each verse's words back in order. You get five tries per verse; revealing a verse shows it but scores no point.",
    Board: VersePuzzleBoard,
  },
  verse_fill: { rules: "Find the missing words. Easier levels give you choices; on Hard, type them in order.", Board: (p) => <SetBoard {...p} promptStyle="verse" /> },
  who_said: { rules: "Who said it? Pick the person behind each saying.", Board: (p) => <SetBoard {...p} promptStyle="quote" /> },
  books_order: { rules: "Put the books of the Bible in the right order. Each book in the right place scores.", Board: BooksBoard },
  maze: { rules: "Find your way from the start (top left) to the goal (bottom right). Use the arrow keys, the arrows below the maze, or swipe.", Board: MazeBoard },
};

export function GameScreen({ game, initialLevel, mode }: { game: GameKey; initialLevel?: Level; mode: GameMode }) {
  const { rules, Board } = SCREENS[game];
  return <GameShell game={game} initialLevel={initialLevel} mode={mode} rules={rules} Board={Board} />;
}
