// Tap-to-fill for uploaded colouring pages (pure — unit-tested). The black
// outlines of the page are the walls; a fill spreads to every connected
// pixel that isn't part of a line.

/** 1 where the page has a line (dark pixel), 0 where it can be coloured. */
export function lineMask(rgba: Uint8ClampedArray, width: number, height: number, threshold = 150): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const lum = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
    mask[i] = rgba[o + 3] > 40 && lum < threshold ? 1 : 0;
  }
  return mask;
}

/**
 * Fills the area around (x, y) — every connected non-line pixel — with the
 * colour `colourAt` gives for each pixel. Returns how many pixels changed
 * (0 if you tapped a line).
 */
export function floodFill(
  rgba: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  colourAt: (x: number, y: number) => readonly [number, number, number]
): number {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height || mask[y * width + x]) return 0;
  const seen = new Uint8Array(width * height);
  const stack: number[] = [x, y];
  let filled = 0;
  while (stack.length) {
    const sy = stack.pop()!;
    let sx = stack.pop()!;
    // Run left to the start of this row's span, then fill rightwards.
    while (sx > 0 && !mask[sy * width + sx - 1] && !seen[sy * width + sx - 1]) sx--;
    let upOpen = false;
    let downOpen = false;
    for (let cx = sx; cx < width; cx++) {
      const i = sy * width + cx;
      if (mask[i] || seen[i]) break;
      seen[i] = 1;
      const [r, g, b] = colourAt(cx, sy);
      const o = i * 4;
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = 255;
      filled++;
      // Start a new span above / below where one opens up.
      if (sy > 0) {
        const ni = (sy - 1) * width + cx;
        const free = !mask[ni] && !seen[ni];
        if (free && !upOpen) stack.push(cx, sy - 1);
        upOpen = free;
      }
      if (sy < height - 1) {
        const ni = (sy + 1) * width + cx;
        const free = !mask[ni] && !seen[ni];
        if (free && !downOpen) stack.push(cx, sy + 1);
        downOpen = free;
      }
    }
  }
  return filled;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Glitter: the colour with little white sparkles (the same pattern every time). */
export function glitterAt(base: readonly [number, number, number]) {
  return (x: number, y: number): [number, number, number] => {
    const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    const k = h % 97;
    if (k < 4) return [255, 255, 255];
    if (k < 12) return [Math.min(255, base[0] + 70), Math.min(255, base[1] + 70), Math.min(255, base[2] + 70)];
    if (k < 18) return [base[0] * 0.8, base[1] * 0.8, base[2] * 0.8].map(Math.round) as [number, number, number];
    return [base[0], base[1], base[2]];
  };
}

/** Rainbow: hue sweeps diagonally across the page. */
export function rainbowAt(width: number, height: number) {
  return (x: number, y: number): [number, number, number] => {
    const t = (x / width + y / height) / 2;
    const h = t * 300;
    const c = 0.85;
    const xx = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const [r, g, b] = h < 60 ? [c, xx, 0] : h < 120 ? [xx, c, 0] : h < 180 ? [0, c, xx] : h < 240 ? [0, xx, c] : [xx, 0, c];
    const m = 0.12;
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  };
}
