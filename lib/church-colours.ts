// Church colour schemes (Unlimited: church_colours module). A small set of
// palettes checked for contrast (tests/unit/church-colours.test.ts) rather
// than any colour, so buttons and links always stay readable. Each value is
// an "R G B" triple, like the tokens in app/globals.css.

type Tokens = { ember: string; onEmber: string; gold: string; goldDeep: string; goldSoft: string };
export interface Palette {
  key: string;
  label: string;
  swatch: string;
  light: Tokens;
  dark: Tokens;
}

export const PALETTES: readonly Palette[] = [
  { key: "royal", label: "Royal blue", swatch: "#1e40af", light: { ember: "30 64 175", onEmber: "255 255 255", gold: "37 99 235", goldDeep: "29 78 216", goldSoft: "219 234 254" }, dark: { ember: "147 197 253", onEmber: "10 25 60", gold: "147 197 253", goldDeep: "191 219 254", goldSoft: "23 37 84" } },
  { key: "forest", label: "Forest green", swatch: "#166534", light: { ember: "22 101 52", onEmber: "255 255 255", gold: "21 128 61", goldDeep: "21 101 52", goldSoft: "220 252 231" }, dark: { ember: "134 239 172", onEmber: "5 46 22", gold: "134 239 172", goldDeep: "187 247 208", goldSoft: "20 58 36" } },
  { key: "crimson", label: "Crimson", swatch: "#991b1b", light: { ember: "153 27 27", onEmber: "255 255 255", gold: "220 38 38", goldDeep: "153 27 27", goldSoft: "254 226 226" }, dark: { ember: "252 165 165", onEmber: "69 10 10", gold: "252 165 165", goldDeep: "254 202 202", goldSoft: "69 20 20" } },
  { key: "ocean", label: "Ocean", swatch: "#0e7490", light: { ember: "14 116 144", onEmber: "255 255 255", gold: "8 145 178", goldDeep: "14 116 144", goldSoft: "207 250 254" }, dark: { ember: "103 232 249", onEmber: "8 51 68", gold: "103 232 249", goldDeep: "165 243 252", goldSoft: "22 60 70" } },
  { key: "gold", label: "Gold", swatch: "#854d0e", light: { ember: "133 77 14", onEmber: "255 255 255", gold: "202 138 4", goldDeep: "133 77 14", goldSoft: "254 243 199" }, dark: { ember: "250 204 21", onEmber: "66 32 6", gold: "250 204 21", goldDeep: "253 224 71", goldSoft: "66 45 10" } },
  { key: "violet", label: "Violet", swatch: "#5b21b6", light: { ember: "91 33 182", onEmber: "255 255 255", gold: "124 58 237", goldDeep: "91 33 182", goldSoft: "237 233 254" }, dark: { ember: "196 181 253", onEmber: "46 16 101", gold: "196 181 253", goldDeep: "221 214 254", goldSoft: "46 27 90" } },
  { key: "charcoal", label: "Charcoal", swatch: "#1f2937", light: { ember: "31 41 55", onEmber: "255 255 255", gold: "75 85 99", goldDeep: "55 65 81", goldSoft: "229 231 235" }, dark: { ember: "229 231 235", onEmber: "17 24 39", gold: "209 213 219", goldDeep: "229 231 235", goldSoft: "45 50 60" } },
];

const vars = (t: Tokens) => `--ember:${t.ember};--on-ember:${t.onEmber};--gold:${t.gold};--gold-deep:${t.goldDeep};--gold-soft:${t.goldSoft};--teal:${t.goldDeep};`;

/** CSS that swaps the brand colours, in light, dark and the dark sidebar. Empty for the default. */
export function paletteCss(key: string | null | undefined): string {
  const p = PALETTES.find((x) => x.key === key);
  if (!p) return "";
  return `:root{${vars(p.light)}}:root[data-theme="dark"],.scope-dark{${vars(p.dark)}}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars(p.dark)}}}`;
}
