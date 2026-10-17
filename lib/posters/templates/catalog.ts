import type { PosterDesign } from "../design";
import { fullPhoto, photo, shape, text, type Frame } from "./kit";

// The 16 original Poster Studio templates. Every design here was made for
// this app: type, colour, simple shapes and labelled photo slots — no copied
// artwork or stock photos. Scripture quotes are public-domain translations
// (WEB, or KJV where noted). Each template is a function of the poster's
// size (see kit.ts), so one definition serves square, portrait, story and A4.

export type Occasion = "Services" | "Events" | "Seasons" | "Groups" | "General";

export interface TemplateDefinition {
  key: string;
  name: string;
  occasion: Occasion;
  description: string;
  build: (f: Frame) => Pick<PosterDesign, "background" | "elements">;
}

export const TEMPLATE_DEFINITIONS: readonly TemplateDefinition[] = [
  {
    key: "sunday-service",
    name: "Sunday Service",
    occasion: "Services",
    description: "Your church photo with a calm, classic invitation",
    build: (f) => ({
      background: { color: "#0b1020" },
      elements: [
        fullPhoto(f, "Add a photo of your church or congregation", { color: "#0b1020", opacity: 0.72 }),
        text(f, "church", "Church name", "Your church", { y: 0.14, size: 30, font: "Manrope", weight: 700, color: "#f3e6c8", upper: true, ls: 8 }),
        text(f, "title", "Title", "Sunday\nService", { y: 0.28, size: 150, font: "Playfair Display", weight: 700, color: "#ffffff", lh: 1 }),
        shape(f, "rule", "Divider", "line", { x: 470, y: 0.6, w: 140, stroke: "#c9aa6a", strokeWidth: 4 }),
        text(f, "times", "Service times", "Every Sunday · 09:00 & 11:00", { y: 0.65, size: 44, font: "Manrope", weight: 800, color: "#ffffff" }),
        text(f, "address", "Address", "123 Church Street, Your Town", { y: 0.73, size: 30, font: "Manrope", weight: 500, color: "#f1eee8" }),
        text(f, "welcome", "Welcome line", "All are welcome", { y: 0.84, size: 54, font: "Dancing Script", weight: 600, color: "#f3e6c8" }),
      ],
    }),
  },
  {
    key: "guest-speaker",
    name: "Guest Speaker",
    occasion: "Events",
    description: "A large speaker photo with name and title",
    build: (f) => ({
      background: { color: "#f4efe6" },
      elements: [
        shape(f, "band", "Top band", "rect", { x: 0, y: 0, w: 1080, hf: 0.46, fill: "#1b2a4a", locked: true }),
        text(f, "eyebrow", "Label", "Guest speaker", { y: 0.07, size: 28, font: "Manrope", weight: 700, color: "#e2cda0", upper: true, ls: 8 }),
        text(f, "event", "Event", "Special Service", { y: 0.12, size: 84, font: "Playfair Display", weight: 700, color: "#ffffff" }),
        photo(f, "speaker-photo", "Speaker photo", "Add the speaker's photo", { x: 350, y: 0.27, w: 380, shape: "circle", border: { color: "#f4efe6", width: 10 } }),
        text(f, "name", "Speaker name", "Pastor Name Surname", { y: 0.66, size: 62, font: "Oswald", weight: 600, color: "#1b2a4a", upper: true, ls: 1 }),
        text(f, "role", "Speaker title", "Senior Pastor, Grace Church", { y: 0.735, size: 32, font: "Manrope", weight: 500, color: "#5b616e" }),
        text(f, "date", "Date and time", "Sunday 9 November · 10:00", { y: 0.82, size: 40, font: "Manrope", weight: 800, color: "#1b2a4a" }),
        text(f, "venue", "Venue", "Main auditorium", { y: 0.88, size: 30, font: "Manrope", weight: 500, color: "#5b616e" }),
      ],
    }),
  },
  {
    key: "revival",
    name: "Revival",
    occasion: "Events",
    description: "Bold, high-energy nights with a fire motif",
    build: (f) => ({
      background: { color: "#120402", gradient: { from: "#3a0d05", to: "#050100", angle: 180 } },
      elements: [
        shape(f, "flame-1", "Flame", "triangle", { x: 190, y: 0.5, w: 700, h: 620, fill: "#ff5a1f", opacity: 0.3, locked: true }),
        shape(f, "flame-2", "Flame", "triangle", { x: 330, y: 0.6, w: 420, h: 460, fill: "#ffb347", opacity: 0.32, locked: true }),
        text(f, "eyebrow", "Label", "Three nights of", { y: 0.12, size: 32, font: "Manrope", weight: 700, color: "#ffb347", upper: true, ls: 10 }),
        text(f, "title", "Title", "Revival", { y: 0.17, size: 230, font: "Anton", color: "#ffffff", upper: true, ls: 6 }),
        text(f, "tagline", "Tagline", "Come expectant. Leave transformed.", { y: 0.43, size: 38, font: "Manrope", weight: 600, color: "#ffd9b0" }),
        text(f, "dates", "Dates", "12–14 November · 18:30 nightly", { y: 0.78, size: 52, font: "Oswald", weight: 600, color: "#ffffff", upper: true }),
        text(f, "venue", "Venue", "Main auditorium · Free entry", { y: 0.86, size: 30, font: "Manrope", weight: 600, color: "#ffe8d4" }),
      ],
    }),
  },
  {
    key: "youth-night",
    name: "Youth Night",
    occasion: "Groups",
    description: "Bright, playful type for teens",
    build: (f) => ({
      background: { color: "#7c3aed", gradient: { from: "#5b21b6", to: "#db2777", angle: 135 } },
      elements: [
        shape(f, "dot", "Circle", "ellipse", { x: 740, y: 0.04, w: 400, fill: "#fbbf24", opacity: 0.95 }),
        shape(f, "ring", "Ring", "ellipse", { x: -120, y: 0.82, w: 360, fill: null, stroke: "#fde68a", strokeWidth: 14, opacity: 0.8 }),
        text(f, "title", "Title", "Youth\nNight", {
          y: 0.17,
          x: 80,
          w: 920,
          size: 190,
          font: "League Spartan",
          weight: 900,
          color: "#ffffff",
          align: "left",
          lh: 0.92,
          upper: true,
          shadow: { color: "#3b0764", blur: 0, offsetX: 8, offsetY: 8, opacity: 1 },
        }),
        text(f, "tagline", "Tagline", "Games · Worship · Pizza", { y: 0.53, x: 80, size: 46, font: "Manrope", weight: 800, color: "#fde68a", align: "left" }),
        shape(f, "sticker", "Date sticker", "rect", { x: 80, y: 0.66, w: 640, h: 120, fill: "#111827", radius: 60, rotation: -3 }),
        text(f, "date", "Date and time", "Friday · 18:30", { y: 0.675, x: 120, w: 580, size: 56, font: "League Spartan", weight: 800, color: "#ffffff", align: "left", rotation: -3 }),
        text(f, "venue", "Venue", "Youth hall · Ages 13–19", { y: 0.83, x: 80, size: 32, font: "Manrope", weight: 700, color: "#ffffff", align: "left" }),
      ],
    }),
  },
  {
    key: "worship-night",
    name: "Worship Night",
    occasion: "Services",
    description: "Dark, concert-style with soft light beams",
    build: (f) => ({
      background: { color: "#0d1220", gradient: { from: "#1b2a4a", to: "#070a12", angle: 160 } },
      elements: [
        shape(f, "beam-left", "Light beam", "triangle", { x: 120, y: -0.07, w: 360, h: 900, rotation: -12, opacity: 0.16, fill: "#e2cda0", locked: true }),
        shape(f, "beam-right", "Light beam", "triangle", { x: 600, y: -0.07, w: 360, h: 900, rotation: 12, opacity: 0.12, fill: "#e2cda0", locked: true }),
        text(f, "church", "Church name", "Your church presents", { y: 0.157, size: 30, font: "Manrope", weight: 600, color: "#c9aa6a", upper: true, ls: 8 }),
        text(f, "title", "Title", "Worship\nNight", { y: 0.278, size: 150, font: "Playfair Display", weight: 700, color: "#ffffff", lh: 1 }),
        shape(f, "rule", "Divider", "line", { x: 470, y: 0.593, w: 140, stroke: "#c9aa6a", strokeWidth: 4 }),
        text(f, "subtitle", "Subtitle", "An evening of praise and prayer", { y: 0.63, x: 140, w: 800, size: 40, font: "Manrope", weight: 500, color: "#e8e4da" }),
        text(f, "date", "Date and time", "Friday 24 October · 18:30", { y: 0.77, x: 140, w: 800, size: 44, font: "Manrope", weight: 800, color: "#ffffff", ls: 1 }),
        text(f, "venue", "Venue", "Main auditorium · Everyone welcome", { y: 0.83, x: 140, w: 800, size: 32, font: "Manrope", weight: 500, color: "#b9b4a8" }),
      ],
    }),
  },
  {
    key: "prayer-night",
    name: "Prayer Night",
    occasion: "Services",
    description: "Quiet, candle-lit tones for a vigil",
    build: (f) => ({
      background: { color: "#1a0e05", gradient: { from: "#2b1608", to: "#0d0703", angle: 180 } },
      elements: [
        shape(f, "glow", "Glow", "ellipse", { x: 290, y: 0.08, w: 500, fill: "#f59e0b", opacity: 0.16, locked: true }),
        shape(f, "flame", "Candle flame", "ellipse", { x: 512, y: 0.2, w: 56, h: 84, fill: "#fcd34d", opacity: 0.95 }),
        shape(f, "candle", "Candle", "rect", { x: 515, y: 0.285, w: 50, h: 120, fill: "#fff7ed", radius: 6, opacity: 0.9 }),
        text(f, "title", "Title", "Prayer\nNight", { y: 0.42, size: 160, font: "Cormorant Garamond", weight: 600, italic: true, color: "#fff7ed", lh: 0.95 }),
        text(f, "verse", "Scripture", "“Call to me, and I will answer you.”\nJeremiah 33:3", { y: 0.7, size: 36, font: "Cormorant Garamond", weight: 500, italic: true, color: "#fcd9a8", lh: 1.3 }),
        text(f, "date", "Date and time", "Friday 7 November · 19:00", { y: 0.82, size: 38, font: "Manrope", weight: 700, color: "#ffffff" }),
        text(f, "venue", "Venue", "Prayer room · All welcome", { y: 0.875, size: 28, font: "Manrope", weight: 500, color: "#e7c9a3" }),
      ],
    }),
  },
  {
    key: "conference",
    name: "Conference",
    occasion: "Events",
    description: "Multi-speaker line-up with dates and venue",
    build: (f) => ({
      background: { color: "#ffffff" },
      elements: [
        shape(f, "band", "Top band", "rect", { x: 0, y: 0, w: 1080, hf: 0.42, fill: "#1b2a4a", locked: true }),
        text(f, "eyebrow", "Label", "Annual conference", { y: 0.07, size: 28, font: "Manrope", weight: 700, color: "#c9aa6a", upper: true, ls: 8 }),
        text(f, "title", "Title", "Kingdom\nConference", { y: 0.12, size: 104, font: "Montserrat", weight: 900, color: "#ffffff", lh: 0.95, upper: true }),
        text(f, "year", "Year", "2026", { y: 0.33, size: 56, font: "Montserrat", weight: 300, color: "#e2cda0", ls: 12 }),
        ...[0, 1, 2].flatMap((i) => [
          photo(f, `speaker-${i + 1}-photo`, `Speaker ${i + 1} photo`, "Speaker photo", { x: 110 + i * 320, y: 0.47, w: 220, shape: "circle", border: { color: "#c9aa6a", width: 4 } }),
          text(f, `speaker-${i + 1}-name`, `Speaker ${i + 1} name`, `Speaker ${i + 1}`, { y: 0.7, x: 70 + i * 320, w: 300, size: 30, font: "Manrope", weight: 800, color: "#1b2a4a" }),
          text(f, `speaker-${i + 1}-role`, `Speaker ${i + 1} title`, "Title or church", { y: 0.74, x: 70 + i * 320, w: 300, size: 22, font: "Manrope", weight: 500, color: "#5b616e" }),
        ]),
        text(f, "dates", "Dates", "20–22 March · Doors 08:30", { y: 0.83, size: 46, font: "Oswald", weight: 600, color: "#1b2a4a", upper: true }),
        text(f, "venue", "Venue", "Grace Convention Centre · Register at the welcome desk", { y: 0.9, x: 60, w: 960, size: 26, font: "Manrope", weight: 500, color: "#5b616e" }),
      ],
    }),
  },
  {
    key: "womens-conference",
    name: "Women's Conference",
    occasion: "Groups",
    description: "Elegant script and serif with soft accents",
    build: (f) => ({
      background: { color: "#f8ece8" },
      elements: [
        shape(f, "accent-1", "Accent circle", "ellipse", { x: -120, y: -0.05, w: 420, fill: "#e8b4b8", opacity: 0.5, locked: true }),
        shape(f, "accent-2", "Accent circle", "ellipse", { x: 820, y: 0.78, w: 380, fill: "#c9aa6a", opacity: 0.25, locked: true }),
        text(f, "eyebrow", "Label", "Women's conference", { y: 0.14, size: 28, font: "Manrope", weight: 700, color: "#9d4b5b", upper: true, ls: 8 }),
        text(f, "title", "Title", "Women of\nGrace", { y: 0.2, size: 170, font: "Great Vibes", color: "#7a2e3e", lh: 0.95 }),
        text(f, "theme", "Theme", "“Strength and dignity are her clothing.”\nProverbs 31:25", { y: 0.53, x: 120, w: 840, size: 36, font: "Playfair Display", weight: 500, italic: true, color: "#7a2e3e", lh: 1.3 }),
        shape(f, "rule", "Divider", "line", { x: 460, y: 0.67, w: 160, stroke: "#c9aa6a", strokeWidth: 3 }),
        text(f, "date", "Date and time", "Saturday 18 October · 09:00", { y: 0.72, size: 40, font: "Manrope", weight: 800, color: "#3f1d24" }),
        text(f, "venue", "Venue", "Church hall · Tickets R150 incl. lunch", { y: 0.78, size: 30, font: "Manrope", weight: 500, color: "#7a5a60" }),
      ],
    }),
  },
  {
    key: "mens-breakfast",
    name: "Men's Breakfast",
    occasion: "Groups",
    description: "Strong type and warm tones",
    build: (f) => ({
      background: { color: "#1f1f1f" },
      elements: [
        shape(f, "band", "Accent band", "rect", { x: 0, y: 0.7, w: 1080, hf: 0.3, fill: "#c2410c", locked: true }),
        text(f, "eyebrow", "Label", "Men's ministry", { y: 0.12, size: 30, font: "Manrope", weight: 700, color: "#fdba74", upper: true, ls: 8 }),
        text(f, "title", "Title", "Men's\nBreakfast", { y: 0.18, size: 200, font: "Bebas Neue", color: "#ffffff", lh: 0.88, upper: true }),
        text(f, "verse", "Scripture", "“Iron sharpens iron.” Proverbs 27:17", { y: 0.55, size: 36, font: "Manrope", weight: 600, color: "#d6d3d1" }),
        text(f, "date", "Date and time", "Saturday 15 Nov · 07:30", { y: 0.75, size: 70, font: "Bebas Neue", color: "#ffffff", upper: true, ls: 2 }),
        text(f, "venue", "Venue", "Church hall · Bring a friend", { y: 0.85, size: 32, font: "Manrope", weight: 600, color: "#ffedd5" }),
      ],
    }),
  },
  {
    key: "baptism",
    name: "Baptism Sunday",
    occasion: "Services",
    description: "Fresh blues and a water motif",
    build: (f) => ({
      background: { color: "#e0f2fe", gradient: { from: "#e0f2fe", to: "#ffffff", angle: 180 } },
      elements: [
        shape(f, "wave-1", "Wave", "ellipse", { x: -200, y: 0.74, w: 1500, h: 520, fill: "#38bdf8", opacity: 0.35, locked: true }),
        shape(f, "wave-2", "Wave", "ellipse", { x: -320, y: 0.82, w: 1720, h: 520, fill: "#0284c7", opacity: 0.5, locked: true }),
        text(f, "title", "Title", "Baptism\nSunday", { y: 0.16, size: 160, font: "DM Serif Display", color: "#0c4a6e", lh: 0.95 }),
        text(f, "verse", "Scripture", "“…so we also might walk in newness of life.”\nRomans 6:4", { y: 0.47, x: 120, w: 840, size: 34, font: "Lora", weight: 500, italic: true, color: "#075985", lh: 1.35 }),
        text(f, "date", "Date and time", "Sunday 30 November · 10:00", { y: 0.6, size: 42, font: "Manrope", weight: 800, color: "#0c4a6e" }),
        text(f, "venue", "Venue", "Main service · Celebrate with us", { y: 0.66, size: 30, font: "Manrope", weight: 500, color: "#0369a1" }),
      ],
    }),
  },
  {
    key: "easter",
    name: "Easter",
    occasion: "Seasons",
    description: "Sunrise, the cross and “He is risen”",
    build: (f) => ({
      background: { color: "#fcd34d", gradient: { from: "#fde68a", to: "#fb923c", angle: 180 } },
      elements: [
        shape(f, "sun", "Sun", "ellipse", { x: 340, y: 0.24, w: 400, fill: "#fff7ed", opacity: 0.7, locked: true }),
        shape(f, "cross-upright", "Cross", "rect", { x: 515, y: 0.18, w: 50, h: 420, fill: "#3f2a1d" }),
        shape(f, "cross-beam", "Cross", "rect", { x: 405, y: 0.26, w: 270, h: 50, fill: "#3f2a1d" }),
        text(f, "title", "Title", "He is Risen", { y: 0.64, size: 108, font: "Cinzel", weight: 700, color: "#3f2a1d" }),
        text(f, "times", "Service times", "Easter Sunday · 06:00 sunrise & 09:00", { y: 0.79, size: 36, font: "Manrope", weight: 700, color: "#4a2c17" }),
        text(f, "venue", "Venue", "Join us as we celebrate the empty tomb", { y: 0.85, size: 28, font: "Manrope", weight: 500, color: "#5c3a1e" }),
      ],
    }),
  },
  {
    key: "christmas",
    name: "Christmas",
    occasion: "Seasons",
    description: "Carols by candlelight in a warm night palette",
    build: (f) => ({
      background: { color: "#06261c", gradient: { from: "#0b3d2e", to: "#04140f", angle: 180 } },
      elements: [
        ...(
          [
            [120, 0.08, 90],
            [860, 0.12, 60],
            [760, 0.36, 120],
            [60, 0.5, 70],
            [900, 0.62, 80],
            [200, 0.86, 110],
          ] as const
        ).map(([x, y, w], i) => shape(f, `light-${i + 1}`, "Light", "ellipse", { x, y, w, fill: "#fde68a", opacity: 0.18, locked: true })),
        text(f, "eyebrow", "Label", "Join us for", { y: 0.16, size: 30, font: "Manrope", weight: 600, color: "#e2cda0", upper: true, ls: 8 }),
        text(f, "title", "Title", "Carols by\nCandlelight", { y: 0.22, size: 150, font: "Great Vibes", color: "#fef3c7", lh: 1 }),
        text(f, "subtitle", "Subtitle", "A Christmas evening for the whole family", { y: 0.56, size: 34, font: "Manrope", weight: 500, color: "#d1fae5" }),
        text(f, "date", "Date and time", "Sunday 21 December · 18:30", { y: 0.7, size: 42, font: "Manrope", weight: 800, color: "#ffffff" }),
        text(f, "venue", "Venue", "Church lawn · Bring a blanket", { y: 0.76, size: 30, font: "Manrope", weight: 500, color: "#a7f3d0" }),
      ],
    }),
  },
  {
    key: "kids-club",
    name: "Kids Club",
    occasion: "Groups",
    description: "Colourful and rounded for children's events",
    build: (f) => ({
      background: { color: "#fde047" },
      elements: [
        shape(f, "dot-red", "Circle", "ellipse", { x: -80, y: -0.04, w: 300, fill: "#ef4444", locked: true }),
        shape(f, "dot-blue", "Circle", "ellipse", { x: 820, y: 0.1, w: 240, fill: "#3b82f6", locked: true }),
        shape(f, "dot-green", "Circle", "ellipse", { x: 860, y: 0.8, w: 300, fill: "#22c55e", locked: true }),
        shape(f, "dot-purple", "Circle", "ellipse", { x: -60, y: 0.84, w: 220, fill: "#a855f7", locked: true }),
        text(f, "title", "Title", "Holiday\nKids Club", { y: 0.2, size: 128, font: "Pacifico", color: "#1e3a8a", lh: 1.15 }),
        text(f, "tagline", "Tagline", "Songs · Crafts · Bible stories · Games", { y: 0.53, size: 38, font: "Manrope", weight: 800, color: "#1e293b" }),
        shape(f, "sticker", "Info sticker", "rect", { x: 190, y: 0.63, w: 700, h: 110, fill: "#ffffff", radius: 55 }),
        text(f, "details", "Ages and dates", "Ages 4–12 · 8–12 December", { y: 0.648, x: 190, w: 700, size: 40, font: "Manrope", weight: 800, color: "#1e3a8a" }),
        text(f, "venue", "Venue", "Church hall · 09:00–12:00 · Free", { y: 0.78, size: 30, font: "Manrope", weight: 600, color: "#1e293b" }),
      ],
    }),
  },
  {
    key: "bible-study",
    name: "Bible Study Series",
    occasion: "General",
    description: "Clean and editorial for a teaching series",
    build: (f) => ({
      background: { color: "#faf7f2" },
      elements: [
        text(f, "number", "Series number", "01", { y: 0.15, x: 90, size: 230, font: "Playfair Display", weight: 700, color: "#ece4d6", align: "left" }),
        text(f, "eyebrow", "Label", "Bible study series", { y: 0.12, x: 90, size: 28, font: "Manrope", weight: 700, color: "#7d6229", align: "left", upper: true, ls: 6 }),
        text(f, "title", "Series title", "Romans", { y: 0.3, x: 90, size: 140, font: "Playfair Display", weight: 700, color: "#14161a", align: "left" }),
        text(f, "subtitle", "Subtitle", "The gospel of grace, chapter by chapter", { y: 0.46, x: 90, w: 800, size: 38, font: "Manrope", weight: 500, color: "#5b616e", align: "left" }),
        shape(f, "rule", "Divider", "line", { x: 90, y: 0.56, w: 120, stroke: "#a88a4a", strokeWidth: 4 }),
        text(f, "details", "When and where", "Wednesdays · 19:00\nChurch library", { y: 0.61, x: 90, size: 40, font: "Manrope", weight: 700, color: "#14161a", align: "left", lh: 1.4 }),
        text(f, "footer", "Footer", "Bring a Bible and a friend", { y: 0.86, x: 90, size: 30, font: "Manrope", weight: 500, color: "#5b616e", align: "left" }),
      ],
    }),
  },
  {
    key: "thanksgiving",
    name: "Harvest Thanksgiving",
    occasion: "Seasons",
    description: "Earthy and golden for harvest and gratitude",
    build: (f) => ({
      background: { color: "#2c3417", gradient: { from: "#3f4a1f", to: "#1c2210", angle: 180 } },
      elements: [
        shape(f, "glow", "Glow", "ellipse", { x: 140, y: 0.72, w: 800, h: 500, fill: "#e9c46a", opacity: 0.14, locked: true }),
        text(f, "eyebrow", "Label", "Harvest", { y: 0.14, size: 32, font: "Manrope", weight: 700, color: "#e9c46a", upper: true, ls: 10 }),
        text(f, "title", "Title", "Thanksgiving\nService", { y: 0.2, size: 116, font: "Lora", weight: 700, color: "#fdf6e3", lh: 1 }),
        text(f, "verse", "Scripture", "“O give thanks unto the LORD; for he is good.”\nPsalm 107:1 (KJV)", { y: 0.47, x: 110, w: 860, size: 34, font: "Lora", weight: 500, italic: true, color: "#e9c46a", lh: 1.35 }),
        text(f, "date", "Date and time", "Sunday 2 November · 10:00", { y: 0.66, size: 42, font: "Manrope", weight: 800, color: "#ffffff" }),
        text(f, "venue", "Venue", "Main service", { y: 0.72, size: 30, font: "Manrope", weight: 500, color: "#d9d2b6" }),
        text(f, "note", "Note", "Bring a gift for our food drive", { y: 0.83, size: 48, font: "Dancing Script", weight: 600, color: "#e9c46a" }),
      ],
    }),
  },
  {
    key: "announcement",
    name: "General Announcement",
    occasion: "General",
    description: "Simple and flexible in church colours",
    build: (f) => ({
      background: { color: "#1b2a4a" },
      elements: [
        shape(f, "bar", "Accent bar", "rect", { x: 90, y: 0.1, w: 120, h: 8, fill: "#c9aa6a" }),
        text(f, "eyebrow", "Label", "Announcement", { y: 0.13, x: 90, size: 28, font: "Manrope", weight: 700, color: "#e2cda0", align: "left", upper: true, ls: 8 }),
        text(f, "title", "Headline", "Your announcement\nheadline here", { y: 0.2, x: 90, size: 84, font: "Manrope", weight: 800, color: "#ffffff", align: "left", lh: 1.05 }),
        text(f, "body", "Details", "Add the details people need: what's happening, when, where, and who to contact.", { y: 0.45, x: 90, w: 860, size: 36, font: "Manrope", weight: 500, color: "#d6dae3", align: "left", lh: 1.4 }),
        shape(f, "contact-box", "Contact box", "rect", { x: 90, y: 0.72, w: 900, h: 150, fill: "#ffffff", fillOpacity: 0.08, radius: 24 }),
        text(f, "contact", "Contact", "Questions? Call the church office on 012 345 6789", { y: 0.75, x: 130, w: 820, size: 30, font: "Manrope", weight: 600, color: "#ffffff", align: "left", lh: 1.3 }),
        text(f, "church", "Church name", "Your church", { y: 0.9, x: 90, size: 26, font: "Manrope", weight: 700, color: "#c9aa6a", align: "left", upper: true, ls: 6 }),
      ],
    }),
  },
];
