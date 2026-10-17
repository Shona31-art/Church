import type { TemplateDefinition } from "./catalog";
import { fullPhoto, icon, photo, shape, text } from "./kit";

// The second set of original Poster Studio templates (26), widening the range
// to the occasions churches most often make posters for: the church year,
// celebrations, outreach and social-media posts. Same rules as catalog.ts:
// made for this app (type, colour, shapes, original icons, labelled photo
// slots), scripture from public-domain translations (WEB, or KJV where noted).

export const MORE_TEMPLATES: readonly TemplateDefinition[] = [
  // ---------------------------------------------------------------- Seasons
  {
    key: "palm-sunday",
    name: "Palm Sunday",
    occasion: "Seasons",
    description: "Fresh greens and a triumphal welcome",
    build: (f) => ({
      background: { color: "#0b3d1f", gradient: { from: "#14532d", to: "#052e16", angle: 180 } },
      elements: [
        shape(f, "palm-1", "Palm leaf", "ellipse", { x: -60, y: 0.04, w: 520, h: 150, rotation: 28, fill: "#4ade80", opacity: 0.22, locked: true }),
        shape(f, "palm-2", "Palm leaf", "ellipse", { x: 600, y: 0.02, w: 540, h: 150, rotation: -24, fill: "#86efac", opacity: 0.18, locked: true }),
        shape(f, "palm-3", "Palm leaf", "ellipse", { x: 640, y: 0.82, w: 520, h: 140, rotation: 20, fill: "#4ade80", opacity: 0.16, locked: true }),
        text(f, "title", "Title", "Palm Sunday", { y: 0.3, size: 130, font: "Playfair Display", weight: 700, color: "#f0fdf4" }),
        text(f, "verse", "Scripture", "“Hosanna! Blessed is he who comes in the name of the Lord…”\nJohn 12:13", { y: 0.49, x: 110, w: 860, size: 34, font: "Lora", weight: 500, italic: true, color: "#bbf7d0", lh: 1.35 }),
        text(f, "date", "Date and time", "Sunday 29 March · 09:00", { y: 0.7, size: 42, font: "Manrope", weight: 800, color: "#ffffff" }),
        text(f, "venue", "Venue", "Join the procession at the main entrance", { y: 0.76, size: 30, font: "Manrope", weight: 500, color: "#dcfce7" }),
      ],
    }),
  },
  {
    key: "good-friday",
    name: "Good Friday",
    occasion: "Seasons",
    description: "Sombre and reverent, with the cross",
    build: (f) => ({
      background: { color: "#18181b", gradient: { from: "#27272a", to: "#09090b", angle: 180 } },
      elements: [
        shape(f, "cross-upright", "Cross", "rect", { x: 515, y: 0.09, w: 50, h: 460, fill: "#71717a", opacity: 0.55 }),
        shape(f, "cross-beam", "Cross", "rect", { x: 395, y: 0.17, w: 290, h: 50, fill: "#71717a", opacity: 0.55 }),
        text(f, "title", "Title", "Good Friday", { y: 0.56, size: 110, font: "Cinzel", weight: 700, color: "#fafaf9" }),
        text(f, "verse", "Scripture", "“It is finished.”  John 19:30", { y: 0.68, size: 40, font: "Cormorant Garamond", weight: 500, italic: true, color: "#e7e5e4" }),
        text(f, "times", "Service times", "Friday 3 April · 09:00", { y: 0.79, size: 40, font: "Manrope", weight: 700, color: "#ffffff" }),
        text(f, "venue", "Venue", "A quiet service of reflection and communion", { y: 0.85, size: 28, font: "Manrope", weight: 500, color: "#d6d3d1" }),
      ],
    }),
  },
  {
    key: "pentecost",
    name: "Pentecost",
    occasion: "Seasons",
    description: "Fiery reds and tongues of flame",
    build: (f) => ({
      background: { color: "#9a3412", gradient: { from: "#7f1d1d", to: "#c2410c", angle: 160 } },
      elements: [
        icon(f, "flame-1", "Flame", "flame", { x: 330, y: 0.1, w: 120, fill: "#fde68a", opacity: 0.9 }),
        icon(f, "flame-2", "Flame", "flame", { x: 480, y: 0.07, w: 140, fill: "#fef3c7" }),
        icon(f, "flame-3", "Flame", "flame", { x: 650, y: 0.1, w: 120, fill: "#fde68a", opacity: 0.9 }),
        text(f, "title", "Title", "Pentecost", { y: 0.33, size: 150, font: "DM Serif Display", color: "#ffffff" }),
        text(f, "subtitle", "Subtitle", "Come, Holy Spirit", { y: 0.5, size: 64, font: "Dancing Script", weight: 700, color: "#fef3c7" }),
        text(f, "verse", "Scripture", "Acts 2:1–4", { y: 0.6, size: 30, font: "Manrope", weight: 600, color: "#ffedd5", upper: true, ls: 6 }),
        text(f, "date", "Date and time", "Sunday 24 May · 09:00", { y: 0.74, size: 42, font: "Manrope", weight: 800, color: "#ffffff" }),
        text(f, "venue", "Venue", "Wear red and celebrate with us", { y: 0.8, size: 30, font: "Manrope", weight: 600, color: "#ffffff" }),
      ],
    }),
  },
  {
    key: "advent",
    name: "Advent",
    occasion: "Seasons",
    description: "Four candles of hope, peace, joy and love",
    build: (f) => ({
      background: { color: "#1e1b4b" },
      elements: [
        ...(
          [
            [330, "#7c3aed"],
            [450, "#7c3aed"],
            [570, "#f472b6"],
            [690, "#7c3aed"],
          ] as const
        ).flatMap(([x, colour], i) => [
          shape(f, `candle-${i + 1}`, "Candle", "rect", { x, y: 0.2, w: 60, h: 170, fill: colour, radius: 8 }),
          shape(f, `flame-${i + 1}`, "Candle flame", "ellipse", { x: x + 16, y: 0.13, w: 28, h: 50, fill: "#fcd34d" }),
        ]),
        text(f, "title", "Title", "Advent", { y: 0.42, size: 160, font: "Cormorant Garamond", weight: 600, color: "#ede9fe" }),
        text(f, "subtitle", "Subtitle", "Four Sundays of hope, peace, joy and love", { y: 0.6, size: 32, font: "Manrope", weight: 500, color: "#ddd6fe" }),
        text(f, "date", "Date and time", "Starting Sunday 29 November · 09:00", { y: 0.71, size: 40, font: "Manrope", weight: 800, color: "#ffffff" }),
        text(f, "venue", "Venue", "Main service", { y: 0.77, size: 30, font: "Manrope", weight: 500, color: "#c4b5fd" }),
      ],
    }),
  },
  {
    key: "new-year",
    name: "Crossover Night",
    occasion: "Seasons",
    description: "Pray into the new year, black and gold",
    build: (f) => ({
      background: { color: "#0c0a09", gradient: { from: "#1c1917", to: "#000000", angle: 180 } },
      elements: [
        ...(
          [
            [120, 0.1, 50],
            [880, 0.08, 70],
            [780, 0.4, 40],
            [80, 0.6, 60],
            [920, 0.9, 50],
          ] as const
        ).map(([x, y, w], i) => icon(f, `sparkle-${i + 1}`, "Sparkle", "star", { x, y, w, fill: "#e2cda0", opacity: 0.6, locked: true })),
        text(f, "title", "Title", "Crossover\nNight", { y: 0.17, size: 190, font: "Bebas Neue", color: "#ffffff", lh: 0.9, upper: true }),
        text(f, "years", "Years", "2026 → 2027", { y: 0.5, size: 60, font: "Montserrat", weight: 300, color: "#e2cda0", ls: 6 }),
        text(f, "subtitle", "Subtitle", "Pray into the new year with us", { y: 0.6, size: 36, font: "Manrope", weight: 600, color: "#e7e5e4" }),
        text(f, "date", "Date and time", "31 December · 21:00 – midnight", { y: 0.74, size: 44, font: "Oswald", weight: 600, color: "#ffffff", upper: true }),
        text(f, "venue", "Venue", "Main auditorium · Families welcome", { y: 0.82, size: 30, font: "Manrope", weight: 500, color: "#d6d3d1" }),
      ],
    }),
  },

  // ----------------------------------------------------------- Celebrations
  {
    key: "church-anniversary",
    name: "Church Anniversary",
    occasion: "Celebrations",
    description: "A big number for years of faithfulness",
    build: (f) => ({
      background: { color: "#fffbeb" },
      elements: [
        text(f, "eyebrow", "Label", "Celebrating", { y: 0.07, size: 30, font: "Manrope", weight: 700, color: "#92400e", upper: true, ls: 10 }),
        text(f, "number", "Years", "25", { y: 0.1, size: 340, font: "Playfair Display", weight: 700, color: "#b45309", lh: 1 }),
        text(f, "title", "Title", "Years of\nGod's faithfulness", { y: 0.45, size: 62, font: "Playfair Display", weight: 700, color: "#451a03", lh: 1.1 }),
        shape(f, "rule", "Divider", "line", { x: 470, y: 0.65, w: 140, stroke: "#c9aa6a", strokeWidth: 4 }),
        text(f, "date", "Date and time", "Sunday 14 June · 10:00", { y: 0.69, size: 42, font: "Manrope", weight: 800, color: "#451a03" }),
        text(f, "venue", "Venue", "Thanksgiving service and lunch for all", { y: 0.75, size: 30, font: "Manrope", weight: 500, color: "#78350f" }),
      ],
    }),
  },
  {
    key: "pastor-appreciation",
    name: "Pastor Appreciation",
    occasion: "Celebrations",
    description: "Honour your pastor with a photo and thanks",
    build: (f) => ({
      background: { color: "#1b2a4a" },
      elements: [
        photo(f, "pastor-photo", "Pastor photo", "Add your pastor's photo", { x: 360, y: 0.12, w: 360, shape: "circle", border: { color: "#c9aa6a", width: 8 } }),
        text(f, "eyebrow", "Label", "With gratitude", { y: 0.52, size: 28, font: "Manrope", weight: 700, color: "#e2cda0", upper: true, ls: 8 }),
        text(f, "title", "Title", "Pastor Appreciation\nSunday", { y: 0.57, size: 70, font: "Playfair Display", weight: 700, color: "#ffffff", lh: 1.05 }),
        text(f, "names", "Names", "Honouring Pastor & Mrs Name", { y: 0.75, size: 34, font: "Manrope", weight: 600, color: "#f3e6c8" }),
        text(f, "date", "Date and time", "Sunday 26 October · 09:00", { y: 0.82, size: 36, font: "Manrope", weight: 800, color: "#ffffff" }),
      ],
    }),
  },
  {
    key: "mothers-day",
    name: "Mother's Day",
    occasion: "Celebrations",
    description: "Soft pinks and graceful script",
    build: (f) => ({
      background: { color: "#fdf2f8" },
      elements: [
        shape(f, "accent-1", "Accent circle", "ellipse", { x: -140, y: -0.06, w: 460, fill: "#fbcfe8", opacity: 0.7, locked: true }),
        shape(f, "accent-2", "Accent circle", "ellipse", { x: 800, y: 0.8, w: 400, fill: "#f9a8d4", opacity: 0.35, locked: true }),
        icon(f, "heart", "Heart", "heart", { x: 500, y: 0.11, w: 80, fill: "#be185d" }),
        text(f, "title", "Title", "Happy\nMother's Day", { y: 0.2, size: 140, font: "Great Vibes", color: "#9d174d", lh: 1 }),
        text(f, "verse", "Scripture", "“Her children rise up and call her blessed.”\nProverbs 31:28", { y: 0.55, x: 110, w: 860, size: 34, font: "Playfair Display", weight: 500, italic: true, color: "#831843", lh: 1.35 }),
        text(f, "date", "Date and time", "Sunday 10 May · 09:00", { y: 0.71, size: 40, font: "Manrope", weight: 800, color: "#500724" }),
        text(f, "venue", "Venue", "A special gift for every mom", { y: 0.77, size: 30, font: "Manrope", weight: 500, color: "#831843" }),
      ],
    }),
  },
  {
    key: "fathers-day",
    name: "Father's Day",
    occasion: "Celebrations",
    description: "Strong navy with a steady verse",
    build: (f) => ({
      background: { color: "#0f172a" },
      elements: [
        shape(f, "bar", "Accent bar", "rect", { x: 440, y: 0.16, w: 200, h: 10, fill: "#60a5fa" }),
        text(f, "title", "Title", "Father's Day", { y: 0.21, size: 140, font: "Oswald", weight: 600, color: "#ffffff", upper: true }),
        text(f, "subtitle", "Subtitle", "Celebrating the men who lead with love", { y: 0.41, size: 36, font: "Manrope", weight: 500, color: "#e2e8f0" }),
        text(f, "verse", "Scripture", "“Like a father has compassion on his children…”\nPsalm 103:13", { y: 0.5, x: 110, w: 860, size: 32, font: "Lora", weight: 500, italic: true, color: "#bfdbfe", lh: 1.35 }),
        text(f, "date", "Date and time", "Sunday 21 June · 09:00", { y: 0.71, size: 42, font: "Manrope", weight: 800, color: "#ffffff" }),
        text(f, "venue", "Venue", "Breakfast for dads after the service", { y: 0.77, size: 30, font: "Manrope", weight: 500, color: "#cbd5e1" }),
      ],
    }),
  },
  {
    key: "graduation",
    name: "Graduation Sunday",
    occasion: "Celebrations",
    description: "Black and gold with a class photo",
    build: (f) => ({
      background: { color: "#111827" },
      elements: [
        text(f, "title", "Title", "Graduation\nSunday", { y: 0.12, size: 104, font: "Montserrat", weight: 900, color: "#ffffff", lh: 0.95, upper: true }),
        text(f, "subtitle", "Subtitle", "Celebrating our graduates of 2026", { y: 0.38, size: 36, font: "Manrope", weight: 600, color: "#fde68a" }),
        photo(f, "class-photo", "Graduates photo", "Add a photo of your graduates", { x: 140, y: 0.47, w: 800, h: 300, radius: 24, shape: "rounded", border: { color: "#fbbf24", width: 4 } }),
        text(f, "date", "Date and time", "Sunday 7 December · 09:00", { y: 0.79, size: 40, font: "Manrope", weight: 800, color: "#ffffff" }),
        text(f, "venue", "Venue", "Graduates, please wear your gowns", { y: 0.85, size: 30, font: "Manrope", weight: 500, color: "#e5e7eb" }),
      ],
    }),
  },
  {
    key: "wedding",
    name: "Wedding",
    occasion: "Celebrations",
    description: "An elegant invitation with a fine gold frame",
    build: (f) => ({
      background: { color: "#fafaf9" },
      elements: [
        shape(f, "frame", "Frame", "rect", { x: 50, y: 0.046, w: 980, hf: 0.908, fill: null, stroke: "#c9aa6a", strokeWidth: 3, locked: true }),
        text(f, "eyebrow", "Families line", "Together with their families", { y: 0.2, size: 26, font: "Manrope", weight: 600, color: "#57534e", upper: true, ls: 6 }),
        text(f, "names", "Couple's names", "Sarah & David", { y: 0.28, size: 150, font: "Great Vibes", color: "#292524" }),
        text(f, "invite", "Invitation", "invite you to celebrate their marriage", { y: 0.5, size: 40, font: "Cormorant Garamond", weight: 500, italic: true, color: "#44403c" }),
        text(f, "date", "Date and time", "Saturday 5 December 2026 · 14:00", { y: 0.63, size: 36, font: "Manrope", weight: 700, color: "#1c1917" }),
        text(f, "venue", "Venue", "Grace Church, Main Street", { y: 0.69, size: 30, font: "Manrope", weight: 500, color: "#44403c" }),
        icon(f, "heart", "Heart", "heart", { x: 515, y: 0.79, w: 50, fill: "#a88a4a" }),
      ],
    }),
  },
  {
    key: "memorial",
    name: "Celebration of Life",
    occasion: "Celebrations",
    description: "A gentle memorial notice with a portrait",
    build: (f) => ({
      background: { color: "#f5f5f4" },
      elements: [
        photo(f, "portrait", "Portrait", "Add a portrait", { x: 350, y: 0.08, w: 380, h: 460, shape: "rounded", radius: 190, border: { color: "#a8a29e", width: 4 } }),
        text(f, "eyebrow", "Label", "In loving memory of", { y: 0.55, size: 40, font: "Cormorant Garamond", weight: 500, italic: true, color: "#44403c" }),
        text(f, "name", "Name", "Name Surname", { y: 0.6, size: 72, font: "Playfair Display", weight: 700, color: "#1c1917" }),
        text(f, "dates", "Dates", "1948 – 2026", { y: 0.69, size: 36, font: "Montserrat", weight: 300, color: "#44403c", ls: 6 }),
        text(f, "service", "Service", "Memorial service · Friday 10:00 · Grace Church", { y: 0.77, x: 60, w: 960, size: 30, font: "Manrope", weight: 600, color: "#292524" }),
        text(f, "verse", "Scripture", "“I am the resurrection and the life.”  John 11:25", { y: 0.84, x: 60, w: 960, size: 32, font: "Cormorant Garamond", weight: 500, italic: true, color: "#44403c" }),
      ],
    }),
  },

  // ----------------------------------------------------------------- Events
  {
    key: "gospel-concert",
    name: "Gospel Concert",
    occasion: "Events",
    description: "Stage lights and big type for a choir night",
    build: (f) => ({
      background: { color: "#2e1065", gradient: { from: "#1e1b4b", to: "#701a75", angle: 150 } },
      elements: [
        shape(f, "light-1", "Stage light", "triangle", { x: 60, y: -0.05, w: 360, h: 1000, rotation: -14, fill: "#f5d0fe", opacity: 0.12, locked: true }),
        shape(f, "light-2", "Stage light", "triangle", { x: 660, y: -0.05, w: 360, h: 1000, rotation: 14, fill: "#f5d0fe", opacity: 0.12, locked: true }),
        icon(f, "notes", "Music notes", "music", { x: 470, y: 0.07, w: 140, fill: "#f5d0fe" }),
        text(f, "title", "Title", "Gospel\nConcert", { y: 0.22, size: 180, font: "Anton", color: "#ffffff", lh: 0.92, upper: true }),
        text(f, "subtitle", "Subtitle", "Featuring the Grace Mass Choir", { y: 0.56, size: 38, font: "Manrope", weight: 700, color: "#fae8ff" }),
        text(f, "date", "Date and time", "Saturday 22 August · 18:00", { y: 0.73, size: 48, font: "Oswald", weight: 600, color: "#ffffff", upper: true }),
        text(f, "venue", "Venue and tickets", "Main auditorium · Tickets R80 at the door", { y: 0.81, size: 30, font: "Manrope", weight: 600, color: "#ffffff" }),
      ],
    }),
  },
  {
    key: "couples-night",
    name: "Couples Night",
    occasion: "Events",
    description: "A warm evening for married couples",
    build: (f) => ({
      background: { color: "#2a0a0e", gradient: { from: "#4c0519", to: "#14060a", angle: 180 } },
      elements: [
        icon(f, "heart", "Heart", "heart", { x: 490, y: 0.13, w: 100, fill: "#fb7185" }),
        text(f, "eyebrow", "Label", "Marriage ministry", { y: 0.25, size: 28, font: "Manrope", weight: 700, color: "#fecdd3", upper: true, ls: 8 }),
        text(f, "title", "Title", "Date Night", { y: 0.3, size: 140, font: "Playfair Display", weight: 700, italic: true, color: "#ffe4e6" }),
        text(f, "subtitle", "Subtitle", "Dinner, conversation and a word for your marriage", { y: 0.5, x: 110, w: 860, size: 34, font: "Manrope", weight: 500, color: "#fecdd3", lh: 1.3 }),
        text(f, "date", "Date and time", "Friday 13 February · 18:30", { y: 0.68, size: 42, font: "Manrope", weight: 800, color: "#ffffff" }),
        text(f, "venue", "Venue", "Church hall · R250 per couple", { y: 0.74, size: 30, font: "Manrope", weight: 500, color: "#fecdd3" }),
      ],
    }),
  },
  {
    key: "leadership-summit",
    name: "Leadership Summit",
    occasion: "Events",
    description: "Clean, corporate-style layout for leaders",
    build: (f) => ({
      background: { color: "#ffffff" },
      elements: [
        shape(f, "band", "Side band", "rect", { x: 0, y: 0, w: 340, hf: 1, fill: "#0f172a", locked: true }),
        icon(f, "crown", "Crown", "crown", { x: 100, y: 0.42, w: 140, fill: "#c9aa6a" }),
        text(f, "eyebrow", "Label", "Leaders conference", { y: 0.14, x: 400, w: 620, size: 26, font: "Manrope", weight: 700, color: "#92400e", align: "left", upper: true, ls: 6 }),
        text(f, "title", "Title", "Lead\nWell", { y: 0.2, x: 400, w: 620, size: 150, font: "Montserrat", weight: 900, color: "#0f172a", align: "left", lh: 0.95 }),
        text(f, "subtitle", "Subtitle", "Equipping leaders to serve with integrity", { y: 0.5, x: 400, w: 600, size: 34, font: "Manrope", weight: 500, color: "#334155", align: "left", lh: 1.3 }),
        text(f, "date", "Date and time", "Saturday 7 March · 08:30", { y: 0.68, x: 400, w: 620, size: 36, font: "Manrope", weight: 800, color: "#0f172a", align: "left" }),
        text(f, "venue", "Venue", "Church conference room · Register by 1 March", { y: 0.74, x: 400, w: 620, size: 26, font: "Manrope", weight: 500, color: "#475569", align: "left", lh: 1.3 }),
      ],
    }),
  },

  // ---------------------------------------------------------------- Outreach
  {
    key: "building-fund",
    name: "Building Fund",
    occasion: "Outreach",
    description: "A fundraiser with a progress bar",
    build: (f) => ({
      background: { color: "#ecfdf5" },
      elements: [
        icon(f, "church", "Church", "church", { x: 470, y: 0.07, w: 140, fill: "#047857" }),
        text(f, "title", "Title", "Help us\nbuild", { y: 0.22, size: 120, font: "Montserrat", weight: 900, color: "#064e3b", lh: 0.95 }),
        text(f, "subtitle", "Subtitle", "Our new church hall building fund", { y: 0.48, size: 36, font: "Manrope", weight: 600, color: "#065f46" }),
        shape(f, "track", "Progress track", "rect", { x: 140, y: 0.58, w: 800, h: 40, fill: "#a7f3d0", radius: 20 }),
        shape(f, "progress", "Progress", "rect", { x: 140, y: 0.58, w: 510, h: 40, fill: "#059669", radius: 20 }),
        text(f, "amount", "Amount raised", "R350 000 raised of R550 000", { y: 0.64, size: 36, font: "Manrope", weight: 800, color: "#064e3b" }),
        text(f, "how", "How to give", "Give at any service or online", { y: 0.76, size: 30, font: "Manrope", weight: 500, color: "#065f46" }),
      ],
    }),
  },
  {
    key: "food-drive",
    name: "Food Drive",
    occasion: "Outreach",
    description: "Bold and clear about what to bring",
    build: (f) => ({
      background: { color: "#fff7ed" },
      elements: [
        shape(f, "band", "Top band", "rect", { x: 0, y: 0, w: 1080, hf: 0.38, fill: "#c2410c", locked: true }),
        text(f, "title", "Title", "Food Drive", { y: 0.08, size: 160, font: "Anton", color: "#ffffff", upper: true }),
        text(f, "subtitle", "Subtitle", "Help us feed families this winter", { y: 0.27, size: 36, font: "Manrope", weight: 700, color: "#ffffff" }),
        text(f, "needs", "What to bring", "We need:\nTinned food · Rice · Pasta · Toiletries", { y: 0.46, x: 90, w: 900, size: 36, font: "Manrope", weight: 600, color: "#7c2d12", lh: 1.4 }),
        text(f, "date", "Drop-off", "Drop off: every Sunday in June", { y: 0.68, size: 40, font: "Manrope", weight: 800, color: "#9a3412" }),
        text(f, "venue", "Venue", "Collection point at the church foyer", { y: 0.75, size: 30, font: "Manrope", weight: 500, color: "#7c2d12" }),
      ],
    }),
  },
  {
    key: "community-outreach",
    name: "Community Outreach",
    occasion: "Outreach",
    description: "A photo of your town and a call to serve",
    build: (f) => ({
      background: { color: "#052e16" },
      elements: [
        fullPhoto(f, "Add a photo of your community", { color: "#052e16", opacity: 0.72 }),
        icon(f, "heart", "Heart", "heart", { x: 490, y: 0.1, w: 100, fill: "#86efac" }),
        text(f, "title", "Title", "Love your\ncity", { y: 0.22, size: 150, font: "League Spartan", weight: 900, color: "#ffffff", lh: 0.92, upper: true }),
        text(f, "subtitle", "Subtitle", "Community clean-up & care day", { y: 0.52, size: 38, font: "Manrope", weight: 700, color: "#dcfce7" }),
        text(f, "date", "Date and time", "Saturday 18 April · 08:00", { y: 0.72, size: 42, font: "Manrope", weight: 800, color: "#ffffff" }),
        text(f, "venue", "Venue", "Meet at the church car park · Bring gloves", { y: 0.79, size: 30, font: "Manrope", weight: 600, color: "#f0fdf4" }),
      ],
    }),
  },
  {
    key: "missions-sunday",
    name: "Missions Sunday",
    occasion: "Outreach",
    description: "A globe motif and the great commission",
    build: (f) => ({
      background: { color: "#0c4a6e" },
      elements: [
        shape(f, "globe", "Globe", "ellipse", { x: 370, y: 0.09, w: 340, fill: null, stroke: "#7dd3fc", strokeWidth: 6 }),
        shape(f, "globe-meridian", "Globe line", "ellipse", { x: 470, y: 0.09, w: 140, h: 340, fill: null, stroke: "#7dd3fc", strokeWidth: 4 }),
        shape(f, "globe-equator", "Globe line", "line", { x: 370, y: 0.247, w: 340, stroke: "#7dd3fc", strokeWidth: 4 }),
        text(f, "title", "Title", "Missions\nSunday", { y: 0.45, size: 120, font: "Playfair Display", weight: 700, color: "#ffffff", lh: 1 }),
        text(f, "verse", "Scripture", "“Go, and make disciples of all nations.”  Matthew 28:19", { y: 0.69, x: 60, w: 960, size: 32, font: "Lora", weight: 500, italic: true, color: "#e0f2fe" }),
        text(f, "date", "Date and time", "Sunday 15 November · 09:00", { y: 0.79, size: 40, font: "Manrope", weight: 800, color: "#ffffff" }),
        text(f, "venue", "Venue", "Hear from our partners around the world", { y: 0.85, size: 28, font: "Manrope", weight: 500, color: "#e0f2fe" }),
      ],
    }),
  },

  // ------------------------------------------------------------------ Groups
  {
    key: "youth-camp",
    name: "Youth Camp",
    occasion: "Groups",
    description: "Mountains, sun and adventure",
    build: (f) => ({
      background: { color: "#fef3c7" },
      elements: [
        shape(f, "sun", "Sun", "ellipse", { x: 760, y: 0.12, w: 180, fill: "#f59e0b", locked: true }),
        // Heights as a share of the poster so the mountains always reach the bottom edge (white text sits on them).
        shape(f, "mountain-back", "Mountain", "triangle", { x: -120, y: 0.52, w: 760, hf: 0.48, fill: "#166534", locked: true }),
        shape(f, "mountain-front", "Mountain", "triangle", { x: 360, y: 0.46, w: 860, hf: 0.54, fill: "#14532d", locked: true }),
        text(f, "title", "Title", "Youth Camp", { y: 0.17, size: 140, font: "League Spartan", weight: 900, color: "#14532d", upper: true }),
        text(f, "subtitle", "Subtitle", "Faith · Friends · Adventure", { y: 0.33, size: 38, font: "Manrope", weight: 800, color: "#166534" }),
        text(f, "date", "Dates", "5–7 December · Ages 13–19", { y: 0.78, size: 40, font: "Manrope", weight: 800, color: "#ffffff" }),
        text(f, "venue", "Registration", "Register by 20 November", { y: 0.85, size: 30, font: "Manrope", weight: 600, color: "#ffffff" }),
      ],
    }),
  },
  {
    key: "small-groups",
    name: "Small Groups",
    occasion: "Groups",
    description: "Find your people, in fresh blues",
    build: (f) => ({
      background: { color: "#f0f9ff" },
      elements: [
        ...(
          [
            [110, 0.76, 160, "#7dd3fc"],
            [300, 0.8, 120, "#38bdf8"],
            [450, 0.74, 180, "#0ea5e9"],
            [660, 0.79, 130, "#38bdf8"],
            [820, 0.75, 170, "#7dd3fc"],
          ] as const
        ).map(([x, y, w, colour], i) => shape(f, `person-${i + 1}`, "Circle", "ellipse", { x, y, w, fill: colour, locked: true })),
        text(f, "title", "Title", "Find your\npeople", { y: 0.17, size: 130, font: "DM Serif Display", color: "#0c4a6e", lh: 1 }),
        text(f, "subtitle", "Subtitle", "Small groups start the week of 2 February", { y: 0.47, size: 36, font: "Manrope", weight: 600, color: "#075985" }),
        text(f, "detail", "How to join", "Sign up at the welcome desk or in the app", { y: 0.55, size: 30, font: "Manrope", weight: 500, color: "#075985" }),
      ],
    }),
  },

  // ------------------------------------------------------------ Social posts
  {
    key: "verse-card",
    name: "Verse of the Week",
    occasion: "Social posts",
    description: "A scripture card to share on social media",
    build: (f) => ({
      background: { color: "#efe6d4", gradient: { from: "#f7f1e6", to: "#e7dcc8", angle: 180 } },
      elements: [
        text(f, "quote-mark", "Quote mark", "“", { y: 0.04, size: 300, font: "Playfair Display", weight: 700, color: "#c9aa6a", lh: 1 }),
        text(f, "verse", "Verse", "The LORD is my shepherd;\nI shall not want.", { y: 0.33, x: 90, w: 900, size: 72, font: "Playfair Display", weight: 500, italic: true, color: "#3b2f1e", lh: 1.25 }),
        text(f, "reference", "Reference", "Psalm 23:1 (KJV)", { y: 0.62, size: 30, font: "Manrope", weight: 700, color: "#6b5326", upper: true, ls: 6 }),
        text(f, "church", "Church name", "Your church", { y: 0.88, size: 26, font: "Manrope", weight: 600, color: "#6b5326", upper: true, ls: 6 }),
      ],
    }),
  },
  {
    key: "sermon-series",
    name: "Sermon Series",
    occasion: "Social posts",
    description: "Typographic series artwork",
    build: (f) => ({
      background: { color: "#111827" },
      elements: [
        shape(f, "bar-top", "Accent bar", "rect", { x: 90, y: 0.22, w: 900, h: 6, fill: "#fbbf24" }),
        text(f, "eyebrow", "Label", "New sermon series", { y: 0.27, size: 30, font: "Manrope", weight: 700, color: "#fbbf24", upper: true, ls: 8 }),
        text(f, "title", "Series title", "Unshakeable", { y: 0.34, size: 130, font: "Montserrat", weight: 900, color: "#ffffff", upper: true }),
        text(f, "subtitle", "Subtitle", "Faith that stands in every season", { y: 0.5, size: 36, font: "Manrope", weight: 500, color: "#e5e7eb" }),
        shape(f, "bar-bottom", "Accent bar", "rect", { x: 90, y: 0.59, w: 900, h: 6, fill: "#fbbf24" }),
        text(f, "date", "Date and time", "Sundays in March · 09:00", { y: 0.67, size: 40, font: "Manrope", weight: 800, color: "#ffffff" }),
      ],
    }),
  },
  {
    key: "watch-online",
    name: "Watch Online",
    occasion: "Social posts",
    description: "Promote your livestream",
    build: (f) => ({
      background: { color: "#0f172a" },
      elements: [
        shape(f, "live-badge", "Live badge", "rect", { x: 420, y: 0.14, w: 240, h: 84, fill: "#dc2626", radius: 42 }),
        text(f, "live", "Live label", "● LIVE", { y: 0.155, x: 420, w: 240, size: 40, font: "Manrope", weight: 800, color: "#ffffff" }),
        text(f, "title", "Title", "Join us\nlive online", { y: 0.3, size: 110, font: "Montserrat", weight: 900, color: "#ffffff", lh: 1 }),
        text(f, "times", "Times", "Sundays at 09:00 on YouTube & Facebook", { y: 0.57, x: 60, w: 960, size: 34, font: "Manrope", weight: 600, color: "#e2e8f0" }),
        text(f, "link", "Link", "youtube.com/@yourchurch", { y: 0.65, size: 36, font: "Manrope", weight: 700, color: "#fca5a5" }),
      ],
    }),
  },
  {
    key: "welcome",
    name: "Welcome Home",
    occasion: "Social posts",
    description: "A warm welcome over a church photo",
    build: (f) => ({
      background: { color: "#1c1917" },
      elements: [
        fullPhoto(f, "Add a photo of your church family", { color: "#1c1917", opacity: 0.7 }),
        text(f, "title", "Title", "Welcome\nhome", { y: 0.24, size: 150, font: "Playfair Display", weight: 700, color: "#ffffff", lh: 1 }),
        text(f, "body", "Message", "Whoever you are, wherever you're from, there's a place for you here.", { y: 0.55, x: 120, w: 840, size: 34, font: "Manrope", weight: 500, color: "#fafaf9", lh: 1.35 }),
        text(f, "times", "Service times", "Sundays · 09:00 & 11:00", { y: 0.74, size: 40, font: "Manrope", weight: 800, color: "#ffffff" }),
        text(f, "church", "Church name", "Your church", { y: 0.86, size: 26, font: "Manrope", weight: 700, color: "#f3e6c8", upper: true, ls: 6 }),
      ],
    }),
  },

  // ----------------------------------------------------------------- General
  {
    key: "join-the-team",
    name: "Volunteers Needed",
    occasion: "General",
    description: "Recruit volunteers with a bold call to action",
    build: (f) => ({
      background: { color: "#1e293b" },
      elements: [
        text(f, "title", "Title", "Join the\nteam", { y: 0.15, size: 200, font: "Bebas Neue", color: "#fde047", lh: 0.88, upper: true }),
        text(f, "subtitle", "Subtitle", "Serve with us on Sundays", { y: 0.5, size: 40, font: "Manrope", weight: 700, color: "#ffffff" }),
        text(f, "teams", "Teams", "Welcome · Kids · Worship · Media · Hospitality", { y: 0.58, x: 60, w: 960, size: 30, font: "Manrope", weight: 600, color: "#e2e8f0" }),
        shape(f, "sticker", "Call-to-action sticker", "rect", { x: 140, y: 0.71, w: 800, h: 100, fill: "#fde047", radius: 50 }),
        text(f, "cta", "Call to action", "Sign up at the info desk", { y: 0.725, x: 140, w: 800, size: 38, font: "Manrope", weight: 800, color: "#0f172a" }),
      ],
    }),
  },
];
