// Downloads the poster editor's fonts into public/fonts/poster/ so the app
// serves them itself (no requests to Google from members' browsers — POPIA,
// and posters export with exactly the fonts shown). Run only when changing
// the font list:
//
//   node scripts/fetch-poster-fonts.mjs
//
// Every font here is under the SIL Open Font License, which allows bundling
// in an app; each family's licence text is saved next to it (OFL-<slug>.txt).
// Only the "latin" subset is kept (covers English and Afrikaans accents).
// Keep this list in step with lib/posters/fonts.ts.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "fonts", "poster");
// A modern browser user agent makes Google Fonts return woff2 (and variable fonts where available).
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

// family, CSS API axis spec, google/fonts repo folder (for the licence)
const FONTS = [
  ["Manrope", "wght@200..800", "manrope"],
  ["Montserrat", "wght@100..900", "montserrat"],
  ["Raleway", "wght@100..900", "raleway"],
  ["League Spartan", "wght@100..900", "leaguespartan"],
  ["DM Sans", "wght@100..1000", "dmsans"],
  ["Oswald", "wght@200..700", "oswald"],
  ["Bebas Neue", "wght@400", "bebasneue"],
  ["Anton", "wght@400", "anton"],
  ["Playfair Display", "wght@400..900", "playfairdisplay"],
  ["Cinzel", "wght@400..900", "cinzel"],
  ["Lora", "wght@400..700", "lora"],
  ["Cormorant Garamond", "wght@300..700", "cormorantgaramond"],
  ["DM Serif Display", "wght@400", "dmserifdisplay"],
  ["Dancing Script", "wght@400..700", "dancingscript"],
  ["Great Vibes", "wght@400", "greatvibes"],
  ["Pacifico", "wght@400", "pacifico"],
];

const slug = (family) => family.toLowerCase().replace(/\s+/g, "-");

async function get(url, as = "text") {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return as === "text" ? res.text() : Buffer.from(await res.arrayBuffer());
}

fs.mkdirSync(OUT, { recursive: true });
for (const [family, axes, repoDir] of FONTS) {
  const css = await get(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:${axes}&display=swap`);
  // Blocks look like: /* latin */ @font-face { ... src: url(https://...woff2) format('woff2'); ... }
  const latin = css.split("/*").find((block) => block.trimStart().startsWith("latin */"));
  const url = latin?.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  if (!url) throw new Error(`No latin woff2 found for ${family}`);
  const file = `${slug(family)}.woff2`;
  fs.writeFileSync(path.join(OUT, file), await get(url, "buffer"));

  // The licence lives in google/fonts under ofl/<folder>/OFL.txt.
  const licence = await get(`https://raw.githubusercontent.com/google/fonts/main/ofl/${repoDir}/OFL.txt`);
  if (!/SIL OPEN FONT LICENSE/i.test(licence)) throw new Error(`${family} is not OFL — don't bundle it`);
  fs.writeFileSync(path.join(OUT, `OFL-${slug(family)}.txt`), licence);
  console.log(`${family}: ${file} (${(fs.statSync(path.join(OUT, file)).size / 1024).toFixed(0)} KB)`);
}
