import type { PosterDesign } from "../design";

// Original design: dark concert-style poster with soft gold light beams.
// Square layout; other sizes are derived (lib/posters/layout.ts) until step 3
// adds hand-tuned layouts.
export const worshipNightSquare: PosterDesign = {
  version: 1,
  size: "square",
  width: 1080,
  height: 1080,
  templateKey: "worship-night",
  background: { color: "#0d1220", gradient: { from: "#1b2a4a", to: "#070a12", angle: 160 } },
  elements: [
    { id: "beam-left", type: "shape", name: "Light beam", shape: "triangle", x: 120, y: -80, width: 360, height: 900, rotation: -12, opacity: 0.16, fill: "#e2cda0", fillOpacity: 1, stroke: null, strokeWidth: 0, cornerRadius: 0, locked: true },
    { id: "beam-right", type: "shape", name: "Light beam", shape: "triangle", x: 600, y: -80, width: 360, height: 900, rotation: 12, opacity: 0.12, fill: "#e2cda0", fillOpacity: 1, stroke: null, strokeWidth: 0, cornerRadius: 0, locked: true },
    { id: "church", type: "text", name: "Church name", x: 90, y: 170, width: 900, height: 40, rotation: 0, opacity: 1, text: "Your church presents", fontFamily: "Manrope", fontSize: 30, fontWeight: 600, italic: false, fill: "#c9aa6a", align: "center", lineHeight: 1.2, letterSpacing: 8, uppercase: true },
    { id: "title", type: "text", name: "Title", x: 60, y: 300, width: 960, height: 300, rotation: 0, opacity: 1, text: "Worship\nNight", fontFamily: "Playfair Display", fontSize: 150, fontWeight: 700, italic: false, fill: "#ffffff", align: "center", lineHeight: 1, letterSpacing: 0, uppercase: false },
    { id: "rule", type: "shape", name: "Divider", shape: "line", x: 470, y: 640, width: 140, height: 0, rotation: 0, opacity: 1, fill: null, fillOpacity: 1, stroke: "#c9aa6a", strokeWidth: 4, cornerRadius: 0 },
    { id: "subtitle", type: "text", name: "Subtitle", x: 140, y: 680, width: 800, height: 50, rotation: 0, opacity: 1, text: "An evening of praise and prayer", fontFamily: "Manrope", fontSize: 40, fontWeight: 500, italic: false, fill: "#e8e4da", align: "center", lineHeight: 1.2, letterSpacing: 0, uppercase: false },
    { id: "date", type: "text", name: "Date and time", x: 140, y: 830, width: 800, height: 50, rotation: 0, opacity: 1, text: "Friday 24 October · 18:30", fontFamily: "Manrope", fontSize: 44, fontWeight: 800, italic: false, fill: "#ffffff", align: "center", lineHeight: 1.2, letterSpacing: 1, uppercase: false },
    { id: "venue", type: "text", name: "Venue", x: 140, y: 895, width: 800, height: 40, rotation: 0, opacity: 1, text: "Main auditorium · Everyone welcome", fontFamily: "Manrope", fontSize: 32, fontWeight: 500, italic: false, fill: "#b9b4a8", align: "center", lineHeight: 1.2, letterSpacing: 0, uppercase: false },
  ],
};
