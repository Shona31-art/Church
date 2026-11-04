import type { ShapeElement } from "../design";
import { below, icon, photo, shape, text, type Frame } from "./kit";
import type { TemplateDefinition } from "./catalog";

// Church flyers: the bold, high-energy look of modern church event flyers —
// dark or vivid gradients, stage light rays and glowing bokeh, huge condensed
// headlines crossed by a flowing script word, gold accents, a big speaker
// photo, a date block and an info strip. Every design here is original to
// this app (shapes, type and labelled photo slots; no copied artwork).
//
// Positions: x and sizes in template units (1080 wide), y as a fraction of
// the height (see kit.ts); `below()` keeps the parts of a block together.

const DEG = Math.PI / 180;

/**
 * A beam of light: a long thin triangle with its point at the source
 * (sx in units, sy as a fraction), angled `angle` degrees from straight down.
 */
function ray(f: Frame, id: string, sx: number, sy: number, angle: number, len: number, base: number, color: string, opacity: number): ShapeElement {
  // Shapes rotate about their top-left corner; place it so the point lands on the source.
  const half = (base * f.u) / 2;
  const tlx = sx * f.u - half * Math.cos(angle * DEG);
  const tly = sy * f.H - half * Math.sin(angle * DEG);
  return shape(f, id, "Light ray", "triangle", { x: tlx / f.u, y: tly / f.H, w: base, h: len, rotation: angle, fill: color, opacity });
}

/** A fan of rays from one point. */
function rays(f: Frame, prefix: string, sx: number, sy: number, from: number, to: number, count: number, color: string, opacity: number, len = 1500, base = 150): ShapeElement[] {
  return Array.from({ length: count }, (_, i) => ray(f, `${prefix}-${i}`, sx, sy, from + ((to - from) * i) / Math.max(1, count - 1), len, base, color, opacity));
}

/** Soft out-of-focus lights. Same pattern every time (no randomness), so previews match what opens. */
function bokeh(f: Frame, prefix: string, color: string, count = 12, opacity = 0.18, area: { y0: number; y1: number } = { y0: 0, y1: 1 }): ShapeElement[] {
  const spots = [
    [80, 0.08, 60], [930, 0.12, 90], [210, 0.3, 40], [990, 0.36, 50], [60, 0.52, 110], [880, 0.6, 70],
    [300, 0.72, 50], [720, 0.82, 120], [140, 0.9, 70], [520, 0.04, 45], [640, 0.48, 35], [40, 0.24, 30],
    [1000, 0.76, 40], [400, 0.94, 55], [820, 0.2, 30], [600, 0.66, 80],
  ];
  return spots.slice(0, count).map(([x, y, s], i) =>
    shape(f, `${prefix}-${i}`, "Light", "ellipse", { x, y: area.y0 + y * (area.y1 - area.y0), w: s, fill: color, opacity: opacity * (0.6 + (i % 3) * 0.25) }),
  );
}

const glow = (color: string, blur = 30, opacity = 0.9) => ({ color, blur, offsetY: 0, opacity });
const drop = (color: string, offsetY = 8, blur = 0, opacity = 1) => ({ color, blur, offsetY, opacity });

