// Builds every brand file:
//   public/brand/grace-bound-ventures.svg/.png  the company logo (butterflies, lib/brand/butterfly.json)
//   public/brand/grace-logo.svg/.png            the Grace app logo, cross + name (light backgrounds)
//   public/brand/grace-logo-dark.svg/.png       the same for dark backgrounds
//   public/icons/*.png                          Grace app icons: Home Screen, install, Apple, favicon
// Run after changing the artwork:  node scripts/build-brand.mjs
//
// Logo fonts (Great Vibes, Montserrat — both SIL Open Font License, see
// public/fonts/poster/OFL-*.txt) are embedded in the SVGs so they look right
// anywhere. Rendering uses the Playwright browser installed for the E2E tests.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const art = JSON.parse(readFileSync(join(root, "lib/brand/butterfly.json"), "utf8"));
const font = (name, file) =>
  `@font-face{font-family:'${name}';src:url(data:font/woff2;base64,${readFileSync(join(root, "public/fonts/poster", file)).toString("base64")}) format('woff2');}`;
const FONTS = font("Great Vibes", "great-vibes.woff2") + font("Montserrat", "montserrat.woff2");

const gradient = (id, colors, x1 = 0, y1 = 0, x2 = 1, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${colors
    .map((c, i) => `<stop offset="${i / (colors.length - 1)}" stop-color="${c}"/>`)
    .join("")}</linearGradient>`;
const DEFS = [
  gradient("rose", art.colors.rose),
  gradient("teal", art.colors.teal, 1, 0, 0, 1),
  gradient("roseText", art.colors.roseText, 0, 0, 1, 0),
  gradient("ring", art.colors.ring),
].join("");

function butterfly({ left = "rose", right = "teal", body = art.colors.body } = {}) {
  const half = (wing, mirror) => `<g${mirror ? ' transform="matrix(-1 0 0 1 100 0)"' : ""}>
    <path d="${art.wingUpper}" fill="url(#${wing})"/><path d="${art.wingLower}" fill="url(#${wing})" opacity="0.92"/>
    <path d="${art.veins}" fill="none" stroke="#fff" stroke-width="0.7" stroke-linecap="round" opacity="0.55"/>
    ${art.spots.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="0.8"/>`).join("")}</g>`;
  return `${half(right, false)}${half(left, true)}
    <path d="${art.antennae}" fill="none" stroke="${body}" stroke-width="0.9" stroke-linecap="round"/>
    <circle cx="38.5" cy="23.5" r="1.1" fill="${body}"/><circle cx="61.5" cy="23.5" r="1.1" fill="${body}"/>
    <path d="${art.body}" stroke="${body}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="${art.crossbar}" stroke="${body}" stroke-width="2.2" stroke-linecap="round"/>`;
}
// The Grace cross — same drawing as components/brand/Cross.tsx.
const CROSS_DEFS = `<linearGradient id="cv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fe3e7"/><stop offset=".45" stop-color="#3fb6c2"/><stop offset="1" stop-color="#136f80"/></linearGradient>
<linearGradient id="ch" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3fb6c2"/><stop offset=".5" stop-color="#9fe3e7"/><stop offset="1" stop-color="#3fb6c2"/></linearGradient>
<radialGradient id="cg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#f7a8c8" stop-opacity=".95"/><stop offset=".4" stop-color="#e8679b" stop-opacity=".45"/><stop offset="1" stop-color="#e8679b" stop-opacity="0"/></radialGradient>
<linearGradient id="nameText" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#127a88"/><stop offset=".55" stop-color="#2fa3b0"/><stop offset="1" stop-color="#c2387a"/></linearGradient>
<linearGradient id="nameTextDark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9fe3e7"/><stop offset=".55" stop-color="#e6f8f9"/><stop offset="1" stop-color="#f7a8c8"/></linearGradient>`;
const cross = (halo = true) => `${halo ? '<circle cx="50" cy="50" r="45" fill="none" stroke="#3fb6c2" stroke-width="0.9" opacity="0.5"/>' : ""}
<circle cx="50" cy="36" r="17" fill="url(#cg)"/>
<rect x="45.5" y="9" width="9" height="82" rx="4.5" fill="url(#cv)"/>
<rect x="25" y="31.5" width="50" height="9" rx="4.5" fill="url(#ch)"/>
<path d="M50 30.2 L55.8 36 L50 41.8 L44.2 36Z" fill="#f39ac0"/>
<path d="M50 32.6 L53.4 36 L50 39.4 L46.6 36Z" fill="#fde2ee"/>`;

const sparkle = (x, y, s, fill, opacity = 1) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -10 C1 -3 3 -1 10 0 C3 1 1 3 0 10 C-1 3 -3 1 -10 0 C-3 -1 -1 -3 0 -10Z" fill="${fill}" opacity="${opacity}"/>`;

// The company logo, refined from the original: same composition (ring,
// butterflies, script name, VENTURES), with finer lines and gradients.
const ventures = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
<title>Grace-bound Ventures</title>
<defs>${DEFS}<style>${FONTS}</style></defs>
<circle cx="500" cy="500" r="400" fill="none" stroke="url(#ring)" stroke-width="7"/>
<circle cx="500" cy="500" r="417" fill="none" stroke="url(#ring)" stroke-width="1.5" opacity="0.5"/>
<g transform="translate(190 52) scale(2.2) rotate(-14 50 50)">${butterfly({ left: "rose", right: "rose" })}</g>
<g transform="translate(590 46) scale(2.2) rotate(12 50 50)">${butterfly({ left: "teal", right: "teal" })}</g>
<g transform="translate(392 712) scale(1.05) rotate(-20 50 50)" opacity="0.9">${butterfly({ left: "rose", right: "rose" })}</g>
<g transform="translate(508 724) scale(0.82) rotate(18 50 50)" opacity="0.9">${butterfly({ left: "rose", right: "rose" })}</g>
<text id="name" x="500" y="540" text-anchor="middle" font-family="Great Vibes" font-size="168" fill="url(#roseText)">Grace-bound</text>
<text id="ventures" x="510" y="640" text-anchor="middle" font-family="Montserrat" font-weight="500" font-size="54" letter-spacing="19" fill="${art.colors.ventures}">VENTURES</text>
${sparkle(460, 300, 0.9, "#e8679b", 0.7)}${sparkle(540, 296, 0.7, "#3fb6c2")}${sparkle(790, 660, 1.2, "#e8679b", 0.85)}${sparkle(214, 650, 0.8, "#3fb6c2", 0.7)}
</svg>`;

// The app logo: the cross beside "Grace", with the maker's name.
const appLogo = (dark) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 400">
<title>Grace by Grace-bound Ventures</title>
<defs>${CROSS_DEFS}<style>${FONTS}</style></defs>
<g transform="translate(40 50) scale(3)">${cross()}</g>
<text x="380" y="245" font-family="Great Vibes" font-size="220" fill="url(#${dark ? "nameTextDark" : "nameText"})">Grace</text>
<text x="420" y="335" font-family="Montserrat" font-weight="500" font-size="22" letter-spacing="7" fill="${dark ? "#9fdfe4" : art.colors.ventures}">BY GRACE-BOUND VENTURES</text>
</svg>`;

// App icon: the cross on deep aubergine with a soft teal glow.
const icon = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs>${CROSS_DEFS}
<radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#3f1a4b"/><stop offset="1" stop-color="#160a1c"/></radialGradient>
<radialGradient id="glow" cx="50%" cy="42%" r="45%"><stop offset="0" stop-color="#3fb6c2" stop-opacity="0.3"/><stop offset="1" stop-color="#3fb6c2" stop-opacity="0"/></radialGradient></defs>
<rect width="512" height="512" fill="url(#bg)"/><rect width="512" height="512" fill="url(#glow)"/>
<g transform="translate(256 256) scale(${4.4 * scale}) translate(-50 -50)">${cross(false)}</g>
</svg>`;

mkdirSync(join(root, "public/brand"), { recursive: true });
const files = {
  "public/brand/grace-bound-ventures.svg": ventures,
  "public/brand/grace-logo.svg": appLogo(false),
  "public/brand/grace-logo-dark.svg": appLogo(true),
  "public/icons/icon.svg": icon(1),
};
for (const [path, svg] of Object.entries(files)) writeFileSync(join(root, path), svg);

const PNGS = [
  ["public/brand/grace-bound-ventures.png", ventures, 1024, 1024, "transparent"],
  ["public/brand/grace-logo.png", appLogo(false), 1200, 480, "transparent"],
  ["public/brand/grace-logo-dark.png", appLogo(true), 1200, 480, "transparent"],
  ["public/icons/icon-192.png", icon(1), 192, 192],
  ["public/icons/icon-512.png", icon(1), 512, 512],
  ["public/icons/icon-maskable-512.png", icon(0.78), 512, 512],
  ["public/icons/apple-touch-icon.png", icon(1), 180, 180],
  ["public/icons/favicon-32.png", icon(1.15), 32, 32],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [path, svg, width, height, bg] of PNGS) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<html><body style="margin:0;background:${bg ?? "#1a0b21"}">${svg.replace("<svg ", `<svg width="${width}" height="${height}" `)}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, path), omitBackground: bg === "transparent" });
  console.log("✓", path);
}
await browser.close();
