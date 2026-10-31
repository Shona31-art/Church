import { useId } from "react";

/**
 * The Grace mark: a slender teal cross inside a fine halo, with a rose jewel
 * and a soft glow where the beams meet. Decorative; size it with className.
 * The same drawing is in scripts/build-brand.mjs (logo and icon files) and,
 * simplified, in components/entry/LightField.tsx (the animated background).
 */
export function Cross({ className = "", halo = true }: { className?: string; halo?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg aria-hidden viewBox="0 0 100 100" fill="none" className={className}>
      <defs>
        <linearGradient id={`${id}-v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fe3e7" />
          <stop offset="0.45" stopColor="#3fb6c2" />
          <stop offset="1" stopColor="#136f80" />
        </linearGradient>
        <linearGradient id={`${id}-h`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3fb6c2" />
          <stop offset="0.5" stopColor="#9fe3e7" />
          <stop offset="1" stopColor="#3fb6c2" />
        </linearGradient>
        <radialGradient id={`${id}-g`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#f7a8c8" stopOpacity="0.95" />
          <stop offset="0.4" stopColor="#e8679b" stopOpacity="0.45" />
          <stop offset="1" stopColor="#e8679b" stopOpacity="0" />
        </radialGradient>
      </defs>
      {halo && <circle cx="50" cy="50" r="45" stroke="#3fb6c2" strokeWidth="0.9" opacity="0.5" />}
      <circle cx="50" cy="36" r="17" fill={`url(#${id}-g)`} />
      <rect x="45.5" y="9" width="9" height="82" rx="4.5" fill={`url(#${id}-v)`} />
      <rect x="25" y="31.5" width="50" height="9" rx="4.5" fill={`url(#${id}-h)`} />
      <path d="M50 30.2 L55.8 36 L50 41.8 L44.2 36Z" fill="#f39ac0" />
      <path d="M50 32.6 L53.4 36 L50 39.4 L46.6 36Z" fill="#fde2ee" />
    </svg>
  );
}