export const FLYER_TEMPLATES: readonly TemplateDefinition[] = [
  {
    key: "flyer-sunday-gold",
    name: "Sunday Worship · Gold",
    occasion: "Flyers",
    description: "Dark and gold with stage lights, a big speaker photo and a date block",
    build: (f) => {
      const date = 0.62;
      return {
        background: { color: "#050506", gradient: { from: "#2a1d06", to: "#000000", angle: 180 } },
        elements: [
          ...rays(f, "ray", 760, -0.04, -38, 38, 9, "#f5c451", 0.06),
          ...bokeh(f, "bokeh", "#f5c451", 14, 0.16),
          photo(f, "speaker-photo", "Speaker photo", "Add your pastor's photo, then Remove background", { x: 540, y: 0.2, w: 540, hf: 0.74 }),
          text(f, "church", "Church name", "Your church name", { y: 0.045, x: 70, w: 900, size: 26, font: "Montserrat", weight: 700, color: "#f5d27a", align: "left", upper: true, ls: 8 }),
          text(f, "join", "Invitation", "Join us for", { y: 0.1, x: 70, w: 600, size: 66, font: "Great Vibes", color: "#ffffff", align: "left" }),
          text(f, "title", "Title", "SUNDAY", { y: below(f, 0.1, 72), x: 55, w: 760, size: 220, font: "Anton", color: "#ffffff", align: "left", lh: 1, shadow: glow("#f5c451", 34, 0.55) }),
          text(f, "script", "Script word", "Worship", { y: below(f, 0.1, 272), x: 120, w: 720, size: 170, font: "Great Vibes", color: "#f5c451", align: "left", lh: 1, rotation: -6, shadow: drop("#000000", 6, 12, 0.8) }),
          shape(f, "pill", "Label box", "rect", { x: 70, y: below(f, 0.1, 490), w: 400, h: 66, fill: "#f5c451", radius: 6 }),
          text(f, "pill-text", "Label", "SERVICE", { y: below(f, 0.1, 496), x: 70, w: 400, size: 56, font: "Bebas Neue", color: "#1a1206", ls: 16 }),
          text(f, "day", "Day", "17", { y: below(f, date, 30), x: 70, w: 180, size: 150, font: "Anton", color: "#ffffff", align: "left", lh: 1 }),
          text(f, "month", "Month", "NOV", { y: below(f, date, 46), x: 240, w: 240, size: 64, font: "Bebas Neue", color: "#f5c451", align: "left", lh: 1 }),
          text(f, "year", "Year", "2026", { y: below(f, date, 110), x: 240, w: 240, size: 52, font: "Bebas Neue", color: "#ffffff", align: "left", lh: 1 }),
          shape(f, "date-rule", "Divider", "line", { x: 70, y: below(f, date, 200), w: 400, stroke: "#f5c451", strokeWidth: 3 }),
          text(f, "time", "Time", "10:00 AM", { y: below(f, date, 216), x: 70, w: 420, size: 60, font: "Anton", color: "#ffffff", align: "left", lh: 1 }),
          shape(f, "name-box", "Name box", "rect", { x: 590, y: 0.83, w: 440, h: 64, fill: "#0d0a04", radius: 6 }),
          text(f, "speaker", "Speaker name", "PASTOR NAME", { y: below(f, 0.83, 9), x: 590, w: 440, size: 46, font: "Bebas Neue", color: "#ffffff", ls: 4 }),
          shape(f, "bar", "Info bar", "rect", { x: 0, y: 0.94, w: 1080, hf: 0.06, fill: "#f5c451" }),
          text(f, "venue", "Venue and socials", "123 Church Street, Your Town  ·  Live on Facebook & YouTube", { y: below(f, 0.94, 14), x: 40, w: 1000, size: 24, font: "Montserrat", weight: 800, color: "#1a1206" }),
        ],
      };
    },
  },
  {
    key: "flyer-revival-fire",
    name: "Revival Night · Fire",
    occasion: "Flyers",
    description: "Blazing headline, glowing speaker circle and a date pill",
    build: (f) => ({
      background: { color: "#120200", gradient: { from: "#3d0800", to: "#000000", angle: 180 } },
      elements: [
        shape(f, "glow-1", "Glow", "ellipse", { x: 90, y: 0.3, w: 900, fill: "#ff4d00", opacity: 0.22 }),
        shape(f, "glow-2", "Glow", "ellipse", { x: 290, y: 0.4, w: 500, fill: "#ffb000", opacity: 0.2 }),
        ...rays(f, "ray", 540, 1.02, 150, 210, 7, "#ff7a1a", 0.08, 1400, 170),
        ...bokeh(f, "spark", "#ffb347", 12, 0.22),
        icon(f, "flame-l", "Flame", "flame", { x: -40, y: 0.74, w: 260, fill: "#ff5a1f", opacity: 0.35 }),
        icon(f, "flame-r", "Flame", "flame", { x: 860, y: 0.7, w: 260, fill: "#ff5a1f", opacity: 0.35 }),
        text(f, "eyebrow", "Label", "Three nights of", { y: 0.05, size: 30, font: "Montserrat", weight: 800, color: "#ffb347", upper: true, ls: 10 }),
        text(f, "title", "Title", "REVIVAL", { y: 0.09, x: 40, w: 1000, size: 240, font: "Anton", color: "#ffffff", lh: 1, shadow: glow("#ff5a00", 40, 0.95) }),
        text(f, "script", "Script word", "Night", { y: below(f, 0.09, 195), x: 470, w: 560, size: 150, font: "Great Vibes", color: "#ffc66b", lh: 1, rotation: -7, shadow: drop("#000000", 6, 10, 0.8) }),
        shape(f, "ring", "Ring", "ellipse", { x: 320, y: 0.42, w: 440, fill: null, stroke: "#ff7a1a", strokeWidth: 6 }),
        photo(f, "speaker-photo", "Speaker photo", "Add the speaker's photo, then Remove background", { x: 340, y: below(f, 0.42, 20), w: 400, shape: "circle", border: { color: "#ffc66b", width: 8 } }),
        text(f, "speaker", "Speaker name", "With Pastor Name", { y: 0.8, size: 54, font: "Bebas Neue", color: "#ffffff", ls: 4 }),
        shape(f, "pill", "Date box", "rect", { x: 210, y: 0.865, w: 660, h: 70, fill: "#b93a06", radius: 35 }),
        text(f, "dates", "Dates and time", "12–14 NOV · 6:30 PM NIGHTLY", { y: below(f, 0.865, 14), x: 210, w: 660, size: 40, font: "Oswald", weight: 600, color: "#ffffff" }),
        text(f, "venue", "Venue", "Main auditorium · Free entry · All welcome", { y: 0.945, size: 26, font: "Montserrat", weight: 600, color: "#ffd9b0" }),
      ],
    }),
  },
  {
    key: "flyer-praise-stage",
    name: "Praise & Worship · Stage",
    occasion: "Flyers",
    description: "Purple stage lights, stacked 3D headline and a gold date box",
    build: (f) => {
      const d = 0.66;
      return {
        background: { color: "#0b0a3a", gradient: { from: "#0b0a3a", to: "#7a12b8", angle: 135 } },
        elements: [
          ...rays(f, "beam-l", 60, 1.02, 150, 185, 4, "#7cf3ff", 0.1, 1500, 140),
          ...rays(f, "beam-r", 1020, 1.02, 175, 210, 4, "#ff4fd8", 0.1, 1500, 140),
          ...bokeh(f, "light", "#ffffff", 10, 0.12),
          photo(f, "speaker-photo", "Speaker photo", "Add the worship leader's photo, then Remove background", { x: 610, y: 0.18, w: 470, hf: 0.76 }),
          text(f, "church", "Church name", "Your church presents", { y: 0.05, x: 60, w: 900, size: 26, font: "Montserrat", weight: 700, color: "#cfc6ff", align: "left", upper: true, ls: 8 }),
          text(f, "line-1", "Title line 1", "PRAISE &", { y: 0.12, x: 50, w: 700, size: 150, font: "Anton", color: "#ffffff", align: "left", lh: 1, shadow: drop("#2a0050", 10) }),
          text(f, "line-2", "Title line 2", "WORSHIP", { y: below(f, 0.12, 160), x: 50, w: 760, size: 190, font: "Anton", color: "#ffd84d", align: "left", lh: 1, shadow: drop("#8a1a5a", 12) }),
          text(f, "script", "Script word", "Experience", { y: below(f, 0.12, 365), x: 110, w: 640, size: 110, font: "Great Vibes", color: "#ffffff", align: "left", lh: 1, rotation: -5, shadow: glow("#ff4fd8", 24, 0.7) }),
          shape(f, "date-box", "Date box", "rect", { x: 60, y: d, w: 220, h: 200, fill: "#ffd84d", radius: 14 }),
          text(f, "day", "Day", "25", { y: below(f, d, 14), x: 60, w: 220, size: 120, font: "Anton", color: "#1a0b3d", lh: 1 }),
          text(f, "month", "Month", "JANUARY", { y: below(f, d, 140), x: 60, w: 220, size: 44, font: "Bebas Neue", color: "#1a0b3d", ls: 3, lh: 1 }),
          text(f, "time", "Time", "10:00 AM", { y: below(f, d, 24), x: 305, w: 290, size: 60, font: "Anton", color: "#ffffff", align: "left", lh: 1 }),
          text(f, "venue", "Venue", "Main Auditorium\n123 Church Street", { y: below(f, d, 108), x: 305, w: 290, size: 24, font: "Montserrat", weight: 600, color: "#e6e0ff", align: "left", lh: 1.3 }),
          shape(f, "bar", "Info bar", "rect", { x: 0, y: 0.94, w: 1080, hf: 0.06, fill: "#000000", fillOpacity: 0.45 }),
          text(f, "socials", "Socials", "@yourchurch  ·  Live on all platforms", { y: below(f, 0.94, 16), size: 24, font: "Montserrat", weight: 700, color: "#ffffff", ls: 2 }),
        ],
      };
    },
  },
  {
    key: "flyer-communion",
    name: "Communion Sunday",
    occasion: "Flyers",
    description: "Warm candlelight, a glowing cross and an elegant script",
    build: (f) => ({
      background: { color: "#120803", gradient: { from: "#3a1c07", to: "#0b0502", angle: 180 } },
      elements: [
        shape(f, "glow", "Glow", "ellipse", { x: 140, y: 0.02, w: 800, fill: "#ff9a2e", opacity: 0.14 }),
        ...rays(f, "ray", 540, 0.16, -60, 60, 11, "#ffd27a", 0.035, 1100, 120),
        ...bokeh(f, "bokeh", "#ffcf7a", 12, 0.16),
        shape(f, "cross-glow", "Glow", "ellipse", { x: 420, y: 0.06, w: 240, fill: "#ffd27a", opacity: 0.28 }),
        icon(f, "cross", "Cross", "cross", { x: 465, y: 0.08, w: 150, fill: "#ffe2a3" }),
        text(f, "church", "Church name", "Your church name", { y: 0.285, size: 26, font: "Montserrat", weight: 700, color: "#ffffff", upper: true, ls: 10 }),
        text(f, "title", "Title", "COMMUNION", { y: 0.335, x: 40, w: 1000, size: 190, font: "Anton", color: "#ffffff", lh: 1, shadow: drop("#000000", 10, 20, 0.7) }),
        text(f, "script", "Script word", "Sunday", { y: below(f, 0.335, 178), x: 330, w: 680, size: 150, font: "Great Vibes", color: "#f5c451", lh: 1, rotation: -6, shadow: drop("#000000", 6, 12, 0.8) }),
        text(f, "time", "Time", "6:30 PM – 8:30 PM", { y: 0.68, size: 56, font: "Oswald", weight: 600, color: "#ffffff" }),
        shape(f, "rule-l", "Line", "line", { x: 150, y: 0.775, w: 140, stroke: "#c9a86a", strokeWidth: 3 }),
        shape(f, "rule-r", "Line", "line", { x: 790, y: 0.775, w: 140, stroke: "#c9a86a", strokeWidth: 3 }),
        text(f, "tagline", "Tagline", "Word · Worship · Communion", { y: below(f, 0.775, -16), x: 290, w: 500, size: 26, font: "Montserrat", weight: 600, color: "#ffffff", ls: 3 }),
        shape(f, "card", "Info card", "rect", { x: 140, y: 0.84, w: 800, h: 110, fill: "#0b0502", radius: 18 }),
        text(f, "venue", "Venue", "123 Church Street, Your Town\nEveryone is welcome", { y: below(f, 0.84, 18), x: 140, w: 800, size: 30, font: "Montserrat", weight: 700, color: "#ffffff", lh: 1.35 }),
      ],
    }),
  },
  {
    key: "flyer-bible-study-light",
    name: "Bible Study · Light",
    occasion: "Flyers",
    description: "Cream and brown with big serif type and a three-part info strip",
    build: (f) => {
      const strip = 0.72;
      const cell = (i: number, label: string, value: string) => [
        shape(f, `cell-${i}`, `${label} box`, "rect", { x: 80 + i * 315, y: strip, w: 290, h: 130, fill: "#4a2d14", radius: 14 }),
        text(f, `cell-${i}-label`, `${label} label`, label, { y: below(f, strip, 18), x: 80 + i * 315, w: 290, size: 22, font: "Montserrat", weight: 800, color: "#e8c88a", ls: 5, upper: true }),
        text(f, `cell-${i}-value`, label, value, { y: below(f, strip, 54), x: 80 + i * 315, w: 290, size: 46, font: "Oswald", weight: 600, color: "#ffffff" }),
      ];
      return {
        background: { color: "#fbf5ea", gradient: { from: "#fffaf2", to: "#ecdcc0", angle: 180 } },
        elements: [
          icon(f, "bible", "Open Bible", "open-bible", { x: 560, y: 0.36, w: 560, fill: "#c9a86a", opacity: 0.22 }),
          shape(f, "corner", "Corner", "triangle", { x: 820, y: -0.02, w: 360, h: 220, fill: "#c9a86a", opacity: 0.35, rotation: 20 }),
          text(f, "church", "Church name", "Your church name", { y: 0.05, x: 80, w: 920, size: 22, font: "Montserrat", weight: 800, color: "#6b4f2a", align: "right", ls: 6, upper: true }),
          text(f, "eyebrow", "Invitation", "Join us this Thursday", { y: 0.15, x: 80, w: 900, size: 30, font: "Montserrat", weight: 800, color: "#8a6a3a", align: "left", ls: 5, upper: true }),
          text(f, "title-1", "Title line 1", "Bible", { y: 0.2, x: 70, w: 900, size: 240, font: "DM Serif Display", color: "#3b2410", align: "left", lh: 1 }),
          text(f, "title-2", "Title line 2", "Study", { y: below(f, 0.2, 225), x: 70, w: 900, size: 240, font: "DM Serif Display", color: "#3b2410", align: "left", lh: 1 }),
          ...cell(0, "Time", "7:00 PM"),
          ...cell(1, "Place", "Hall B"),
          ...cell(2, "Date", "28 Feb"),
          text(f, "closing", "Closing line", "Bring your Bible and a friend", { y: 0.88, size: 52, font: "Dancing Script", weight: 600, color: "#6b4a1f" }),
        ],
      };
    },
  },
  {
    key: "flyer-thanksgiving-teal",
    name: "Thanksgiving Sunday",
    occasion: "Flyers",
    description: "Teal and orange, tall headline beside a speaker photo",
    build: (f) => {
      const t = 0.6;
      return {
        background: { color: "#04252b", gradient: { from: "#021a1f", to: "#0b5360", angle: 135 } },
        elements: [
          shape(f, "arc", "Arc", "ellipse", { x: 120, y: 0.55, w: 1300, fill: null, stroke: "#ff8a1e", strokeWidth: 6, opacity: 0.8 }),
          shape(f, "arc-glow", "Glow", "ellipse", { x: 500, y: 0.5, w: 700, fill: "#ff8a1e", opacity: 0.12 }),
          photo(f, "speaker-photo", "Speaker photo", "Add the host's photo, then Remove background", { x: 600, y: 0.14, w: 480, hf: 0.74 }),
          text(f, "church", "Church name", "Your church name", { y: 0.05, x: 60, w: 900, size: 26, font: "Montserrat", weight: 700, color: "#9fe3ea", align: "left", ls: 8, upper: true }),
          text(f, "title-1", "Title line 1", "THANKSGIVING", { y: 0.11, x: 55, w: 700, size: 120, font: "Bebas Neue", color: "#ffffff", align: "left", lh: 1, ls: 2 }),
          text(f, "title-2", "Title line 2", "SUNDAY", { y: below(f, 0.11, 110), x: 50, w: 700, size: 200, font: "Anton", color: "#ff8a1e", align: "left", lh: 1, shadow: drop("#021a1f", 8, 14, 0.7) }),
          text(f, "tagline", "Tagline", "Come with praise\nand a grateful heart", { y: below(f, 0.11, 335), x: 60, w: 560, size: 44, font: "Playfair Display", weight: 600, color: "#ffffff", align: "left", lh: 1.2 }),
          shape(f, "time-box", "Time box", "rect", { x: 60, y: t, w: 380, h: 84, fill: null, stroke: "#2fd0e0", strokeWidth: 3, radius: 42 }),
          text(f, "time", "Time", "10:00 AM", { y: below(f, t, 12), x: 60, w: 380, size: 58, font: "Oswald", weight: 600, color: "#ffffff", lh: 1 }),
          text(f, "host", "Host", "Host: Pastor Name", { y: below(f, t, 110), x: 60, w: 560, size: 38, font: "Playfair Display", weight: 600, color: "#ff8a1e", align: "left" }),
          text(f, "venue", "Venue", "123 Church Street, Your Town", { y: below(f, t, 170), x: 60, w: 560, size: 26, font: "Montserrat", weight: 600, color: "#cdeff3", align: "left" }),
          shape(f, "bar", "Info bar", "rect", { x: 0, y: 0.92, w: 1080, hf: 0.08, fill: "#ff8a1e" }),
          text(f, "welcome", "Footer", "Testimonies · Worship · Word — All are welcome", { y: below(f, 0.92, 24), size: 26, font: "Montserrat", weight: 800, color: "#04252b", ls: 1 }),
        ],
      };
    },
  },
  {
    key: "flyer-crossover",
    name: "Crossover Service",
    occasion: "Flyers",
    description: "New Year's Eve: bold 3D lettering, confetti and date chips",
    build: (f) => {
      const confetti = [
        [120, 0.06, "#ffcc29", 20], [300, 0.03, "#ef4444", -30], [980, 0.08, "#22d3ee", 40], [820, 0.04, "#ffcc29", 10],
        [60, 0.3, "#a855f7", 25], [1000, 0.42, "#ef4444", -15], [700, 0.62, "#22d3ee", 35], [40, 0.66, "#ffcc29", -40],
      ] as const;
      return {
        background: { color: "#1a0640", gradient: { from: "#3a0d7a", to: "#0c0420", angle: 160 } },
        elements: [
          ...rays(f, "ray", 760, -0.05, -30, 30, 7, "#c084fc", 0.08),
          ...confetti.map(([x, y, c, r], i) => shape(f, `confetti-${i}`, "Confetti", "rect", { x, y, w: 34, h: 14, fill: c, rotation: r, radius: 3 })),
          photo(f, "speaker-photo", "Speaker photo", "Add your pastor's photo, then Remove background", { x: 0, y: 0.14, w: 430, hf: 0.72 }),
          text(f, "church", "Church name", "Your church invites you to", { y: 0.05, x: 420, w: 620, size: 24, font: "Montserrat", weight: 800, color: "#e9d5ff", ls: 5, upper: true }),
          text(f, "line-1", "Title line 1", "CROSS", { y: 0.11, x: 400, w: 660, size: 190, font: "Anton", color: "#ffcc29", lh: 1, shadow: drop("#c2410c", 12), stroke: { color: "#7c2d12", width: 2 } }),
          text(f, "line-2", "Title line 2", "OVER", { y: below(f, 0.11, 195), x: 400, w: 660, size: 190, font: "Anton", color: "#ffcc29", lh: 1, shadow: drop("#c2410c", 12), stroke: { color: "#7c2d12", width: 2 } }),
          text(f, "line-3", "Title line 3", "SERVICE", { y: below(f, 0.11, 390), x: 400, w: 660, size: 140, font: "Anton", color: "#ffa94d", lh: 1, shadow: drop("#7c2d12", 10) }),
          text(f, "year", "Year", "2027", { y: below(f, 0.11, 545), x: 400, w: 660, size: 90, font: "Anton", color: "#ffffff", lh: 1, ls: 10, shadow: glow("#c084fc", 24, 0.9) }),
          shape(f, "chip-1", "Date chip", "rect", { x: 450, y: 0.76, w: 280, h: 74, fill: "#c81e1e", radius: 8 }),
          text(f, "date", "Date", "31ST DEC.", { y: below(f, 0.76, 12), x: 450, w: 280, size: 50, font: "Anton", color: "#ffffff", lh: 1 }),
          shape(f, "chip-2", "Time chip", "rect", { x: 750, y: 0.76, w: 260, h: 74, fill: "#ffffff", radius: 8 }),
          text(f, "time", "Time", "9:00 PM", { y: below(f, 0.76, 12), x: 750, w: 260, size: 50, font: "Anton", color: "#3a0d7a", lh: 1 }),
          text(f, "venue", "Venue", "Main auditorium · Come and cross over with us", { y: 0.9, x: 40, w: 1000, size: 26, font: "Montserrat", weight: 700, color: "#e9d5ff" }),
        ],
      };
    },
  },
  {
    key: "flyer-midweek",
    name: "Midweek Service",
    occasion: "Flyers",
    description: "Electric blue, glowing headline and two speaker photos",
    build: (f) => {
      const p = 0.5;
      return {
        background: { color: "#031a5c", gradient: { from: "#020e38", to: "#0a63ff", angle: 160 } },
        elements: [
          ...[0.08, 0.22, 0.4, 0.62].map((y, i) => shape(f, `streak-${i}`, "Light streak", "rect", { x: -100, y, w: 1400, h: 10 + i * 6, fill: "#7dd3fc", opacity: 0.12, rotation: -18 })),
          ...bokeh(f, "light", "#bae6fd", 10, 0.14),
          text(f, "church", "Church name", "Your church name", { y: 0.04, size: 24, font: "Montserrat", weight: 800, color: "#bae6fd", ls: 8, upper: true }),
          shape(f, "date-pill", "Date box", "rect", { x: 330, y: 0.085, w: 420, h: 56, fill: null, stroke: "#ffffff", strokeWidth: 3, radius: 28 }),
          text(f, "date", "Date and time", "WED 12 JAN · 7:00 PM", { y: below(f, 0.085, 11), x: 330, w: 420, size: 32, font: "Oswald", weight: 600, color: "#ffffff", lh: 1 }),
          text(f, "line-1", "Title line 1", "MIDWEEK", { y: 0.16, x: 40, w: 1000, size: 200, font: "Anton", color: "#ffffff", lh: 1, shadow: glow("#00e5ff", 36, 0.9) }),
          text(f, "line-2", "Title line 2", "SERVICE", { y: below(f, 0.16, 200), x: 40, w: 1000, size: 150, font: "Anton", color: "#00e5ff", lh: 1, shadow: drop("#020e38", 8) }),
          photo(f, "speaker-1", "Speaker 1 photo", "Add a speaker's photo, then Remove background", { x: 150, y: p, w: 340, shape: "circle", border: { color: "#ffffff", width: 8 } }),
          photo(f, "speaker-2", "Speaker 2 photo", "Add a speaker's photo, then Remove background", { x: 590, y: p, w: 340, shape: "circle", border: { color: "#ffffff", width: 8 } }),
          text(f, "name-1", "Speaker 1 name", "PASTOR NAME", { y: below(f, p, 360), x: 110, w: 420, size: 40, font: "Bebas Neue", color: "#ffffff", ls: 3 }),
          text(f, "name-2", "Speaker 2 name", "MINISTER NAME", { y: below(f, p, 360), x: 550, w: 420, size: 40, font: "Bebas Neue", color: "#ffffff", ls: 3 }),
          shape(f, "bar", "Info bar", "rect", { x: 0, y: 0.92, w: 1080, hf: 0.08, fill: "#00e5ff" }),
          text(f, "venue", "Venue", "123 Church Street · Live on YouTube & Facebook", { y: below(f, 0.92, 24), size: 26, font: "Montserrat", weight: 800, color: "#020e38" }),
        ],
      };
    },
  },
  {
    key: "flyer-glory",
    name: "Glory Service",
    occasion: "Flyers",
    description: "Magenta to purple with a radiant gold headline",
    build: (f) => ({
      background: { color: "#3b0a63", gradient: { from: "#9a0058", to: "#22044a", angle: 135 } },
      elements: [
        shape(f, "glow", "Glow", "ellipse", { x: 140, y: 0.2, w: 800, fill: "#ffd84d", opacity: 0.16 }),
        ...rays(f, "ray", 540, 0.4, -180, 175, 18, "#ffe08a", 0.04, 900, 110),
        ...bokeh(f, "light", "#ffe08a", 12, 0.18),
        icon(f, "crown", "Crown", "crown", { x: 470, y: 0.07, w: 140, fill: "#ffd84d" }),
        text(f, "church", "Church name", "Your church name presents", { y: 0.2, size: 26, font: "Montserrat", weight: 800, color: "#ffe4f2", ls: 8, upper: true }),
        text(f, "title", "Title", "GLORY", { y: 0.27, x: 40, w: 1000, size: 270, font: "Anton", color: "#ffd84d", lh: 1, shadow: glow("#ff9a00", 40, 0.9) }),
        shape(f, "rule-l", "Line", "line", { x: 120, y: 0.585, w: 200, stroke: "#ffd84d", strokeWidth: 4 }),
        shape(f, "rule-r", "Line", "line", { x: 760, y: 0.585, w: 200, stroke: "#ffd84d", strokeWidth: 4 }),
        text(f, "sub", "Subtitle", "SERVICE", { y: below(f, 0.585, -40), x: 320, w: 440, size: 80, font: "Bebas Neue", color: "#ffffff", ls: 18, lh: 1 }),
        text(f, "speaker", "Speaker", "with Pastor Name", { y: 0.66, size: 80, font: "Great Vibes", color: "#ffffff", shadow: drop("#2a0650", 4, 8, 0.8) }),
        text(f, "date", "Date and time", "SUNDAY 9 NOVEMBER · 9:00 AM", { y: 0.8, size: 46, font: "Oswald", weight: 600, color: "#ffffff" }),
        text(f, "venue", "Venue", "123 Church Street, Your Town", { y: 0.87, size: 28, font: "Montserrat", weight: 600, color: "#ffffff" }),
      ],
    }),
  },
  {
    key: "flyer-prayer",
    name: "Prayer Service",
    occasion: "Flyers",
    description: "Deep maroon panel, gold headline and a speaker photo",
    build: (f) => ({
      background: { color: "#1b0b10" },
      elements: [
        photo(f, "speaker-photo", "Speaker photo", "Add your pastor's photo, then Remove background", { x: 560, y: 0, w: 520, hf: 1, overlay: { color: "#1b0b10", opacity: 0.12 } }),
        shape(f, "panel", "Panel", "rect", { x: 0, y: 0, w: 520, hf: 1, fill: "#7a0f24" }),
        shape(f, "slant", "Slant", "rect", { x: 430, y: -0.05, w: 200, hf: 1.15, fill: "#7a0f24", rotation: 8 }),
        shape(f, "slant-line", "Gold edge", "rect", { x: 630, y: -0.05, w: 10, hf: 1.15, fill: "#f5c451", rotation: 8 }),
        icon(f, "hands", "Praying hands", "praying-hands", { x: 60, y: 0.06, w: 110, fill: "#f5c451", opacity: 0.9 }),
        text(f, "join", "Invitation", "Join us for", { y: 0.2, x: 60, w: 520, size: 30, font: "Montserrat", weight: 800, color: "#f5c451", align: "left", ls: 6, upper: true }),
        text(f, "title", "Title", "PRAYER", { y: below(f, 0.2, 52), x: 50, w: 560, size: 180, font: "Anton", color: "#f5c451", align: "left", lh: 1, shadow: drop("#3a0410", 8) }),
        text(f, "script", "Script word", "Service", { y: below(f, 0.2, 228), x: 120, w: 520, size: 140, font: "Great Vibes", color: "#ffffff", align: "left", lh: 1, rotation: -6 }),
        text(f, "tagline", "Tagline", "Worship · Bible Study · Word", { y: 0.6, x: 60, w: 520, size: 28, font: "Montserrat", weight: 600, color: "#ffffff", align: "left" }),
        shape(f, "when-box", "Time box", "rect", { x: 60, y: 0.67, w: 420, h: 74, fill: null, stroke: "#ffffff", strokeWidth: 3, radius: 6 }),
        text(f, "when", "When", "EVERY WEDNESDAY | 5PM – 7PM", { y: below(f, 0.67, 20), x: 60, w: 420, size: 32, font: "Oswald", weight: 600, color: "#ffffff", lh: 1 }),
        text(f, "venue", "Venue", "Main Auditorium\n123 Church Street, Your Town", { y: 0.79, x: 60, w: 500, size: 26, font: "Montserrat", weight: 600, color: "#f6d7dd", align: "left", lh: 1.35 }),
        shape(f, "name-box", "Name box", "rect", { x: 700, y: 0.9, w: 340, h: 60, fill: "#f5c451", radius: 4 }),
        text(f, "speaker", "Speaker name", "PASTOR NAME", { y: below(f, 0.9, 10), x: 700, w: 340, size: 42, font: "Bebas Neue", color: "#3a0410", ls: 4, lh: 1 }),
      ],
    }),
  },
  {
    key: "flyer-celebration-gold",
    name: "Special Sunday · Black & Gold",
    occasion: "Flyers",
    description: "Black and gold bokeh for Mother's Day, anniversaries and celebrations",
    build: (f) => ({
      background: { color: "#050505", gradient: { from: "#171207", to: "#000000", angle: 200 } },
      elements: [
        ...bokeh(f, "gold", "#e8b84a", 16, 0.22),
        photo(f, "speaker-photo", "Featured photo", "Add a photo", { x: 0, y: 0.08, w: 480, hf: 0.8 }),
        shape(f, "photo-edge", "Gold edge", "rect", { x: 476, y: 0.08, w: 8, hf: 0.8, fill: "#e8b84a" }),
        text(f, "church", "Church name", "Your church name", { y: 0.06, x: 520, w: 520, size: 24, font: "Montserrat", weight: 800, color: "#e8b84a", ls: 6, upper: true }),
        text(f, "line-1", "Title line 1", "MOTHER'S", { y: 0.13, x: 510, w: 560, size: 140, font: "Anton", color: "#e8b84a", lh: 1, shadow: drop("#000000", 8, 12, 0.8) }),
        text(f, "line-2", "Title line 2", "SUNDAY", { y: below(f, 0.13, 150), x: 510, w: 560, size: 150, font: "Anton", color: "#ffffff", lh: 1 }),
        text(f, "script", "Script word", "Service", { y: below(f, 0.13, 318), x: 560, w: 500, size: 130, font: "Great Vibes", color: "#e8b84a", lh: 1, rotation: -6, shadow: drop("#000000", 6, 10, 0.8) }),
        shape(f, "date-box", "Date box", "rect", { x: 560, y: 0.62, w: 460, h: 70, fill: null, stroke: "#e8b84a", strokeWidth: 3 }),
        text(f, "date", "Date", "SUNDAY 10 MAY", { y: below(f, 0.62, 12), x: 560, w: 460, size: 46, font: "Bebas Neue", color: "#ffffff", ls: 4, lh: 1 }),
        text(f, "time", "Time", "Service starts 10 AM", { y: 0.72, x: 520, w: 540, size: 44, font: "Oswald", weight: 600, color: "#ffffff" }),
        text(f, "speaker", "Speaker", "Ministering: Pastor Name", { y: 0.8, x: 520, w: 540, size: 30, font: "Montserrat", weight: 700, color: "#e8b84a" }),
        shape(f, "bar", "Info bar", "rect", { x: 0, y: 0.92, w: 1080, hf: 0.08, fill: "#e8b84a" }),
        text(f, "venue", "Venue", "123 Church Street · Gifts for every mother", { y: below(f, 0.92, 24), size: 26, font: "Montserrat", weight: 800, color: "#171207" }),
      ],
    }),
  },
];
