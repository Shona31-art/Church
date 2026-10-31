import { useId } from "react";

/**
 * Original illustrations for the prayer wall: one small scene per prayer
 * category (drawn here as SVG, so they're crisp, light and need no image
 * files), a golden one for answered prayers, and the wall's banner. All are
 * decorative (aria-hidden); the card text carries the meaning.
 */

export type PrayerTheme = "family" | "health" | "career" | "ministry" | "personal" | "answered" | "general";

export const PRAYER_THEMES: Record<PrayerTheme, { label: string; sky: [string, string, string]; accent: string }> = {
  family: { label: "Family", sky: ["#3b1830", "#8a3b5c", "#f2a07b"], accent: "#ffd2b0" },
  health: { label: "Health", sky: ["#0b2a3a", "#1f6f80", "#9fe3e7"], accent: "#e8fbfb" },
  career: { label: "Career", sky: ["#1d1640", "#6b3f8f", "#f6b26b"], accent: "#ffe2a8" },
  ministry: { label: "Ministry", sky: ["#081433", "#23407a", "#e9b553"], accent: "#fff1c9" },
  personal: { label: "Personal growth", sky: ["#0d2b22", "#2f6b4f", "#cde8a6"], accent: "#f2ffd9" },
  answered: { label: "Answered", sky: ["#3a2205", "#b9771f", "#ffe7a3"], accent: "#fffbe8" },
  general: { label: "Prayer", sky: ["#0a1030", "#2a2560", "#b98ad6"], accent: "#ffe7b0" },
};

export function prayerTheme(category: string | null | undefined, answered: boolean): PrayerTheme {
  if (answered) return "answered";
  return category && category in PRAYER_THEMES ? (category as PrayerTheme) : "general";
}

/** Little four-pointed stars, placed deterministically so server and client agree. */
function Stars({ seed, fill, count = 9 }: { seed: number; fill: string; count?: number }) {
  return (
    <g fill={fill}>
      {Array.from({ length: count }, (_, i) => {
        const x = (seed * 37 + i * 53) % 400;
        const y = 8 + ((seed * 11 + i * 29) % 52);
        const r = 0.8 + ((i * 7 + seed) % 3) * 0.55;
        return <circle key={i} cx={x} cy={y} r={r} opacity={0.45 + (i % 3) * 0.2} className="pw-twinkle" style={{ animationDelay: `${(i % 5) * 0.7}s` }} />;
      })}
    </g>
  );
}

