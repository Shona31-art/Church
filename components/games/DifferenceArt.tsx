import { useId } from "react";
import { PICTURE_HEIGHT, PICTURE_WIDTH, type Background, type PictureObject } from "@/lib/games/differences";

/**
 * One spot-the-difference picture (200 × 150), drawn from simple shapes so
 * the two copies match exactly except for the changes. `children` are drawn
 * on top (found-spot circles, wrong-tap marks).
 */
export function DifferenceArt({
  background,
  objects,
  children,
  className = "",
}: {
  background: Background;
  objects: readonly PictureObject[];
  children?: React.ReactNode;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox={`0 0 ${PICTURE_WIDTH} ${PICTURE_HEIGHT}`} className={`block h-auto w-full ${className}`} aria-hidden>
      <Backdrop background={background} id={id} />
      {objects.map((obj) => (
        <g key={obj.id} transform={`translate(${obj.x} ${obj.y}) scale(${obj.flip ? -obj.s : obj.s} ${obj.s})`}>
          <Prop obj={obj} />
        </g>
      ))}
      {children}
    </svg>
  );
}

function Backdrop({ background, id }: { background: Background; id: string }) {
  const sky = { sea: ["#5dade2", "#d6eaf8"], hills: ["#6ec3f4", "#e3f4ff"], night: ["#0b1033", "#2a3478"], garden: ["#7fd1f5", "#f2fbff"], storm: ["#2c3e50", "#5d6d7e"] }[background];
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[0]} />
          <stop offset="1" stopColor={sky[1]} />
        </linearGradient>
      </defs>
      <rect width={PICTURE_WIDTH} height={PICTURE_HEIGHT} fill={`url(#${id}-sky)`} />
      {(background === "sea" || background === "storm") && (
        <>
          <rect y="98" width={PICTURE_WIDTH} height="52" fill={background === "storm" ? "#1b4f72" : "#2e86c1"} />
          {[104, 116, 128, 140].map((y, i) => (
            <path key={y} d={`M${i % 2 ? -10 : 0} ${y} q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0`} fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2" />
          ))}
        </>
      )}
      {background === "hills" && (
        <>
          <path d="M0 92 Q50 70 100 88 T200 82 V150 H0Z" fill="#7cb342" />
          <path d="M0 110 Q60 94 120 108 T200 104 V150 H0Z" fill="#8bc34a" />
        </>
      )}
      {background === "garden" && (
        <>
          <path d="M0 96 Q60 84 120 94 T200 92 V150 H0Z" fill="#8bc34a" />
          <ellipse cx="50" cy="132" rx="34" ry="12" fill="#4fa3d9" />
        </>
      )}
      {background === "night" && <path d="M0 104 Q100 92 200 104 V150 H0Z" fill="#5d4e37" />}
    </>
  );
}

