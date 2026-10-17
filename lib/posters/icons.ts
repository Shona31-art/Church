// Original decorative icons for posters, drawn for this app as SVG path data
// on a 100 × 100 grid (no third-party artwork). The editor draws them with
// Konva's Path at any size; the Add panel previews them as inline SVG.
// A design stores only the key (e.g. "cross"), so icons can be refined here
// later without touching saved posters.

export interface PosterIcon {
  key: string;
  label: string;
  path: string;
}

/** Points of a star/sunburst as an SVG path, centred on the 100 × 100 grid. */
function starPath(points: number, outer: number, inner: number): string {
  const coords: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    coords.push(`${(50 + radius * Math.cos(angle)).toFixed(1)} ${(50 + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return `M${coords.join(" L")} Z`;
}

export const POSTER_ICONS: readonly PosterIcon[] = [
  { key: "cross", label: "Cross", path: "M42 4h16v28h26v16H58v48H42V48H16V32h26z" },
  { key: "church", label: "Church", path: "M48 4h4v8h6v4h-6v12l30 20v48H60V76a10 10 0 0 0-20 0v20H18V48l30-20V16h-6v-4h6z" },
  { key: "open-bible", label: "Open Bible", path: "M47 26C37 18 22 16 6 18v64c16-2 31 0 41 7zM53 26c10-8 25-10 41-8v64c-16-2-31 0-41 7z" },
  { key: "dove", label: "Dove", path: "M8 56c12-6 22-6 32-2 6-14 18-28 40-36-6 14-10 24-18 34 10 0 22 4 32 12-14 2-24 2-32 0-6 10-18 16-32 14l-12 10 4-14c-8-4-12-10-14-18z" },
  { key: "flame", label: "Flame", path: "M50 4c8 20 28 30 28 56 0 20-13 36-28 36S22 80 22 62c0-14 8-22 14-32 2 12 8 18 12 20-2-16-4-30 2-46z" },
  { key: "crown", label: "Crown", path: "M10 76l8-48 18 22 14-32 14 32 18-22 8 48zM10 82h80v10H10z" },
  {
    key: "praying-hands",
    label: "Praying hands",
    path: "M50 8c-4 0-6 4-6 10l-4 38c-2 8-10 14-18 22l8 12c10-8 16-14 20-20 4 6 10 12 20 20l8-12c-8-8-16-14-18-22l-4-38c0-6-2-10-6-10z",
  },
  { key: "candle", label: "Candle", path: "M40 40h20v56H40zM50 6c6 10 10 16 10 22 0 6-5 10-10 10s-10-4-10-10c0-6 4-12 10-22z" },
  { key: "heart", label: "Heart", path: "M50 88C20 66 6 50 6 32 6 18 17 8 30 8c9 0 16 5 20 12 4-7 11-12 20-12 13 0 24 10 24 24 0 18-14 34-44 56z" },
  { key: "star", label: "Star", path: starPath(5, 46, 19) },
  { key: "sunburst", label: "Sunburst", path: starPath(16, 48, 30) },
  { key: "music", label: "Music notes", path: "M36 78a12 10 0 1 1-2-6V22l52-12v54a12 10 0 1 1-2-6V30L38 40z" },
  { key: "ichthys", label: "Fish (ichthys)", path: "M4 50C26 22 64 22 84 50 64 78 26 78 4 50zM84 50l12-16v32z" },
];

export function posterIcon(key: string): PosterIcon | undefined {
  return POSTER_ICONS.find((i) => i.key === key);
}