function Scene({ theme }: { theme: PrayerTheme }) {
  const { accent } = PRAYER_THEMES[theme];
  switch (theme) {
    case "family":
      // A home on a hill at dusk, a light in the window, a heart rising.
      return (
        <>
          <path d="M0 120V92c70-18 150-22 210-10s130 10 190-4v42z" fill="#2a1022" opacity="0.9" />
          <g transform="translate(182 58)">
            <path d="M0 26 22 8l22 18v30H0z" fill="#1c0a17" />
            <path d="M-4 28 22 4l26 24" stroke="#1c0a17" strokeWidth="5" strokeLinejoin="round" fill="none" />
            <rect x="15" y="34" width="14" height="12" rx="1.5" fill={accent} className="pw-glow" />
          </g>
          <path d="M204 40c-4-6-14-3-12 5 1 5 12 11 12 11s11-6 12-11c2-8-8-11-12-5z" fill="#ff8fb3" className="pw-float" />
        </>
      );
    case "health":
      // A dove in flight with an olive sprig, over calm water.
      return (
        <>
          <path d="M0 120V96c50 6 100-6 150 0s110 8 150 0 70-6 100 0v24z" fill="#062030" opacity="0.85" />
          <path d="M0 104c60-6 120 6 200 0s140 4 200-2" stroke={accent} strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
          <g transform="translate(150 22)">
          <g className="pw-float">
            <path d="M40 30c-18-2-34 4-40 14 14-4 26-4 36 0z" fill="#ffffff" opacity="0.92" />
            <path d="M38 30c4-18 18-28 36-30-8 10-12 20-12 30z" fill="#ffffff" />
            <path d="M38 30c10 0 24 4 34 12-12 2-24 0-34-6z" fill="#e6f7f8" />
            <circle cx="66" cy="38" r="1.6" fill="#0b2a3a" />
            <path d="M72 41l8 2-8 2" fill="#f2c26b" />
            <path d="M80 44c6 2 12 6 14 12" stroke="#5f8f3a" strokeWidth="1.6" fill="none" />
            <ellipse cx="88" cy="50" rx="4" ry="2" fill="#7fae4a" transform="rotate(30 88 50)" />
            <ellipse cx="93" cy="56" rx="4" ry="2" fill="#7fae4a" transform="rotate(60 93 56)" />
          </g>
          </g>
        </>
      );
    case "career":
      // A path winding up toward the rising sun.
      return (
        <>
          <circle cx="250" cy="92" r="34" fill={accent} opacity="0.95" className="pw-glow" />
          <path d="M0 120V84l60-22 50 18 70-34 80 30 60-20 80 28v36z" fill="#2a1c4e" />
          <path d="M0 120V100l90-14 80 10 90-18 140 16v26z" fill="#160f30" />
          <path d="M150 120c20-10 40-16 60-22s34-10 40-14" stroke={accent} strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" fill="none" />
        </>
      );
    case "ministry":
      // A cross on a hill, rays of light behind it.
      return (
        <>
          <g opacity="0.55" className="pw-rays" style={{ transformOrigin: "200px 70px" }}>
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d="M200 70 192 -60h16z" fill={accent} opacity={i % 2 ? 0.25 : 0.45} transform={`rotate(${i * 30} 200 70)`} />
            ))}
          </g>
          <path d="M0 120V100c60-14 120-30 200-30s140 16 200 30v20z" fill="#061026" />
          <g className="pw-glow">
            <rect x="196" y="30" width="8" height="44" rx="1.5" fill={accent} />
            <rect x="184" y="42" width="32" height="7" rx="1.5" fill={accent} />
          </g>
        </>
      );
    case "personal":
      // A seedling opening its leaves in the morning light.
      return (
        <>
          <circle cx="200" cy="58" r="30" fill={accent} opacity="0.18" className="pw-glow" />
          <path d="M0 120V98c80-10 140-6 200-6s130-2 200 6v22z" fill="#0a2018" />
          <g transform="translate(200 94)">
          <g className="pw-sway">
            <path d="M0 0V-34" stroke="#9ccf6a" strokeWidth="3" strokeLinecap="round" />
            <path d="M0-26c-4-14-18-20-30-16 4 12 16 18 30 16z" fill="#8cc65a" />
            <path d="M0-32c6-14 20-18 32-12-6 12-18 16-32 12z" fill="#b6e07e" />
          </g>
          </g>
        </>
      );
    case "answered":
      // A golden sunburst and cross: this prayer has been answered.
      return (
        <>
          <g className="pw-rays" style={{ transformOrigin: "200px 64px" }}>
            {Array.from({ length: 18 }, (_, i) => (
              <path key={i} d="M200 64 195 -80h10z" fill="#fff6d0" opacity={i % 2 ? 0.25 : 0.55} transform={`rotate(${i * 20} 200 64)`} />
            ))}
          </g>
          <circle cx="200" cy="64" r="26" fill="#fff3c4" opacity="0.9" className="pw-glow" />
          <rect x="196" y="40" width="8" height="46" rx="1.5" fill="#b9771f" />
          <rect x="183" y="52" width="34" height="7" rx="1.5" fill="#b9771f" />
          <path d="M0 120V104c70-8 130-10 200-10s130 2 200 10v16z" fill="#4a2a06" opacity="0.6" />
        </>
      );
    default:
      // A single candle burning in the dark.
      return (
        <>
          <circle cx="200" cy="58" r="38" fill={accent} opacity="0.18" className="pw-glow" />
          <rect x="190" y="66" width="20" height="40" rx="3" fill="#f3e6d2" />
          <path d="M200 66v-6" stroke="#3a2a1a" strokeWidth="1.5" />
          <path d="M200 38c-7 10-8 16-4 20 2 2 6 2 8 0 4-4 3-10-4-20z" fill="#ffcf6a" className="pw-flame" style={{ transformOrigin: "200px 60px" }} />
          <path d="M200 48c-3 5-3 8-1 10h2c2-2 2-5-1-10z" fill="#fff8de" />
          <path d="M0 120v-14h400v14z" fill="#05081c" />
        </>
      );
  }
}