function Prop({ obj }: { obj: PictureObject }) {
  const c = obj.color;
  switch (obj.kind) {
    case "sun":
      return (
        <>
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i} x1="0" y1="-7.5" x2="0" y2="-10" stroke={c} strokeWidth="1.4" strokeLinecap="round" transform={`rotate(${i * 45})`} />
          ))}
          <circle r="6" fill={c} />
        </>
      );
    case "moon":
      return <path d="M2 -6.5 A6.5 6.5 0 1 0 2 6.5 A5 5 0 1 1 2 -6.5Z" fill={c} />;
    case "star":
      return <polygon points="0,-6 1.6,-2 6,-1.9 2.5,1 3.7,5.5 0,3 -3.7,5.5 -2.5,1 -6,-1.9 -1.6,-2" fill={c} />;
    case "cloud":
      return (
        <g fill={c}>
          <ellipse cx="-5" cy="1" rx="7" ry="4.5" />
          <ellipse cx="4" cy="-1" rx="7.5" ry="5.5" />
          <ellipse cx="9" cy="2" rx="4.5" ry="3.5" />
        </g>
      );
    case "tree":
      return (
        <>
          <rect x="-1.5" y="2" width="3" height="10" fill="#6d4c41" />
          <circle cy="-3" r="8" fill={c} />
          <circle cx="-4" cy="1" r="4.5" fill={c} />
          <circle cx="4.5" cy="0" r="4.5" fill={c} />
        </>
      );
    case "palm":
      return (
        <>
          <path d="M0 13 Q-1 2 3 -6" stroke="#8d6e63" strokeWidth="2.2" fill="none" />
          <g fill={c}>
            <path d="M3 -6 Q-6 -10 -11 -4 Q-4 -7 3 -6Z" />
            <path d="M3 -6 Q10 -12 14 -5 Q8 -8 3 -6Z" />
            <path d="M3 -6 Q-2 -14 -7 -12 Q-1 -11 3 -6Z" />
            <path d="M3 -6 Q8 -1 9 4 Q5 -2 3 -6Z" />
          </g>
        </>
      );
    case "sheep":
      return (
        <>
          <line x1="-4" y1="3" x2="-4" y2="8" stroke="#333" strokeWidth="1.3" />
          <line x1="3" y1="3" x2="3" y2="8" stroke="#333" strokeWidth="1.3" />
          <ellipse rx="7" ry="5" fill={c} stroke="#bdbdbd" strokeWidth="0.5" />
          <ellipse cx="7" cy="-2" rx="2.6" ry="2.2" fill="#333" />
        </>
      );
    case "dove":
      return (
        <>
          <ellipse rx="6" ry="3" fill={c} stroke="#b0bec5" strokeWidth="0.4" />
          <path d="M-1 -1 Q-3 -8 3 -6 Q2 -3 -1 -1Z" fill={c} stroke="#b0bec5" strokeWidth="0.4" />
          <path d="M-6 0 L-9 -2 L-9 2Z" fill={c} />
          <circle cx="5.5" cy="-1" r="2" fill={c} />
          <path d="M7.4 -1 L9.5 -0.5 L7.4 0Z" fill="#f39c12" />
          <path d="M8 1 q2 1 3 0" stroke="#6b8e23" strokeWidth="0.8" fill="none" />
        </>
      );
    case "bird":
      return <path d="M-5 0 Q-2.5 -3 0 0 Q2.5 -3 5 0" stroke={c} strokeWidth="1.2" fill="none" strokeLinecap="round" />;
    case "fish":
      return (
        <>
          <path d="M-5 0 L-9 -4 L-9 4Z" fill={c} />
          <ellipse rx="6" ry="3.6" fill={c} />
          <circle cx="3" cy="-0.8" r="0.9" fill="#1b1b1b" />
        </>
      );
    case "boat":
      return (
        <>
          <line x1="0" y1="-12" x2="0" y2="1" stroke="#5d4037" strokeWidth="1" />
          <path d="M0.5 -11 L8 -1 L0.5 -1Z" fill={c} stroke="#bdbdbd" strokeWidth="0.3" />
          <path d="M-12 0 H12 L8 6 H-9Z" fill="#8b5a2b" />
        </>
      );
    case "ark":
      return (
        <>
          <rect x="-7" y="-9" width="14" height="6" fill="#a1887f" />
          <path d="M-8 -9 L0 -13 L8 -9Z" fill="#6d4c41" />
          <rect x="-1.5" y="-7.5" width="3" height="3" fill="#3e2723" />
          <path d="M-14 -3 H14 L10 5 H-10Z" fill={c} />
          <line x1="-12" y1="0" x2="12" y2="0" stroke="#5d4037" strokeWidth="0.5" />
        </>
      );
    case "house":
      return (
        <>
          <rect x="-8" y="-6" width="16" height="13" fill={c} />
          <rect x="-9" y="-7.5" width="18" height="2" fill="#8d6e63" />
          <rect x="-2" y="0" width="4" height="7" fill="#4e342e" />
          <rect x="3.5" y="-3" width="3" height="3" fill="#ffe082" />
        </>
      );
    case "person":
      return (
        <>
          <path d="M-5 9 L-3 -2 H3 L5 9Z" fill={c} stroke="#00000022" strokeWidth="0.4" />
          <circle cy="-5" r="3.2" fill="#c68b59" />
          <path d="M-3.4 -5.5 Q0 -10 3.4 -5.5 Q0 -7 -3.4 -5.5Z" fill="#3e2723" />
        </>
      );
    case "flower":
      return (
        <>
          <line x1="0" y1="0" x2="0" y2="6" stroke="#2e7d32" strokeWidth="1" />
          {Array.from({ length: 5 }, (_, i) => (
            <circle key={i} cx="0" cy="-2.6" r="1.9" fill={c} transform={`rotate(${i * 72})`} />
          ))}
          <circle r="1.4" fill="#fbc02d" />
        </>
      );
    case "rainbow":
      return (
        <g fill="none" strokeWidth="2">
          {["#e74c3c", "#f39c12", "#f7dc6f", "#58d68d", "#5dade2", "#8e44ad"].map((col, i) => (
            <path key={col} d={`M${-28 + i * 2} 0 A${28 - i * 2} ${22 - i * 2} 0 0 1 ${28 - i * 2} 0`} stroke={col} />
          ))}
        </g>
      );
    case "basket":
      return (
        <>
          <path d="M-7 -2 H7 L5 5 H-5Z" fill={c} />
          <line x1="-6" y1="1" x2="6" y2="1" stroke="#5d4037" strokeWidth="0.6" />
          <path d="M-5 -2 Q0 -8 5 -2" stroke={c} strokeWidth="1" fill="none" />
        </>
      );
    case "bread":
      return (
        <>
          <ellipse rx="6" ry="3.6" fill={c} />
          <path d="M-3 -2 l1.5 2 M0 -2.5 l1.5 2 M3 -2 l1.5 2" stroke="#8d5a2b" strokeWidth="0.6" />
        </>
      );
    case "jar":
      return <path d="M-2.5 -6 H2.5 V-4 Q6 -2 5 3 Q4 6 0 6 Q-4 6 -5 3 Q-6 -2 -2.5 -4Z" fill={c} />;
    case "lamp":
      return (
        <>
          <path d="M-6 0 Q0 5 5 0 L7 -1 L5 -2 Q0 -3 -6 0Z" fill={c} />
          <path d="M7 -1 Q6 -6 8.5 -8 Q9.5 -4 7 -1Z" fill="#ffb300" />
        </>
      );
    case "rock":
      return <polygon points="-9,6 -6,-3 -1,-7 5,-4 9,6" fill={c} />;
    case "bolt":
      return <polygon points="1,-8 -4,1 0,1 -2,8 5,-2 1,-2 3,-8" fill={c} />;
  }
}
