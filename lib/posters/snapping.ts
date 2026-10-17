// Snapping while dragging in the poster editor: an element's left/centre/right
// and top/middle/bottom pull to the poster's edges and centre lines and to
// other elements' edges and centres, when within `threshold` poster pixels.
// Pure; unit-tested in tests/unit/poster-editor.test.ts.

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Snap {
  /** How far to move the element to snap (0 if nothing was close). */
  dx: number;
  dy: number;
  /** Guide lines to draw: x positions of vertical lines, y positions of horizontal ones. */
  vertical: number[];
  horizontal: number[];
}

function closest(edges: number[], lines: number[], threshold: number): { delta: number; line: number } | null {
  let best: { delta: number; line: number } | null = null;
  for (const edge of edges) {
    for (const line of lines) {
      const delta = line - edge;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, line };
    }
  }
  return best;
}

export function snapBox(box: Box, others: Box[], poster: { width: number; height: number }, threshold: number): Snap {
  const xLines = [0, poster.width / 2, poster.width, ...others.flatMap((o) => [o.x, o.x + o.width / 2, o.x + o.width])];
  const yLines = [0, poster.height / 2, poster.height, ...others.flatMap((o) => [o.y, o.y + o.height / 2, o.y + o.height])];
  const x = closest([box.x, box.x + box.width / 2, box.x + box.width], xLines, threshold);
  const y = closest([box.y, box.y + box.height / 2, box.y + box.height], yLines, threshold);
  return {
    dx: x?.delta ?? 0,
    dy: y?.delta ?? 0,
    vertical: x ? [x.line] : [],
    horizontal: y ? [y.line] : [],
  };
}
