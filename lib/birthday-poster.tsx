import "server-only";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";

// No photo (older members we have no picture of): a gold monogram in a laurel
// wreath with the name large instead. Children get the bright "kids" look.
//
// A birthday poster (PNG, 1080×1350 — the 4:5 shape phones show best) for the
// General chat, drawn on the server and sent from the church: its logo at the
// top, a gold script "Happy Birthday", the person's photo (or initials) in a
// tall arch frame with balloons, their name on a gold ribbon, the date and a
// blessing. Two looks — black & gold and blush & gold — so posters vary.

export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1350;

export const POSTER_THEMES = ["gold", "rose", "royal", "sunset", "ivory", "navy"] as const;
/** The adult looks take turns; children always get the bright "kids" look. */
export type PosterTheme = (typeof POSTER_THEMES)[number] | "kids";

type Look = {
  bg: string;
  glow: string;
  text: string;
  soft: string;
  /** Gold foil for the frame, badge and ribbon. */
  frame: string;
  ribbonText: string;
  balloons: string[];
  sparkle: string;
  /** Behind the photo / initials, and inside the date badge. */
  photoBg: string;
  badgeBg: string;
  dark: boolean;
  /** A tall arch, or a round portrait. */
  shape: "arch" | "circle";
  /** Initials colour on no-photo posters (default: `sparkle`). */
  monogram?: string;
  /** Multicoloured confetti (default: all `sparkle`). */
  confetti?: string[];
};

const GOLD_FOIL = "linear-gradient(135deg, #a8771f, #f7e2a4 35%, #c9952f 60%, #fff1c4 85%, #b0832a)";

const THEMES: Record<PosterTheme, Look> = {
  // Bright sky, sunshine and party colours, for children.
  kids: {
    bg: "linear-gradient(165deg, #1e88e5 0%, #4fc3f7 50%, #ffe082 100%)",
    glow: "rgba(255,255,255,0.45)", text: "#0b2545", soft: "rgba(11,37,69,0.85)", frame: GOLD_FOIL, ribbonText: "#0b2545",
    balloons: ["#f43f5e", "#facc15", "#22c55e", "#a855f7"], sparkle: "#ffffff", photoBg: "#bbdefb", badgeBg: "#f43f5e", dark: true, shape: "circle",
    confetti: ["#f43f5e", "#facc15", "#22c55e", "#a855f7", "#ffffff"], monogram: "#e11d48",
  },
  // Black & gold, arch (like the gold-balloon samples).
  gold: {
    bg: "linear-gradient(170deg, #17111c 0%, #2a1631 50%, #120c14 100%)",
    glow: "rgba(243,201,105,0.22)", text: "#ffffff", soft: "rgba(255,255,255,0.78)", frame: GOLD_FOIL, ribbonText: "#2a1631",
    balloons: ["#d9a93a", "#f3d27a", "#1d1520", "#b8862b"], sparkle: "#f3c969", photoBg: "#3a1f42", badgeBg: "#1d1220", dark: true, shape: "arch",
  },
  // Blush pink & gold, arch.
  rose: {
    bg: "linear-gradient(170deg, #fbe4ea 0%, #f5c9d5 55%, #eab2c2 100%)",
    glow: "rgba(255,255,255,0.55)", text: "#4a1830", soft: "rgba(74,24,48,0.75)",
    frame: "linear-gradient(135deg, #b98a3a, #f6dfa2 35%, #c9a04a 60%, #fff0c6 85%, #b48433)", ribbonText: "#4a1830",
    balloons: ["#e98aa8", "#f7c6d4", "#d4a94a", "#c2577d"], sparkle: "#c9a04a", photoBg: "#f9dbe4", badgeBg: "#ffffff", dark: false, shape: "arch",
  },
  // Wine & gold, round portrait (like the burgundy samples).
  royal: {
    bg: "linear-gradient(165deg, #3d0a1c 0%, #6e1530 50%, #2a0612 100%)",
    glow: "rgba(255,180,120,0.20)", text: "#ffffff", soft: "rgba(255,255,255,0.8)", frame: GOLD_FOIL, ribbonText: "#4a0d22",
    balloons: ["#d9a93a", "#9c1c3c", "#f3d27a", "#c23a5a"], sparkle: "#f3c969", photoBg: "#5a1026", badgeBg: "#3d0a1c", dark: true, shape: "circle",
  },
  // Warm sunset orange & gold, arch (like the glowing orange samples).
  sunset: {
    bg: "linear-gradient(165deg, #3a1204 0%, #a3380c 45%, #f08a1c 100%)",
    glow: "rgba(255,214,120,0.35)", text: "#ffffff", soft: "rgba(255,255,255,0.85)", frame: GOLD_FOIL, ribbonText: "#5a1e06",
    balloons: ["#ffcf5a", "#ff9a3c", "#ffffff", "#e0682a"], sparkle: "#ffd77a", photoBg: "#7a2a08", badgeBg: "#3a1204", dark: true, shape: "arch",
  },
  // Ivory & gold, round portrait (like the white-and-gold samples).
  ivory: {
    bg: "linear-gradient(170deg, #fffdf8 0%, #f6efe0 55%, #ead9b8 100%)",
    glow: "rgba(255,255,255,0.7)", text: "#3a2a12", soft: "rgba(58,42,18,0.75)", frame: GOLD_FOIL, ribbonText: "#3a2a12",
    balloons: ["#e2c178", "#ffffff", "#c9a04a", "#f1dfb0"], sparkle: "#b8892e", photoBg: "#f3e6c9", badgeBg: "#ffffff", dark: false, shape: "circle",
  },
  // Navy & gold, round portrait (like the blue-and-gold samples).
  navy: {
    bg: "linear-gradient(170deg, #0a1433 0%, #13245a 50%, #070d24 100%)",
    glow: "rgba(120,170,255,0.22)", text: "#ffffff", soft: "rgba(255,255,255,0.8)", frame: GOLD_FOIL, ribbonText: "#0a1433",
    balloons: ["#d9a93a", "#2c4fa8", "#f3d27a", "#ffffff"], sparkle: "#f3c969", photoBg: "#1c2f6b", badgeBg: "#0a1433", dark: true, shape: "circle",
  },
};

