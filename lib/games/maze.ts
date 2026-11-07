// Bible maze: seeded generation and route checking (pure — unit-tested).
//
// A "perfect" maze (exactly one route between any two squares), carved with
// a depth-first search. Start is top-left, the goal bottom-right.

import type { Level } from "./catalog";
import { type Rng } from "./random";

/** Bits for open sides of a square. */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

export const MAZE_SIZES: Record<Level, number> = { easy: 8, medium: 13, hard: 19 };

/** A solved maze is worth this many "answers", so it scores like other games. */
/** Points for reaching the goal by the shortest way; wrong turns cost points (checkMaze). */
export const MAZE_POINTS = 10;

export const MAZE_THEMES = [
  { title: "Lead the Israelites through the Red Sea", start: "🚶", goal: "🏕️", reference: "Exodus 14:21-22" },
  { title: "Help the shepherd find the lost sheep", start: "🧑‍🌾", goal: "🐑", reference: "Luke 15:4-6" },
  { title: "Guide the wise men to Bethlehem", start: "🐫", goal: "⭐", reference: "Matthew 2:9-11" },
  { title: "Bring the good Samaritan to the inn", start: "🫏", goal: "🏠", reference: "Luke 10:34" },
  { title: "Help Zacchaeus reach the sycamore tree", start: "🧔", goal: "🌳", reference: "Luke 19:4" },
  { title: "Lead the prodigal son home", start: "👦", goal: "🏡", reference: "Luke 15:20" },
] as const;

export interface Maze {
  size: number;
  /** Open sides per square, row by row (bits N/E/S/W). */
  cells: number[];
  theme: number;
}

const MOVES = { U: [-1, 0, N, S], R: [0, 1, E, W], D: [1, 0, S, N], L: [0, -1, W, E] } as const;

export function buildMaze(level: Level, rng: Rng): Maze {
  const size = MAZE_SIZES[level];
  const cells = new Array<number>(size * size).fill(0);
  const seen = new Array<boolean>(size * size).fill(false);
  const stack = [0];
  seen[0] = true;
  while (stack.length) {
    const here = stack[stack.length - 1];
    const r = Math.floor(here / size);
    const c = here % size;
    const options = Object.values(MOVES)
      .map(([dr, dc, out, back]) => ({ next: (r + dr) * size + (c + dc), ok: r + dr >= 0 && r + dr < size && c + dc >= 0 && c + dc < size, out, back }))
      .filter((o) => o.ok && !seen[o.next]);
    if (!options.length) {
      stack.pop();
      continue;
    }
    const pick = options[Math.floor(rng() * options.length)];
    cells[here] |= pick.out;
    cells[pick.next] |= pick.back;
    seen[pick.next] = true;
    stack.push(pick.next);
  }
  return { size, cells, theme: Math.floor(rng() * MAZE_THEMES.length) };
}

/** Can you step from square `index` in this direction? */
export function canMove(maze: Maze, index: number, move: keyof typeof MOVES): boolean {
  return (maze.cells[index] & MOVES[move][2]) !== 0;
}

/** The fewest moves from the start (top left) to the goal (bottom right). */
export function shortestRoute(maze: Maze): number {
  const goal = maze.size * maze.size - 1;
  const dist = new Array<number>(maze.cells.length).fill(-1);
  dist[0] = 0;
  const queue = [0];
  while (queue.length) {
    const at = queue.shift()!;
    if (at === goal) return dist[at];
    for (const m of Object.keys(MOVES) as (keyof typeof MOVES)[]) {
      if (!canMove(maze, at, m)) continue;
      const next = at + MOVES[m][0] * maze.size + MOVES[m][1];
      if (dist[next] === -1) {
        dist[next] = dist[at] + 1;
        queue.push(next);
      }
    }
  }
  return 0;
}

/**
 * Follows a route of moves (U/R/D/L) from the start. Walking into a wall
 * makes the route invalid. Reaching the goal the shortest way scores
 * MAZE_POINTS; every wrong turn (two wasted steps: in and back out) costs one,
 * down to 1 for getting there at all. Not reaching the goal scores 0.
 */
export function checkMaze(maze: Maze, route: string): number {
  if (route.length > maze.size * maze.size * 4) return 0;
  let at = 0;
  for (const move of route) {
    if (!(move in MOVES)) return 0;
    const m = move as keyof typeof MOVES;
    if (!canMove(maze, at, m)) return 0;
    at += MOVES[m][0] * maze.size + MOVES[m][1];
  }
  if (at !== maze.size * maze.size - 1) return 0;
  const wasted = Math.max(0, route.length - shortestRoute(maze));
  return Math.max(1, MAZE_POINTS - Math.ceil(wasted / 2));
}

export { MOVES };