/** The artwork strip at the top of a prayer card. */
export function PrayerArt({ theme, seed = 1, className = "" }: { theme: PrayerTheme; seed?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const [top, mid, low] = PRAYER_THEMES[theme].sky;
  return (
    <svg aria-hidden viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice" className={`block h-full w-full ${className}`}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="0.6" stopColor={mid} />
          <stop offset="1" stopColor={low} />
        </linearGradient>
      </defs>
      <rect width="400" height="120" fill={`url(#${id}-sky)`} />
      {theme !== "answered" && <Stars seed={seed} fill={PRAYER_THEMES[theme].accent} />}
      <Scene theme={theme} />
    </svg>
  );
}

/** The prayer wall's banner: candles lit beneath a glowing cross, in midnight and gold. */
export function PrayerWallBanner({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const candles = [
    [60, 1.0],
    [110, 0.8],
    [300, 0.85],
    [345, 1.05],
    [85, 0.6],
    [325, 0.62],
  ] as const;
  return (
    <svg aria-hidden viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice" className={`block h-full w-full ${className}`}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#050a1c" />
          <stop offset="0.65" stopColor="#14204a" />
          <stop offset="1" stopColor="#3a2a50" />
        </linearGradient>
        <radialGradient id={`${id}-halo`} cx="50%" cy="40%" r="45%">
          <stop offset="0" stopColor="#ffe7a3" stopOpacity="0.85" />
          <stop offset="0.35" stopColor="#f0b04a" stopOpacity="0.3" />
          <stop offset="1" stopColor="#f0b04a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffbe8" />
          <stop offset="0.5" stopColor="#f8d488" />
          <stop offset="1" stopColor="#c78a2c" />
        </linearGradient>
      </defs>
      <rect width="400" height="160" fill={`url(#${id}-sky)`} />
      <Stars seed={3} fill="#fff4d0" count={16} />
      <rect width="400" height="160" fill={`url(#${id}-halo)`} className="pw-glow" />
      <g className="pw-rays" style={{ transformOrigin: "200px 62px" }} opacity="0.35">
        {Array.from({ length: 16 }, (_, i) => (
          <path key={i} d="M200 62 196 -90h8z" fill="#ffe7a3" opacity={i % 2 ? 0.3 : 0.6} transform={`rotate(${i * 22.5} 200 62)`} />
        ))}
      </g>
      <g className="pw-float">
        <rect x="195" y="28" width="10" height="62" rx="2" fill={`url(#${id}-gold)`} />
        <rect x="178" y="44" width="44" height="9" rx="2" fill={`url(#${id}-gold)`} />
      </g>
      <path d="M0 160v-26c70-14 130-18 200-18s130 4 200 18v26z" fill="#03061a" />
      {candles.map(([x, s], i) => (
        <g key={i} transform={`translate(${x} ${138 - 30 * s}) scale(${s})`}>
          <circle cx="0" cy="-6" r="16" fill="#ffcf6a" opacity="0.18" />
          <rect x="-5" y="0" width="10" height="30" rx="2" fill="#f3e6d2" />
          <path d="M0-14c-5 7-6 11-3 14h6c3-3 2-7-3-14z" fill="#ffcf6a" className="pw-flame" style={{ transformOrigin: "0px 0px", animationDelay: `${i * 0.37}s` }} />
        </g>
      ))}
    </svg>
  );
}