/** The look for a given day — the six take turns, so the posters vary. */
export function posterThemeFor(date: string, index = 0): PosterTheme {
  const d = new Date(`${date}T12:00:00Z`);
  const dayOfYear = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000);
  return POSTER_THEMES[(dayOfYear + index) % POSTER_THEMES.length];
}

/**
 * A poster font: the app's own copy (public/fonts/poster/*.woff — the renderer
 * reads WOFF, not WOFF2; bundled with the morning job by next.config.js), or
 * null so the poster falls back to the built-in sans.
 */
async function posterFont(file: string): Promise<ArrayBuffer | null> {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public/fonts/poster", file));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  } catch {
    const site = process.env.NEXT_PUBLIC_APP_URL;
    if (!site) return null;
    try {
      const res = await fetch(`${site.replace(/\/$/, "")}/fonts/poster/${file}`, { signal: AbortSignal.timeout(5000) });
      return res.ok ? await res.arrayBuffer() : null;
    } catch {
      return null;
    }
  }
}

/**
 * Any picture (profile photos are usually WebP, which the poster renderer
 * can't read) as a PNG data URL, at most `max` pixels across; null if it
 * can't be read.
 */
export async function pictureForPoster(bytes: ArrayBuffer | Buffer, max = 720): Promise<string | null> {
  try {
    const png = await sharp(Buffer.from(bytes as ArrayBuffer)).rotate().resize(max, max, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Sparkles and confetti: fixed positions, so every poster is lively but tidy. */
const SPARKLES: [number, number, number][] = [
  [70, 300, 7], [150, 230, 4], [990, 260, 6], [930, 340, 4], [60, 700, 5], [1020, 690, 7], [110, 1010, 4], [1035, 900, 5],
  [210, 160, 3], [860, 150, 4], [40, 520, 3], [1045, 520, 3], [60, 1250, 4], [1010, 1240, 4],
];

/** Laurel leaves around the monogram (no-photo posters): two arcs with a gap at the bottom. */
const LEAVES: [number, number, number][] = Array.from({ length: 22 }, (_, i) => {
  // From the bottom-left round the top to the bottom-right, skipping the bottom.
  const deg = 120 + (i * 300) / 21;
  const rad = (deg * Math.PI) / 180;
  return [260 + 225 * Math.cos(rad), 260 + 225 * Math.sin(rad), deg + 90 + (i % 2 ? 22 : -22)];
});

function Balloon({ x, y, size, colour, tilt }: { x: number; y: number; size: number; colour: string; tilt: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", flexDirection: "column", alignItems: "center", transform: `rotate(${tilt}deg)` }}>
      <div
        style={{
          display: "flex",
          width: size,
          height: size * 1.18,
          borderRadius: size,
          background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.75) 0%, ${colour} 28%, ${colour} 70%, rgba(0,0,0,0.25) 100%)`,
          boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
        }}
      />
      <div style={{ display: "flex", width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderBottom: `10px solid ${colour}`, marginTop: -2 }} />
      <div style={{ display: "flex", width: 2, height: size * 0.9, background: "rgba(200,170,110,0.8)" }} />
    </div>
  );
}

export async function birthdayPoster({
  name,
  churchName,
  photoDataUrl,
  logoDataUrl = null,
  date,
  theme = "gold",
  child = false,
}: {
  name: string;
  churchName: string;
  photoDataUrl: string | null;
  logoDataUrl?: string | null;
  /** YYYY-MM-DD — the badge shows day and month only. */
  date: string;
  theme?: PosterTheme;
  /** A child's poster: a blessing for a child. */
  child?: boolean;
}): Promise<ArrayBuffer> {
  const t = THEMES[theme];
  const [script, bold, serif, italic] = await Promise.all([posterFont("great-vibes.woff"), posterFont("montserrat-800.woff"), posterFont("playfair-display-700.woff"), posterFont("playfair-display-italic.woff")]);
  const fonts = [
    ...(script ? [{ name: "Script", data: script, weight: 400 as const, style: "normal" as const }] : []),
    ...(bold ? [{ name: "Bold", data: bold, weight: 800 as const, style: "normal" as const }] : []),
    ...(serif ? [{ name: "Serif", data: serif, weight: 700 as const, style: "normal" as const }] : []),
    ...(italic ? [{ name: "Serif", data: italic, weight: 400 as const, style: "italic" as const }] : []),
  ];
  const round = t.shape === "circle";
  // A tall arch, or a round portrait (a little higher, so the ribbon sits just under it).
  const outer = round
    ? { width: 640, height: 640, borderRadius: 320, marginTop: 30 }
    : { width: 580, height: 700, borderTopLeftRadius: 290, borderTopRightRadius: 290, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 };
  const inner = round ? { borderRadius: 308 } : { borderTopLeftRadius: 278, borderTopRightRadius: 278, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 };
  const BOLD = bold ? { fontFamily: "Bold" } : {};
  // The whole church name, however long — smaller and on two lines if need be.
  const churchFont = churchName.length > 48 ? 20 : churchName.length > 32 ? 23 : 26;
  const trimmed = name.trim();
  const bigNameSize = trimmed.length > 26 ? 56 : trimmed.length > 18 ? 68 : 84;
  const upper = name.trim().toUpperCase();
  // One line on the ribbon wherever possible.
  const nameSize = upper.length > 30 ? 34 : upper.length > 25 ? 38 : upper.length > 20 ? 46 : upper.length > 15 ? 54 : 64;
  const d = new Date(`${date}T12:00:00Z`);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = d.toLocaleDateString("en-ZA", { month: "short", timeZone: "UTC" }).replace(".", "").toUpperCase();

  const badge = (right: number, top: number) => (
    <div style={{ position: "absolute", right, top, display: "flex", width: 150, height: 150, borderRadius: 999, padding: 7, background: t.frame, boxShadow: "0 10px 28px rgba(0,0,0,0.35)" }}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", borderRadius: 999, background: t.badgeBg, alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", ...BOLD, fontSize: 52, lineHeight: 1, color: t.sparkle }}>{day}</div>
        <div style={{ display: "flex", ...BOLD, fontSize: 24, letterSpacing: 3, color: t.text, marginTop: 4 }}>{month}</div>
      </div>
    </div>
  );

  const image = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", position: "relative", background: t.bg, color: t.text, ...(serif ? { fontFamily: "Serif" } : {}) }}>
        {/* soft glows */}
        <div style={{ position: "absolute", top: 260, left: 140, width: 800, height: 800, borderRadius: 999, background: t.glow, filter: "blur(90px)" }} />
        {SPARKLES.map(([x, y, r], i) => (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: r * 2, height: r * 2, borderRadius: i % 4 === 0 ? 2 : 999, background: t.confetti ? t.confetti[i % t.confetti.length] : t.sparkle, opacity: 0.85, transform: `rotate(${i * 31}deg)` }} />
        ))}

        {/* the church: logo and name */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 46 }}>
          {logoDataUrl && (
            <div style={{ display: "flex", width: 92, height: 92, borderRadius: 999, background: "#ffffff", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 6px 18px rgba(0,0,0,0.2)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoDataUrl} width={76} height={76} style={{ objectFit: "contain" }} alt="" />
            </div>
          )}
          <div style={{ display: "flex", ...BOLD, fontSize: churchFont, letterSpacing: churchName.length > 32 ? 3 : 5, lineHeight: 1.25, color: t.sparkle, maxWidth: 820 }}>{churchName.toUpperCase().slice(0, 90)}</div>
        </div>

        <div style={{ display: "flex", ...(script ? { fontFamily: "Script" } : BOLD), fontSize: script ? 150 : 90, color: t.sparkle, lineHeight: 1, marginTop: 18, textShadow: t.dark ? "0 4px 18px rgba(0,0,0,0.5)" : "0 3px 10px rgba(255,255,255,0.6)" }}>
          Happy Birthday
        </div>

        {/* balloons behind the frame */}
        <Balloon x={70} y={430} size={120} colour={t.balloons[0]} tilt={-10} />
        <Balloon x={175} y={560} size={92} colour={t.balloons[1]} tilt={-4} />
        <Balloon x={880} y={420} size={124} colour={t.balloons[2]} tilt={9} />
        <Balloon x={800} y={580} size={90} colour={t.balloons[3]} tilt={5} />

        {photoDataUrl ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* the photo, in a tall gold arch or a round portrait */}
            <div style={{ display: "flex", position: "relative", marginTop: 26 }}>
              <div style={{ display: "flex", ...outer, padding: 12, background: t.frame, boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}>
                <div style={{ display: "flex", width: "100%", height: "100%", ...inner, overflow: "hidden", alignItems: "center", justifyContent: "center", background: t.photoBg }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoDataUrl} width={round ? 616 : 556} height={round ? 616 : 676} style={{ objectFit: "cover", width: "100%", height: "100%" }} alt="" />
                </div>
              </div>
              {badge(-46, 70)}
            </div>
            {/* name on a gold ribbon */}
            <div style={{ display: "flex", marginTop: -46, paddingTop: 16, paddingBottom: 16, paddingLeft: 54, paddingRight: 54, borderRadius: 14, background: t.frame, boxShadow: "0 12px 30px rgba(0,0,0,0.3)", maxWidth: 960 }}>
              <div style={{ display: "flex", ...BOLD, fontSize: nameSize, letterSpacing: 2, color: t.ribbonText, textAlign: "center" }}>{upper}</div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* No photo: a gold monogram in a laurel wreath, then the name, large. */}
            <div style={{ display: "flex", position: "relative", width: 520, height: 520, marginTop: 20, alignItems: "center", justifyContent: "center" }}>
              {LEAVES.map(([x, y, angle], i) => (
                <div key={i} style={{ position: "absolute", left: x - 14, top: y - 30, width: 28, height: 60, borderRadius: 999, background: t.frame, transform: `rotate(${angle}deg)`, opacity: 0.95 }} />
              ))}
              <div style={{ display: "flex", width: 340, height: 340, borderRadius: 999, padding: 12, background: t.frame, boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}>
                <div style={{ display: "flex", width: "100%", height: "100%", borderRadius: 999, background: t.photoBg, alignItems: "center", justifyContent: "center", border: `3px solid ${t.sparkle}` }}>
                  <div style={{ display: "flex", fontSize: 150, color: t.monogram ?? t.sparkle, letterSpacing: 4 }}>{initials(name)}</div>
                </div>
              </div>
              {badge(40, 40)}
            </div>
            <div style={{ display: "flex", fontSize: bigNameSize, color: t.text, marginTop: 6, textAlign: "center", maxWidth: 960, lineHeight: 1.1 }}>{name.trim()}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 22 }}>
              <div style={{ display: "flex", width: 140, height: 3, background: t.frame }} />
              <div style={{ display: "flex", width: 14, height: 14, background: t.sparkle, transform: "rotate(45deg)" }} />
              <div style={{ display: "flex", width: 140, height: 3, background: t.frame }} />
            </div>
            <div style={{ display: "flex", fontSize: 30, color: t.soft, marginTop: 20, textAlign: "center", maxWidth: 860, lineHeight: 1.35 }}>
              {child ? "We thank God for you and pray you grow in His love and grace this year." : "Wishing you a year filled with God’s joy, peace and favour. Thank you for being part of our church family."}
            </div>
          </div>
        )}

        <div style={{ display: "flex", fontSize: 32, color: t.soft, marginTop: 30, textAlign: "center", maxWidth: 860, fontStyle: "italic", lineHeight: 1.35 }}>
          “The Lord bless you and keep you; the Lord make his face shine on you.”
        </div>
        <div style={{ display: "flex", ...BOLD, fontSize: 22, letterSpacing: 3, color: t.sparkle, marginTop: 10 }}>NUMBERS 6:24–25</div>
        <div style={{ display: "flex", marginTop: "auto", marginBottom: 34, fontSize: 24, color: t.soft }}>
          With love, your church family · Celebrating you, {name.trim()}
        </div>
      </div>
    ),
    { width: POSTER_WIDTH, height: POSTER_HEIGHT, fonts: fonts.length ? fonts : undefined },
  );
  return await image.arrayBuffer();
}
