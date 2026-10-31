import { useId } from "react";
import type { JigsawSceneKey } from "@/lib/games/jigsaw";

/**
 * Original Bible pictures for the jigsaw (300×300). Each has plenty of colour
 * and detail in every corner so the pieces can be told apart.
 */
export function JigsawArt({
  scene,
  className = "",
  frame,
}: {
  scene: JigsawSceneKey;
  className?: string;
  /** Position inside a parent SVG (used to cut jigsaw pieces). */
  frame?: { x: number; y: number; width: number; height: number };
}) {
  const id = useId().replace(/:/g, "");
  const g = (name: string) => `url(#${id}-${name})`;
  return (
    <svg viewBox="0 0 300 300" className={frame ? undefined : `block h-full w-full ${className}`} aria-hidden preserveAspectRatio="xMidYMid slice" {...frame}>
      <defs>
        <linearGradient id={`${id}-dusk`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1d5c" />
          <stop offset="0.55" stopColor="#c0507a" />
          <stop offset="1" stopColor="#f6b26b" />
        </linearGradient>
        <linearGradient id={`${id}-day`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a8fd9" />
          <stop offset="1" stopColor="#bfe6ff" />
        </linearGradient>
        <linearGradient id={`${id}-night`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#060b26" />
          <stop offset="0.7" stopColor="#1d2a6b" />
          <stop offset="1" stopColor="#3a3f8f" />
        </linearGradient>
        <linearGradient id={`${id}-dawn`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffcf8a" />
          <stop offset="0.6" stopColor="#ff9a6b" />
          <stop offset="1" stopColor="#d9637a" />
        </linearGradient>
        <linearGradient id={`${id}-sea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f7a9c" />
          <stop offset="1" stopColor="#0b3550" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6cf" />
          <stop offset="0.5" stopColor="#f6cd6a" />
          <stop offset="1" stopColor="#c78a2c" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff7d6" stopOpacity="1" />
          <stop offset="1" stopColor="#ffe08a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {scene === "ark" && (
        <>
          <rect width="300" height="300" fill={g("day")} />
          {/* rainbow */}
          {["#e74c3c", "#f39c12", "#f7dc6f", "#58d68d", "#5dade2", "#8e44ad"].map((c, i) => (
            <path key={c} d={`M ${-10 + i * 9} 210 A ${160 - i * 9} ${160 - i * 9} 0 0 1 ${310 - i * 9} 210`} stroke={c} strokeWidth="9" fill="none" opacity="0.85" />
          ))}
          <circle cx="250" cy="45" r="22" fill="#fff3b0" />
          <ellipse cx="70" cy="60" rx="38" ry="14" fill="#fff" opacity="0.9" />
          <ellipse cx="200" cy="90" rx="30" ry="11" fill="#fff" opacity="0.8" />
          {/* water */}
          <rect y="215" width="300" height="85" fill={g("sea")} />
          {[230, 250, 270, 290].map((y, i) => (
            <path key={y} d={`M0 ${y} q 18 -8 36 0 t 36 0 t 36 0 t 36 0 t 36 0 t 36 0 t 36 0 t 36 0 t 36 0`} stroke="#9fe3e7" strokeWidth="2" fill="none" opacity={0.6 - i * 0.1} />
          ))}
          {/* ark */}
          <path d="M60 210 h180 l-25 38 h-130 z" fill="#8b5a2b" stroke="#5e3a17" strokeWidth="3" />
          <rect x="95" y="172" width="110" height="40" fill="#a86f3a" stroke="#5e3a17" strokeWidth="3" />
          <path d="M88 175 L150 145 L212 175 z" fill="#6e4520" stroke="#5e3a17" strokeWidth="3" />
          {[110, 140, 170].map((x) => (
            <rect key={x} x={x} y="183" width="16" height="14" rx="2" fill="#fbe3a6" />
          ))}
          <line x1="70" y1="225" x2="230" y2="225" stroke="#5e3a17" strokeWidth="2" />
          {/* dove */}
          <path d="M150 95 q 14 -14 30 -4 q -10 2 -14 10 q 14 2 20 12 q -18 -2 -28 -6 q -8 6 -18 2 z" fill="#fff" />
          <path d="M184 106 l10 4" stroke="#5f8f3a" strokeWidth="2" />
        </>
      )}
      {scene === "jonah" && (
        <>
          <rect width="300" height="300" fill={g("sea")} />
          <rect width="300" height="70" fill={g("day")} />
          <circle cx="60" cy="35" r="18" fill="#fff3b0" />
          <path d="M0 70 q 25 -10 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0" fill="#2a8fb3" />
          {/* boat */}
          <path d="M190 62 h70 l-10 14 h-50 z" fill="#8b5a2b" />
          <line x1="225" y1="62" x2="225" y2="25" stroke="#5e3a17" strokeWidth="3" />
          <path d="M227 27 L255 55 H227 z" fill="#f5efe0" />
          {/* bubbles + light rays */}
          {[[40, 120, 5], [60, 150, 3], [250, 140, 6], [270, 200, 4], [30, 250, 4]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="none" stroke="#bdeef5" strokeWidth="1.5" opacity="0.8" />
          ))}
          {[30, 110, 190].map((x) => (
            <path key={x} d={`M${x} 70 L${x + 40} 70 L${x + 10} 300 L${x - 20} 300 z`} fill="#bdeef5" opacity="0.07" />
          ))}
          {/* the great fish */}
          <path d="M40 190 q 60 -70 170 -30 q 20 8 30 25 q -10 20 -32 26 q -110 40 -168 -21 z" fill="#4b6fa8" stroke="#2c4a7a" strokeWidth="3" />
          <path d="M238 182 l40 -30 l-6 38 l6 38 z" fill="#4b6fa8" stroke="#2c4a7a" strokeWidth="3" />
          <path d="M70 200 q 70 22 150 -8" stroke="#a9c6ef" strokeWidth="6" fill="none" opacity="0.7" />
          <circle cx="80" cy="178" r="7" fill="#fff" />
          <circle cx="82" cy="178" r="3.5" fill="#152542" />
          <path d="M45 196 q 14 8 30 4" stroke="#2c4a7a" strokeWidth="3" fill="none" />
          {/* Jonah inside (glow) */}
          <circle cx="150" cy="185" r="20" fill={g("glow")} />
          <circle cx="150" cy="178" r="6" fill="#f2c48d" />
          <path d="M143 186 h14 l3 14 h-20 z" fill="#c0507a" />
          {/* seaweed + sand */}
          <path d="M0 280 q 75 -16 150 0 t 150 0 v 20 h-300 z" fill="#e6c98a" />
          {[20, 120, 260].map((x) => (
            <path key={x} d={`M${x} 290 q -10 -20 0 -40 q 10 -20 0 -40`} stroke="#2e8b57" strokeWidth="5" fill="none" />
          ))}
          {[[200, 250, "#f39c12"], [90, 255, "#e74c3c"]].map(([x, y, c], i) => (
            <path key={i} d={`M${x} ${y} q 10 -8 20 0 q -10 8 -20 0 l -6 -5 v 10 z`} fill={c as string} />
          ))}
        </>
      )}
      {scene === "star" && (
        <>
          <rect width="300" height="300" fill={g("night")} />
          {Array.from({ length: 40 }, (_, i) => (
            <circle key={i} cx={(i * 73) % 300} cy={(i * 41) % 170} r={(i % 3) * 0.6 + 0.7} fill="#fff8de" opacity={0.5 + (i % 4) * 0.12} />
          ))}
          <circle cx="210" cy="70" r="55" fill={g("glow")} opacity="0.7" />
          <path d="M210 30 L218 62 L250 70 L218 78 L210 110 L202 78 L170 70 L202 62 z" fill={g("gold")} />
          <path d="M210 110 L190 300 H230 z" fill="#ffe7a3" opacity="0.15" />
          {/* hills + town */}
          <path d="M0 230 q 80 -40 160 -10 t 140 -10 v 90 h-300 z" fill="#1a1840" />
          <path d="M0 255 q 90 -25 180 0 t 120 -5 v 50 h-300 z" fill="#2b2556" />
          {[[30, 205, 40, 30], [75, 195, 30, 40], [110, 210, 34, 25]].map(([x, y, w, h], i) => (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="#c9a26b" />
              <rect x={x + w / 2 - 4} y={y + h - 12} width="8" height="12" fill="#3a2a1a" />
              <rect x={x + 4} y={y + 6} width="7" height="7" fill="#ffd27a" />
            </g>
          ))}
          {/* stable */}
          <path d="M170 255 L210 215 L250 255 z" fill="#6e4520" />
          <rect x="178" y="250" width="64" height="35" fill="#8b5a2b" />
          <rect x="198" y="258" width="24" height="27" fill="#ffd27a" />
          <circle cx="210" cy="272" r="7" fill="#fff4cf" />
          {/* camels */}
          {[20, 60].map((x) => (
            <path key={x} d={`M${x} 280 q 5 -18 15 -10 q 6 -12 14 0 h8 l4 -8 l5 2 l-6 10 v16 h-4 v-10 h-22 v10 h-4 z`} fill="#0e0c26" />
          ))}
        </>
      )}
      {scene === "tomb" && (
        <>
          <rect width="300" height="300" fill={g("dawn")} />
          <circle cx="150" cy="150" r="70" fill="#fff3c4" opacity="0.9" />
          <circle cx="150" cy="150" r="110" fill={g("glow")} opacity="0.6" />
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M150 150 L145 0 H155 z" fill="#fff6d0" opacity="0.25" transform={`rotate(${i * 30} 150 150)`} />
          ))}
          {/* garden hill with tomb */}
          <path d="M0 200 q 150 -60 300 0 v 100 h-300 z" fill="#5b7a3a" />
          <path d="M60 200 q 70 -80 160 -5 v 50 h-160 z" fill="#8c7b6b" />
          <ellipse cx="135" cy="215" rx="30" ry="34" fill="#1d1612" />
          <circle cx="185" cy="230" r="30" fill="#a39382" stroke="#6b5d50" strokeWidth="3" />
          <path d="M120 245 q 15 -10 30 0" stroke="#fff3c4" strokeWidth="3" fill="none" opacity="0.6" />
          {/* lilies + path */}
          <path d="M140 300 q -10 -30 -5 -55" stroke="#c9b48c" strokeWidth="14" fill="none" />
          {[[30, 270], [60, 285], [250, 268], [275, 285]].map(([x, y], i) => (
            <g key={i}>
              <line x1={x} y1={y} x2={x} y2={y + 25} stroke="#3e6b2a" strokeWidth="3" />
              <path d={`M${x} ${y} l -8 -10 l 8 3 l 8 -3 z`} fill="#fff" />
            </g>
          ))}
          {/* crosses on the far hill */}
          {[40, 60, 80].map((x, i) => (
            <g key={x} fill="#4a2e3a" opacity="0.7">
              <rect x={x} y={150 - (i === 1 ? 8 : 0)} width="3" height="24" />
              <rect x={x - 6} y={156 - (i === 1 ? 8 : 0)} width="15" height="3" />
            </g>
          ))}
        </>
      )}
      {scene === "sea" && (
        <>
          <rect width="300" height="300" fill={g("dusk")} />
          <circle cx="150" cy="42" r="20" fill="#fff3b0" opacity="0.9" />
          {/* pillar of cloud leading the way */}
          <path d="M150 58 q -16 8 -8 22 q -14 10 -4 24 q -10 14 4 24 h16 q 14 -10 4 -24 q 10 -14 -4 -24 q 8 -14 -8 -22 z" fill="#fff8ec" opacity="0.75" />
          {/* parted walls of water, taller and foaming */}
          <path d="M0 60 q 70 6 108 52 q 8 90 10 188 h-118 z" fill="#17607d" />
          <path d="M300 60 q -70 6 -108 52 q -8 90 -10 188 h118 z" fill="#17607d" />
          <path d="M0 86 q 62 8 98 46 q 6 80 8 168 h-106 z" fill="#2a95b8" />
          <path d="M300 86 q -62 8 -98 46 q -6 80 -8 168 h106 z" fill="#2a95b8" />
          <path d="M0 60 q 70 6 108 52" stroke="#e8fbff" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M300 60 q -70 6 -108 52" stroke="#e8fbff" strokeWidth="5" fill="none" strokeLinecap="round" />
          {[[12, 70], [40, 66], [70, 76], [228, 76], [258, 66], [286, 70]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4" fill="#e8fbff" />
          ))}
          {[120, 150, 180, 210, 240, 270].map((y) => (
            <g key={y} stroke="#bdeef5" strokeWidth="2" fill="none" opacity="0.55">
              <path d={`M8 ${y} q 18 -6 36 0 t 36 0`} />
              <path d={`M220 ${y} q 18 -6 36 0 t 36 0`} />
            </g>
          ))}
          {/* fish in the walls */}
          {[[40, 140, "#f39c12", 1], [70, 230, "#e74c3c", 1], [250, 160, "#f7dc6f", -1], [228, 250, "#5dade2", -1]].map(([x, y, c, d], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${d} 1)`}>
              <ellipse cx="0" cy="0" rx="10" ry="5" fill={c as string} />
              <path d="M8 0 l8 -6 v12 z" fill={c as string} />
              <circle cx="-5" cy="-1" r="1.3" fill="#1d1d1d" />
            </g>
          ))}
          {/* the dry path through the sea */}
          <path d="M104 300 L120 112 h60 L196 300 z" fill="#e6c98a" />
          <path d="M112 300 L124 112 h52 L188 300 z" fill="#efd8a0" />
          {[[130, 150], [168, 175], [140, 210], [160, 260]].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx="4" ry="2" fill="#cfae6a" />
          ))}
          {/* the people following (smaller, further back) */}
          {(
            [
              [138, 150, 0.55, "#c0507a", "#7a3a1a", "scarf"],
              [160, 152, 0.55, "#2e86c1", "#3a2a1a", "hair"],
              [128, 172, 0.65, "#27ae60", "#3a2a1a", "hair"],
              [150, 170, 0.65, "#e67e22", "#5a3a2a", "scarf"],
              [172, 174, 0.65, "#8e44ad", "#3a2a1a", "bundle"],
            ] as const
          ).map(([x, y, sc, robe, hair, kind], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${sc})`}>
              <path d="M-9 8 L-12 34 H12 L9 8 Q0 3 -9 8 z" fill={robe} />
              <path d="M-9 10 l-6 14 M9 10 l6 14" stroke={robe} strokeWidth="5" strokeLinecap="round" />
              <circle cx="0" cy="0" r="7" fill="#e9b98a" />
              {kind === "scarf" ? (
                <path d="M-8 2 q 8 -14 16 0 v8 h-3 v-6 q-5 -6 -10 0 v6 h-3 z" fill={hair} />
              ) : (
                <path d="M-7 -2 q 7 -9 14 0 q -7 -4 -14 0 z" fill={hair} />
              )}
              {kind === "bundle" && <rect x="6" y="2" width="12" height="10" rx="3" fill="#a0784a" />}
              <rect x="-6" y="34" width="4" height="4" fill="#5e3a17" />
              <rect x="2" y="34" width="4" height="4" fill="#5e3a17" />
            </g>
          ))}
          {/* a family: mother and child */}
          <g transform="translate(176 222) scale(0.85)">
            <path d="M-9 8 L-13 36 H13 L9 8 Q0 3 -9 8 z" fill="#d35400" />
            <circle cx="0" cy="0" r="7" fill="#c98f62" />
            <path d="M-8 2 q 8 -14 16 0 v10 h-3 v-8 q-5 -6 -10 0 v8 h-3 z" fill="#f5efe0" />
            <path d="M-9 14 l-12 8" stroke="#d35400" strokeWidth="5" strokeLinecap="round" />
          </g>
          <g transform="translate(158 236) scale(0.55)">
            <path d="M-8 8 L-10 30 H10 L8 8 Q0 3 -8 8 z" fill="#f7dc6f" />
            <circle cx="0" cy="0" r="7" fill="#c98f62" />
            <path d="M-7 -2 q 7 -9 14 0 q -7 -4 -14 0 z" fill="#2a1a10" />
          </g>
          {/* Moses at the front, staff raised over the sea */}
          <g transform="translate(130 228)">
            {/* robe and sash */}
            <path d="M-13 12 L-19 66 H19 L13 12 Q0 4 -13 12 z" fill="#7b3f8c" />
            <path d="M-13 12 L-8 66 H-2 L-6 12 z" fill="#5e2d6d" />
            <path d="M-15 32 H15" stroke="#e6c35a" strokeWidth="4" />
            {/* raised arm holding the staff */}
            <path d="M10 16 L26 -6" stroke="#7b3f8c" strokeWidth="8" strokeLinecap="round" />
            <circle cx="27" cy="-8" r="4" fill="#e9b98a" />
            <line x1="22" y1="-46" x2="32" y2="64" stroke="#6e4520" strokeWidth="4" strokeLinecap="round" />
            <path d="M22 -46 q -6 -6 2 -10" stroke="#6e4520" strokeWidth="4" fill="none" strokeLinecap="round" />
            {/* other arm */}
            <path d="M-11 16 L-20 40" stroke="#7b3f8c" strokeWidth="8" strokeLinecap="round" />
            {/* head: headcloth, face, long white beard */}
            <circle cx="0" cy="0" r="10" fill="#e9b98a" />
            <path d="M-12 2 q 12 -22 24 0 v12 h-4 v-10 q-8 -9 -16 0 v10 h-4 z" fill="#f5efe0" />
            <path d="M-12 -2 h24" stroke="#c9a26b" strokeWidth="2.5" />
            <path d="M-7 4 q 7 24 14 0 q -7 6 -14 0 z" fill="#f8f8f8" />
            <circle cx="-3.5" cy="0" r="1.2" fill="#2a1a10" />
            <circle cx="3.5" cy="0" r="1.2" fill="#2a1a10" />
            {/* feet */}
            <rect x="-11" y="65" width="7" height="5" rx="1.5" fill="#5e3a17" />
            <rect x="4" y="65" width="7" height="5" rx="1.5" fill="#5e3a17" />
          </g>
        </>
      )}
      {scene === "cross" && (
        <>
          <rect width="300" height="300" fill={g("dusk")} />
          {Array.from({ length: 16 }, (_, i) => (
            <path key={i} d="M150 110 L146 -40 H154 z" fill="#ffe7a3" opacity={i % 2 ? 0.15 : 0.3} transform={`rotate(${i * 22.5} 150 110)`} />
          ))}
          <circle cx="150" cy="110" r="80" fill={g("glow")} opacity="0.8" />
          <ellipse cx="60" cy="50" rx="34" ry="10" fill="#fbd3e0" opacity="0.6" />
          <ellipse cx="245" cy="70" rx="40" ry="12" fill="#fbd3e0" opacity="0.5" />
          {/* hill */}
          <path d="M0 230 q 150 -80 300 0 v 70 h-300 z" fill="#3d2a4a" />
          <path d="M0 260 q 150 -40 300 0 v 40 h-300 z" fill="#2a1d36" />
          {/* cross */}
          <rect x="142" y="60" width="16" height="125" rx="2" fill={g("gold")} stroke="#8a5a1c" strokeWidth="2" />
          <rect x="112" y="88" width="76" height="14" rx="2" fill={g("gold")} stroke="#8a5a1c" strokeWidth="2" />
          {/* flowers */}
          {[[40, 270, "#f7dc6f"], [80, 280, "#f1948a"], [220, 275, "#f7dc6f"], [260, 285, "#bb8fce"], [120, 288, "#f1948a"], [180, 290, "#f7dc6f"]].map(([x, y, c], i) => (
            <g key={i}>
              <line x1={x as number} y1={y as number} x2={x as number} y2={(y as number) + 14} stroke="#4f7a3a" strokeWidth="2" />
              <circle cx={x as number} cy={y as number} r="5" fill={c as string} />
            </g>
          ))}
          {/* birds */}
          {[[60, 120], [85, 105], [235, 130]].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y} q 6 -6 12 0 q 6 -6 12 0`} stroke="#2a1d36" strokeWidth="2" fill="none" />
          ))}
        </>
      )}
    </svg>
  );
}
