// Classic jigsaw piece outlines (pure — unit-tested). Each piece is a 100×100
// square in its own coordinates; tabs stick out up to TAB units beyond it.
// Neighbouring pieces always fit: where one has a tab, the other has a hole.
// Edges round the outside of the picture are straight.

export const TAB = 28;

/** +1 = the piece above/left has a tab out, -1 = a hole. Fixed per grid size so puzzles look the same each time. */
function edgeSign(kind: "h" | "v", r: number, c: number, n: number): 1 | -1 {
  return ((r * 7 + c * 13 + (kind === "h" ? 3 : 5) + n) % 2) === 0 ? 1 : -1;
}

/** Tab directions of a piece's four edges: 1 out, -1 in, 0 straight (outside edge). */
export function pieceEdges(row: number, col: number, n: number) {
  return {
    top: row === 0 ? 0 : -edgeSign("h", row - 1, col, n),
    right: col === n - 1 ? 0 : edgeSign("v", row, col, n),
    bottom: row === n - 1 ? 0 : edgeSign("h", row, col, n),
    left: col === 0 ? 0 : -edgeSign("v", row, col - 1, n),
  };
}

// One edge, as points along it (u: 0→1) and out from it (v, in units of 100).
const CURVE: [number, number][][] = [
  [[0.38, 0], [0.36, 0.12], [0.4, 0.15]],
  [[0.3, 0.3], [0.7, 0.3], [0.6, 0.15]],
  [[0.64, 0.12], [0.62, 0], [0.65, 0]],
];

function edge(d: number, map: (u: number, v: number) => [number, number]) {
  const pt = (u: number, v: number) => map(u, v * d).map((x) => Math.round(x * 10) / 10).join(" ");
  if (d === 0) return `L ${pt(1, 0)}`;
  return [`L ${pt(0.35, 0)}`, ...CURVE.map((seg) => `C ${seg.map(([u, v]) => pt(u, v)).join(", ")}`), `L ${pt(1, 0)}`].join(" ");
}

/** The outline of the piece that belongs at (row, col) in an n×n puzzle. */
export function piecePath(row: number, col: number, n: number): string {
  const e = pieceEdges(row, col, n);
  return [
    "M 0 0",
    edge(e.top, (u, v) => [100 * u, -100 * v]),
    edge(e.right, (u, v) => [100 + 100 * v, 100 * u]),
    edge(e.bottom, (u, v) => [100 - 100 * u, 100 + 100 * v]),
    edge(e.left, (u, v) => [-100 * v, 100 - 100 * u]),
    "Z",
  ].join(" ");
}
