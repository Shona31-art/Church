import type { HighlightColor } from "@/lib/bible/annotations";

// Highlight swatch classes, written out in full so Tailwind generates them.
// A plain module (not "use client") so both server pages (Bible home) and
// client components (reader, action bar) can import it — a value exported
// from a "use client" file reaches server components only as a reference.
export const HIGHLIGHT_BG: Record<HighlightColor, string> = {
  yellow: "bg-hl-yellow",
  green: "bg-hl-green",
  blue: "bg-hl-blue",
  pink: "bg-hl-pink",
  purple: "bg-hl-purple",
};
