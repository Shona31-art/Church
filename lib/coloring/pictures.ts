// Bible colouring pages (pure — unit-tested). Original line drawings made of
// closed shapes on a 400×400 canvas: each region can be tapped and filled.
// Regions are drawn in order, so later ones sit on top of earlier ones.

export interface ColoringRegion {
  id: string;
  d: string;
}

export interface ColoringPicture {
  key: string;
  title: string;
  reference: string;
  regions: ColoringRegion[];
  /** Detail lines drawn on top (not fillable): faces, planks, rays. */
  lines?: string[];
}

// --- Shape helpers -----------------------------------------------------------

const n = (v: number) => Math.round(v * 10) / 10;

export function rect(x: number, y: number, w: number, h: number): string {
  return `M ${n(x)} ${n(y)} H ${n(x + w)} V ${n(y + h)} H ${n(x)} Z`;
}

export function ellipse(cx: number, cy: number, rx: number, ry = rx): string {
  return `M ${n(cx - rx)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)} Z`;
}

export function poly(...points: [number, number][]): string {
  return `M ${points.map(([x, y]) => `${n(x)} ${n(y)}`).join(" L ")} Z`;
}

/** A band of a rainbow: the half-ring between two radii. */
function arcBand(cx: number, cy: number, outer: number, inner: number): string {
  return `M ${n(cx - outer)} ${cy} A ${outer} ${outer} 0 0 1 ${n(cx + outer)} ${cy} L ${n(cx + inner)} ${cy} A ${inner} ${inner} 0 0 0 ${n(cx - inner)} ${cy} Z`;
}

/** A five-pointed star. */
function star(cx: number, cy: number, outer: number, inner: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return poly(...pts);
}

/** A flower: five round petals (one region each) and a centre. */
function flower(id: string, cx: number, cy: number, r: number): ColoringRegion[] {
  const petals = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { id: `${id}-petal${i + 1}`, d: ellipse(cx + r * Math.cos(a), cy + r * Math.sin(a), r * 0.75) };
  });
  return [{ id: `${id}-stem`, d: rect(cx - 2, cy, 4, 400 - cy) }, ...petals, { id: `${id}-centre`, d: ellipse(cx, cy, r * 0.6) }];
}

/** Wavy top edge from x0 to x1 at height y, then down to the bottom. */
function waves(y: number, bumps = 8, depth = 10): string {
  const w = 400 / bumps;
  let d = `M 0 ${y}`;
  for (let i = 0; i < bumps; i++) d += ` Q ${n(i * w + w / 2)} ${y - depth} ${n((i + 1) * w)} ${y}`;
  return `${d} L 400 400 L 0 400 Z`;
}

function hill(y: number, peak: number): string {
  return `M 0 ${y} Q 200 ${peak} 400 ${y} L 400 400 L 0 400 Z`;
}

function cloud(id: string, x: number, y: number, s: number): ColoringRegion {
  return { id, d: `M ${x} ${y} a ${s} ${s} 0 0 1 ${s * 1.6} ${-s * 0.4} a ${s * 1.1} ${s * 1.1} 0 0 1 ${s * 2.2} ${s * 0.2} a ${s * 0.8} ${s * 0.8} 0 0 1 ${s * 0.4} ${s * 1.2} Z` };
}

// --- The pictures ------------------------------------------------------------

