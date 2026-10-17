import type { TemplateDefinition } from "./catalog";
import { photo, shape, text, icon, type Frame } from "./kit";

// Hand-made landscape (1920 × 1080) layouts for the templates most likely to
// be shown on a projector, TV, YouTube or a Facebook cover. Every other
// template gets the automatic landscape layout from kit.ts.
//
// These are built with absoluteFrame(), so x and widths are pixels across
// the 1920-px poster (u = 1 at this size); y stays a fraction of the height.

type Build = TemplateDefinition["build"];

export const LANDSCAPE_LAYOUTS: Record<string, Build> = {
  "sunday-service": (f: Frame) => ({
    background: { color: "#0b1020" },
    elements: [
      photo(f, "background-photo", "Church photo", "Add a photo of your church or congregation", { x: 960, y: 0, w: 960, hf: 1 }),
      shape(f, "panel", "Text panel", "rect", { x: 0, y: 0, w: 960, hf: 1, fill: "#0b1020", locked: true }),
      text(f, "church", "Church name", "Your church", { y: 0.16, x: 120, w: 760, size: 30, font: "Manrope", weight: 700, color: "#f3e6c8", align: "left", upper: true, ls: 8 }),
      text(f, "title", "Title", "Sunday\nService", { y: 0.24, x: 120, w: 760, size: 140, font: "Playfair Display", weight: 700, color: "#ffffff", align: "left", lh: 1 }),
      shape(f, "rule", "Divider", "line", { x: 120, y: 0.55, w: 140, stroke: "#c9aa6a", strokeWidth: 4 }),
      text(f, "times", "Service times", "Every Sunday · 09:00 & 11:00", { y: 0.6, x: 120, w: 760, size: 44, font: "Manrope", weight: 800, color: "#ffffff", align: "left" }),
      text(f, "address", "Address", "123 Church Street, Your Town", { y: 0.68, x: 120, w: 760, size: 30, font: "Manrope", weight: 500, color: "#f1eee8", align: "left" }),
      text(f, "welcome", "Welcome line", "All are welcome", { y: 0.8, x: 120, w: 760, size: 54, font: "Dancing Script", weight: 600, color: "#f3e6c8", align: "left" }),
    ],
  }),

  "worship-night": (f: Frame) => ({
    background: { color: "#0d1220", gradient: { from: "#1b2a4a", to: "#070a12", angle: 160 } },
    elements: [
      shape(f, "beam-left", "Light beam", "triangle", { x: 380, y: -0.08, w: 380, h: 1000, rotation: -14, opacity: 0.16, fill: "#e2cda0", locked: true }),
      shape(f, "beam-right", "Light beam", "triangle", { x: 1160, y: -0.08, w: 380, h: 1000, rotation: 14, opacity: 0.12, fill: "#e2cda0", locked: true }),
      text(f, "church", "Church name", "Your church presents", { y: 0.17, x: 360, w: 1200, size: 30, font: "Manrope", weight: 600, color: "#c9aa6a", upper: true, ls: 8 }),
      text(f, "title", "Title", "Worship Night", { y: 0.25, x: 160, w: 1600, size: 160, font: "Playfair Display", weight: 700, color: "#ffffff" }),
      shape(f, "rule", "Divider", "line", { x: 890, y: 0.5, w: 140, stroke: "#c9aa6a", strokeWidth: 4 }),
      text(f, "subtitle", "Subtitle", "An evening of praise and prayer", { y: 0.55, x: 360, w: 1200, size: 42, font: "Manrope", weight: 500, color: "#e8e4da" }),
      text(f, "date", "Date and time", "Friday 24 October · 18:30", { y: 0.7, x: 360, w: 1200, size: 48, font: "Manrope", weight: 800, color: "#ffffff", ls: 1 }),
      text(f, "venue", "Venue", "Main auditorium · Everyone welcome", { y: 0.78, x: 360, w: 1200, size: 32, font: "Manrope", weight: 500, color: "#b9b4a8" }),
    ],
  }),

  "guest-speaker": (f: Frame) => ({
    background: { color: "#f4efe6" },
    elements: [
      shape(f, "band", "Side band", "rect", { x: 0, y: 0, w: 760, hf: 1, fill: "#1b2a4a", locked: true }),
      photo(f, "speaker-photo", "Speaker photo", "Add the speaker's photo", { x: 160, y: 0.2, w: 440, shape: "circle", border: { color: "#f4efe6", width: 10 } }),
      text(f, "eyebrow", "Label", "Guest speaker", { y: 0.2, x: 860, w: 940, size: 28, font: "Manrope", weight: 700, color: "#7d6229", align: "left", upper: true, ls: 8 }),
      text(f, "event", "Event", "Special Service", { y: 0.26, x: 860, w: 940, size: 84, font: "Playfair Display", weight: 700, color: "#1b2a4a", align: "left" }),
      text(f, "name", "Speaker name", "Pastor Name Surname", { y: 0.45, x: 860, w: 940, size: 62, font: "Oswald", weight: 600, color: "#1b2a4a", align: "left", upper: true, ls: 1 }),
      text(f, "role", "Speaker title", "Senior Pastor, Grace Church", { y: 0.53, x: 860, w: 940, size: 32, font: "Manrope", weight: 500, color: "#5b616e", align: "left" }),
      text(f, "date", "Date and time", "Sunday 9 November · 10:00", { y: 0.66, x: 860, w: 940, size: 42, font: "Manrope", weight: 800, color: "#1b2a4a", align: "left" }),
      text(f, "venue", "Venue", "Main auditorium", { y: 0.73, x: 860, w: 940, size: 30, font: "Manrope", weight: 500, color: "#5b616e", align: "left" }),
    ],
  }),

  conference: (f: Frame) => ({
    background: { color: "#ffffff" },
    elements: [
      shape(f, "band", "Side band", "rect", { x: 0, y: 0, w: 860, hf: 1, fill: "#1b2a4a", locked: true }),
      text(f, "eyebrow", "Label", "Annual conference", { y: 0.2, x: 100, w: 700, size: 28, font: "Manrope", weight: 700, color: "#c9aa6a", align: "left", upper: true, ls: 8 }),
      text(f, "title", "Title", "Kingdom\nConference", { y: 0.26, x: 100, w: 700, size: 96, font: "Montserrat", weight: 900, color: "#ffffff", align: "left", lh: 0.95, upper: true }),
      text(f, "year", "Year", "2026", { y: 0.47, x: 100, w: 700, size: 56, font: "Montserrat", weight: 300, color: "#e2cda0", align: "left", ls: 12 }),
      text(f, "dates", "Dates", "20–22 March · Doors 08:30", { y: 0.66, x: 100, w: 700, size: 42, font: "Oswald", weight: 600, color: "#ffffff", align: "left", upper: true }),
      text(f, "venue", "Venue", "Grace Convention Centre", { y: 0.74, x: 100, w: 700, size: 28, font: "Manrope", weight: 500, color: "#e2e8f0", align: "left" }),
      ...[0, 1, 2].flatMap((i) => [
        photo(f, `speaker-${i + 1}-photo`, `Speaker ${i + 1} photo`, "Speaker photo", { x: 960 + i * 320, y: 0.28, w: 240, shape: "circle", border: { color: "#c9aa6a", width: 4 } }),
        text(f, `speaker-${i + 1}-name`, `Speaker ${i + 1} name`, `Speaker ${i + 1}`, { y: 0.55, x: 930 + i * 320, w: 300, size: 30, font: "Manrope", weight: 800, color: "#1b2a4a" }),
        text(f, `speaker-${i + 1}-role`, `Speaker ${i + 1} title`, "Title or church", { y: 0.6, x: 930 + i * 320, w: 300, size: 22, font: "Manrope", weight: 500, color: "#5b616e" }),
      ]),
    ],
  }),

  "sermon-series": (f: Frame) => ({
    background: { color: "#111827" },
    elements: [
      shape(f, "bar-top", "Accent bar", "rect", { x: 120, y: 0.25, w: 1680, h: 6, fill: "#fbbf24" }),
      text(f, "eyebrow", "Label", "New sermon series", { y: 0.3, x: 120, w: 1680, size: 30, font: "Manrope", weight: 700, color: "#fbbf24", align: "left", upper: true, ls: 8 }),
      text(f, "title", "Series title", "Unshakeable", { y: 0.37, x: 120, w: 1680, size: 150, font: "Montserrat", weight: 900, color: "#ffffff", align: "left", upper: true }),
      text(f, "subtitle", "Subtitle", "Faith that stands in every season", { y: 0.56, x: 120, w: 1680, size: 38, font: "Manrope", weight: 500, color: "#e5e7eb", align: "left" }),
      shape(f, "bar-bottom", "Accent bar", "rect", { x: 120, y: 0.65, w: 1680, h: 6, fill: "#fbbf24" }),
      text(f, "date", "Date and time", "Sundays in March · 09:00", { y: 0.71, x: 120, w: 1680, size: 42, font: "Manrope", weight: 800, color: "#ffffff", align: "left" }),
    ],
  }),

  "watch-online": (f: Frame) => ({
    background: { color: "#0f172a" },
    elements: [
      shape(f, "live-badge", "Live badge", "rect", { x: 120, y: 0.2, w: 240, h: 84, fill: "#dc2626", radius: 42 }),
      text(f, "live", "Live label", "● LIVE", { y: 0.215, x: 120, w: 240, size: 40, font: "Manrope", weight: 800, color: "#ffffff" }),
      text(f, "title", "Title", "Join us\nlive online", { y: 0.34, x: 120, w: 1060, size: 120, font: "Montserrat", weight: 900, color: "#ffffff", align: "left", lh: 1 }),
      text(f, "times", "Times", "Sundays at 09:00 on YouTube & Facebook", { y: 0.62, x: 120, w: 1060, size: 36, font: "Manrope", weight: 600, color: "#e2e8f0", align: "left" }),
      text(f, "link", "Link", "youtube.com/@yourchurch", { y: 0.7, x: 120, w: 1060, size: 38, font: "Manrope", weight: 700, color: "#fca5a5", align: "left" }),
      shape(f, "play-circle", "Play button", "ellipse", { x: 1340, y: 0.24, w: 440, fill: "#dc2626", locked: true }),
      // A triangle rotated 90° points right; rotation turns it about its top-left corner, so x is its right tip.
      shape(f, "play-arrow", "Play arrow", "triangle", { x: 1650, y: 0.37, w: 180, h: 160, rotation: 90, fill: "#ffffff", locked: true }),
    ],
  }),

  "verse-card": (f: Frame) => ({
    background: { color: "#efe6d4", gradient: { from: "#f7f1e6", to: "#e7dcc8", angle: 180 } },
    elements: [
      text(f, "quote-mark", "Quote mark", "“", { y: 0.06, x: 120, w: 400, size: 300, font: "Playfair Display", weight: 700, color: "#c9aa6a", align: "left", lh: 1 }),
      text(f, "verse", "Verse", "The LORD is my shepherd;\nI shall not want.", { y: 0.34, x: 120, w: 1680, size: 84, font: "Playfair Display", weight: 500, italic: true, color: "#3b2f1e", align: "left", lh: 1.2 }),
      text(f, "reference", "Reference", "Psalm 23:1 (KJV)", { y: 0.66, x: 120, w: 1680, size: 30, font: "Manrope", weight: 700, color: "#6b5326", align: "left", upper: true, ls: 6 }),
      text(f, "church", "Church name", "Your church", { y: 0.86, x: 120, w: 1680, size: 26, font: "Manrope", weight: 600, color: "#6b5326", align: "left", upper: true, ls: 6 }),
    ],
  }),

  announcement: (f: Frame) => ({
    background: { color: "#1b2a4a" },
    elements: [
      shape(f, "bar", "Accent bar", "rect", { x: 120, y: 0.14, w: 120, h: 8, fill: "#c9aa6a" }),
      text(f, "eyebrow", "Label", "Announcement", { y: 0.17, x: 120, w: 1000, size: 28, font: "Manrope", weight: 700, color: "#e2cda0", align: "left", upper: true, ls: 8 }),
      text(f, "title", "Headline", "Your announcement\nheadline here", { y: 0.24, x: 120, w: 1000, size: 84, font: "Manrope", weight: 800, color: "#ffffff", align: "left", lh: 1.05 }),
      text(f, "body", "Details", "Add the details people need: what's happening, when, where, and who to contact.", { y: 0.5, x: 120, w: 980, size: 36, font: "Manrope", weight: 500, color: "#d6dae3", align: "left", lh: 1.4 }),
      shape(f, "contact-box", "Contact box", "rect", { x: 1240, y: 0.24, w: 560, h: 520, fill: "#ffffff", fillOpacity: 0.08, radius: 24 }),
      icon(f, "contact-icon", "Icon", "church", { x: 1290, y: 0.3, w: 90, fill: "#c9aa6a" }),
      text(f, "contact", "Contact", "Questions?\nCall the church office on 012 345 6789", { y: 0.42, x: 1290, w: 460, size: 32, font: "Manrope", weight: 600, color: "#ffffff", align: "left", lh: 1.35 }),
      text(f, "church", "Church name", "Your church", { y: 0.86, x: 120, w: 1000, size: 26, font: "Manrope", weight: 700, color: "#c9aa6a", align: "left", upper: true, ls: 6 }),
    ],
  }),

  easter: (f: Frame) => ({
    background: { color: "#fcd34d", gradient: { from: "#fde68a", to: "#fb923c", angle: 180 } },
    elements: [
      shape(f, "sun", "Sun", "ellipse", { x: 280, y: 0.16, w: 400, fill: "#fff7ed", opacity: 0.7, locked: true }),
      shape(f, "cross-upright", "Cross", "rect", { x: 455, y: 0.12, w: 50, h: 560, fill: "#3f2a1d" }),
      shape(f, "cross-beam", "Cross", "rect", { x: 345, y: 0.24, w: 270, h: 50, fill: "#3f2a1d" }),
      text(f, "title", "Title", "He is Risen", { y: 0.3, x: 960, w: 860, size: 112, font: "Cinzel", weight: 700, color: "#3f2a1d", align: "left" }),
      text(f, "times", "Service times", "Easter Sunday · 06:00 sunrise & 09:00", { y: 0.5, x: 960, w: 860, size: 38, font: "Manrope", weight: 700, color: "#3f2a1d", align: "left" }),
      text(f, "venue", "Venue", "Join us as we celebrate the empty tomb", { y: 0.58, x: 960, w: 860, size: 30, font: "Manrope", weight: 500, color: "#4a2c17", align: "left" }),
    ],
  }),

  christmas: (f: Frame) => ({
    background: { color: "#06261c", gradient: { from: "#0b3d2e", to: "#04140f", angle: 180 } },
    elements: [
      ...(
        [
          [140, 0.12, 100],
          [420, 0.7, 80],
          [1500, 0.1, 90],
          [1720, 0.55, 120],
          [1240, 0.82, 70],
          [260, 0.4, 60],
        ] as const
      ).map(([x, y, w], i) => shape(f, `light-${i + 1}`, "Light", "ellipse", { x, y, w, fill: "#fde68a", opacity: 0.18, locked: true })),
      text(f, "eyebrow", "Label", "Join us for", { y: 0.15, x: 360, w: 1200, size: 30, font: "Manrope", weight: 600, color: "#e2cda0", upper: true, ls: 8 }),
      text(f, "title", "Title", "Carols by Candlelight", { y: 0.22, x: 160, w: 1600, size: 150, font: "Great Vibes", color: "#fef3c7" }),
      text(f, "subtitle", "Subtitle", "A Christmas evening for the whole family", { y: 0.46, x: 360, w: 1200, size: 38, font: "Manrope", weight: 500, color: "#d1fae5" }),
      text(f, "date", "Date and time", "Sunday 21 December · 18:30", { y: 0.62, x: 360, w: 1200, size: 46, font: "Manrope", weight: 800, color: "#ffffff" }),
      text(f, "venue", "Venue", "Church lawn · Bring a blanket", { y: 0.7, x: 360, w: 1200, size: 32, font: "Manrope", weight: 500, color: "#a7f3d0" }),
    ],
  }),
};
