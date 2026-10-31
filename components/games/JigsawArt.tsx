import { useId } from "react";
import type { JigsawSceneKey } from "@/lib/games/jigsaw";

/**
 * Original Bible pictures for the jigsaw (300×300). Each has plenty of colour
 * and detail in every corner so the pieces can be told apart.
 */
export function JigsawArt({ scene, className = "" }: { scene: JigsawSceneKey; className?: string }) {
  const id = useId().replace(/:/g, "");
  const g = (name: string) => `url(#${id}-${name})`;
  return (
    <svg viewBox="0 0 300 300" className={`block h-full w-full ${className}`} aria-hidden preserveAspectRatio="xMidYMid slice">
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
          <circle cx="150" cy="60" r="28" fill="#fff3b0" opacity="0.9" />
          {/* parted walls of water */}
          <path d="M0 80 q 60 10 100 40 q 10 90 15 180 h-115 z" fill="#1f7a9c" />
          <path d="M300 80 q -60 10 -100 40 q -10 90 -15 180 h115 z" fill="#1f7a9c" />
          <path d="M0 110 q 55 10 92 40 q 8 70 12 150 h-104 z" fill="#2a95b8" />
          <path d="M300 110 q -55 10 -92 40 q -8 70 -12 150 h104 z" fill="#2a95b8" />
          {[130, 160, 190, 220, 250].map((y) => (
            <g key={y} stroke="#bdeef5" strokeWidth="2" fill="none" opacity="0.6">
              <path d={`M10 ${y} q 20 -6 40 0 t 40 0`} />
              <path d={`M210 ${y} q 20 -6 40 0 t 40 0`} />
            </g>
          ))}
          {/* dry path */}
          <path d="M100 300 L118 130 h64 L200 300 z" fill="#e6c98a" />
          <path d="M150 300 L150 135" stroke="#cfae6a" strokeWidth="2" strokeDasharray="6 8" />
          {/* Moses with staff */}
          <circle cx="150" cy="205" r="7" fill="#f2c48d" />
          <path d="M141 213 h18 l5 30 h-28 z" fill="#7b3f8c" />
          <line x1="166" y1="185" x2="162" y2="245" stroke="#6e4520" strokeWidth="3" />
          {/* people following */}
          {[[130, 255], [170, 258], [150, 270], [120, 280], [180, 282]].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y - 8} r="4" fill="#f2c48d" />
              <path d={`M${x - 5} ${y - 4} h10 l3 14 h-16 z`} fill={["#c0507a", "#e67e22", "#2e86c1", "#27ae60", "#8e44ad"][i]} />
            </g>
          ))}
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