export const COLORING_PICTURES: ColoringPicture[] = [
  {
    key: "ark",
    title: "Noah's ark and the rainbow",
    reference: "Genesis 9:13",
    regions: [
      { id: "sky", d: rect(0, 0, 400, 400) },
      { id: "sun", d: ellipse(340, 60, 32) },
      { id: "rainbow-red", d: arcBand(200, 250, 190, 172) },
      { id: "rainbow-orange", d: arcBand(200, 250, 172, 154) },
      { id: "rainbow-yellow", d: arcBand(200, 250, 154, 136) },
      { id: "rainbow-green", d: arcBand(200, 250, 136, 118) },
      { id: "rainbow-blue", d: arcBand(200, 250, 118, 100) },
      { id: "rainbow-purple", d: arcBand(200, 250, 100, 82) },
      cloud("cloud", 30, 110, 22),
      { id: "cabin", d: rect(130, 170, 140, 70) },
      { id: "roof", d: poly([115, 172], [200, 120], [285, 172]) },
      { id: "window1", d: rect(150, 190, 26, 22) },
      { id: "window2", d: rect(224, 190, 26, 22) },
      { id: "door", d: rect(187, 196, 26, 44) },
      { id: "hull", d: poly([50, 235], [350, 235], [315, 300], [85, 300]) },
      { id: "sea", d: waves(290) },
      { id: "dove", d: "M 70 60 q 18 -14 36 0 q -8 2 -10 8 q 14 -2 22 8 q -22 6 -34 -4 q -10 4 -14 -12 Z" },
    ],
    lines: ["M 60 255 H 340", "M 70 275 H 330"],
  },
  {
    key: "bethlehem",
    title: "The star over Bethlehem",
    reference: "Matthew 2:10",
    regions: [
      { id: "sky", d: rect(0, 0, 400, 400) },
      { id: "star", d: star(200, 80, 48, 20) },
      { id: "moon", d: "M 60 40 a 30 30 0 1 0 30 50 a 24 24 0 1 1 -30 -50 Z" },
      { id: "star-small1", d: star(320, 50, 12, 5) },
      { id: "star-small2", d: star(100, 140, 10, 4) },
      { id: "star-small3", d: star(350, 150, 10, 4) },
      { id: "far-hill", d: hill(280, 190) },
      { id: "stable", d: rect(120, 230, 160, 110) },
      { id: "stable-roof", d: poly([100, 235], [200, 175], [300, 235]) },
      { id: "doorway", d: "M 170 340 V 280 Q 200 255 230 280 V 340 Z" },
      { id: "manger", d: poly([178, 312], [222, 312], [214, 338], [186, 338]) },
      { id: "baby", d: ellipse(200, 306, 16, 8) },
      { id: "ground", d: hill(350, 330) },
    ],
    lines: ["M 200 134 L 200 168", "M 184 132 L 170 166", "M 216 132 L 230 166"],
  },
  {
    key: "jonah",
    title: "Jonah and the big fish",
    reference: "Jonah 1:17",
    regions: [
      { id: "sky", d: rect(0, 0, 400, 400) },
      { id: "sun", d: ellipse(60, 60, 30) },
      cloud("cloud", 260, 70, 22),
      { id: "boat", d: poly([240, 150], [360, 150], [340, 180], [260, 180]) },
      { id: "sail", d: poly([300, 70], [300, 145], [350, 145]) },
      { id: "sea", d: waves(180, 10, 8) },
      { id: "fish", d: ellipse(180, 290, 120, 62) },
      { id: "tail", d: poly([290, 290], [370, 240], [355, 290], [370, 340]) },
      { id: "fin", d: poly([170, 232], [205, 195], [215, 236]) },
      { id: "belly", d: "M 90 310 Q 180 360 270 310 Q 180 340 90 310 Z" },
      { id: "eye", d: ellipse(100, 270, 12) },
      { id: "pupil", d: ellipse(102, 270, 5) },
      { id: "bubble1", d: ellipse(50, 230, 8) },
      { id: "bubble2", d: ellipse(40, 205, 5) },
    ],
    lines: ["M 66 300 Q 80 310 96 302"],
  },
  {
    key: "tomb",
    title: "The empty tomb",
    reference: "Matthew 28:6",
    regions: [
      { id: "sky", d: rect(0, 0, 400, 400) },
      { id: "sun", d: ellipse(310, 90, 46) },
      cloud("cloud", 40, 80, 20),
      { id: "hill", d: hill(260, 170) },
      { id: "tomb", d: "M 90 300 Q 90 170 200 170 Q 310 170 310 300 Z" },
      { id: "doorway", d: "M 160 300 Q 160 230 200 230 Q 240 230 240 300 Z" },
      { id: "stone", d: ellipse(318, 262, 40) },
      { id: "grass", d: waves(300, 12, 10) },
      ...flower("flower1", 60, 330, 12),
      ...flower("flower2", 130, 355, 10),
      ...flower("flower3", 360, 345, 12),
    ],
    lines: ["M 300 240 Q 312 262 300 284", "M 330 236 Q 342 262 332 290"],
  },
  {
    key: "cross",
    title: "The cross on the hill",
    reference: "John 3:16",
    regions: [
      { id: "sky", d: rect(0, 0, 400, 400) },
      { id: "sun", d: ellipse(200, 250, 90) },
      cloud("cloud1", 30, 70, 22),
      cloud("cloud2", 270, 50, 18),
      { id: "hill", d: hill(300, 230) },
      { id: "cross", d: poly([188, 90], [212, 90], [212, 140], [256, 140], [256, 162], [212, 162], [212, 270], [188, 270], [188, 162], [144, 162], [144, 140], [188, 140]) },
      { id: "heart", d: "M 200 345 C 160 320 160 290 182 290 C 192 290 200 298 200 306 C 200 298 208 290 218 290 C 240 290 240 320 200 345 Z" },
      { id: "grass", d: waves(360, 10, 8) },
    ],
  },
  {
    key: "dove",
    title: "The dove with an olive leaf",
    reference: "Genesis 8:11",
    regions: [
      { id: "sky", d: rect(0, 0, 400, 400) },
      cloud("cloud1", 30, 330, 24),
      cloud("cloud2", 280, 360, 20),
      { id: "body", d: "M 90 220 Q 150 150 250 180 Q 300 195 320 170 Q 330 200 300 225 Q 220 270 130 250 Q 100 245 90 220 Z" },
      { id: "wing", d: "M 160 195 Q 200 80 300 60 Q 270 140 230 200 Z" },
      { id: "head", d: ellipse(110, 205, 30) },
      { id: "beak", d: poly([82, 200], [55, 212], [84, 216]) },
      { id: "eye", d: ellipse(104, 198, 5) },
      { id: "branch", d: "M 60 214 Q 40 240 30 270 L 34 272 Q 46 242 64 218 Z" },
      { id: "leaf1", d: "M 40 250 Q 20 240 14 220 Q 36 228 40 250 Z" },
      { id: "leaf2", d: "M 34 266 Q 58 268 66 288 Q 42 286 34 266 Z" },
    ],
    lines: ["M 196 188 Q 226 140 262 96", "M 214 196 Q 240 160 276 112"],
  },
  {
    key: "loaves",
    title: "Five loaves and two fish",
    reference: "John 6:9",
    regions: [
      { id: "background", d: rect(0, 0, 400, 400) },
      { id: "cloth", d: poly([30, 330], [370, 330], [340, 390], [60, 390]) },
      { id: "basket", d: "M 70 230 H 330 L 300 340 H 100 Z" },
      { id: "basket-rim", d: rect(60, 220, 280, 20) },
      { id: "loaf1", d: ellipse(120, 205, 42, 28) },
      { id: "loaf2", d: ellipse(200, 195, 42, 30) },
      { id: "loaf3", d: ellipse(280, 205, 42, 28) },
      { id: "loaf4", d: ellipse(160, 165, 38, 26) },
      { id: "loaf5", d: ellipse(240, 165, 38, 26) },
      { id: "fish1", d: "M 90 90 Q 140 50 190 90 Q 140 130 90 90 Z" },
      { id: "fish1-tail", d: poly([190, 90], [220, 66], [220, 114]) },
      { id: "fish2", d: "M 210 120 Q 260 80 310 120 Q 260 160 210 120 Z" },
      { id: "fish2-tail", d: poly([310, 120], [340, 96], [340, 144]) },
    ],
    lines: ["M 100 260 H 310", "M 108 290 H 302", "M 112 316 H 296", "M 110 86 a 3 3 0 1 0 0.1 0", "M 230 116 a 3 3 0 1 0 0.1 0"],
  },
  {
    key: "lamb",
    title: "The Good Shepherd's lamb",
    reference: "John 10:11",
    regions: [
      { id: "sky", d: rect(0, 0, 400, 400) },
      { id: "sun", d: ellipse(330, 70, 36) },
      cloud("cloud", 40, 80, 22),
      { id: "tree-trunk", d: rect(52, 170, 26, 140) },
      { id: "tree-top", d: ellipse(65, 160, 55, 50) },
      { id: "field", d: hill(300, 250) },
      { id: "leg1", d: rect(170, 290, 16, 60) },
      { id: "leg2", d: rect(200, 295, 16, 58) },
      { id: "leg3", d: rect(250, 295, 16, 58) },
      { id: "leg4", d: rect(280, 290, 16, 60) },
      { id: "wool1", d: ellipse(190, 260, 46) },
      { id: "wool2", d: ellipse(240, 250, 50) },
      { id: "wool3", d: ellipse(285, 265, 40) },
      { id: "wool4", d: ellipse(230, 290, 52, 28) },
      { id: "head", d: ellipse(150, 230, 34, 40) },
      { id: "ear", d: ellipse(178, 205, 18, 9) },
      { id: "eye", d: ellipse(140, 222, 5) },
      { id: "flower", d: star(340, 360, 16, 8) },
    ],
    lines: ["M 136 252 Q 146 260 156 252"],
  },
];

export function coloringPicture(key: string): ColoringPicture | undefined {
  return COLORING_PICTURES.find((p) => p.key === key);
}

/** Crayon box: bright, kid-friendly colours plus white (to rub out). */
export const COLORING_PALETTE = [
  "#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#3949ab", "#8e24aa", "#ec407a",
  "#8d6e63", "#5d4037", "#90caf9", "#a5d6a7", "#fff59d", "#ffccbc", "#9e9e9e", "#212121",
  "#ffffff",
] as const;
