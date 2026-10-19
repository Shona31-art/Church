import type { Config } from "tailwindcss";

// Design tokens. Pages use these names, never raw hex values or Tailwind's
// stock red/green/amber — so a palette change happens here, once.
//
// Each colour is an RGB triple defined as a CSS variable in app/globals.css,
// with a light and a dark value. That is what makes dark mode work without
// touching pages: `text-ink/60` or `bg-ember` resolve to whichever theme is
// active, and opacity modifiers keep working.
//
// Neutrals (ink, parchment, surface, line) carry most of every screen.
// ember is for primary actions (deep navy in light, champagne in dark), with
// on-ember as the text that sits on it; gold is a small accent only.
// success / warning / danger / info are reserved for state and always paired
// with an icon or words, never colour alone. Each foreground colour passes
// WCAG AA (4.5:1) on surface and on its own tint, in both themes.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: token("ink"), // primary text
        parchment: token("parchment"), // page background
        surface: token("surface"), // cards, inputs, popups
        "surface-raised": token("surface-raised"), // hover / selected rows, sidebar active item
        line: token("line"), // borders and dividers
        "line-strong": token("line-strong"), // input borders
        ember: token("ember"), // primary actions, links
        "on-ember": token("on-ember"), // text/icons on an ember background
        gold: { DEFAULT: token("gold"), deep: token("gold-deep") }, // restrained brass — hairlines, icons, small accents; `gold-deep` for text
        panel: token("panel"), // deep navy brand panel (auth screens, landing band) in both themes
        "on-panel": token("on-panel"), // text on the brand panel
        success: { DEFAULT: token("success"), tint: token("success-tint"), line: token("success-line") },
        warning: { DEFAULT: token("warning"), tint: token("warning-tint"), line: token("warning-line") },
        danger: { DEFAULT: token("danger"), tint: token("danger-tint"), line: token("danger-line") },
        info: { DEFAULT: token("info"), tint: token("info-tint"), line: token("info-line") },
        // Bible verse highlights only (components/bible/) — a member's own colour choice, not state.
        hl: { yellow: token("hl-yellow"), green: token("hl-green"), blue: token("hl-blue"), pink: token("hl-pink"), purple: token("hl-purple") },
      },
      // Type scale. Use these instead of text-[NNpx]. Exceptions on purpose:
      // the Bible reader's reading sizes (components/bible/ChapterText.tsx),
      // crossword grid numbers and kids-mode game text, which scale content.
      fontSize: {
        micro: ["10px", { lineHeight: "14px" }], // counter badges, date-tile months
        eyebrow: ["11px", { lineHeight: "16px" }], // uppercase labels (.eyebrow), timestamps
        lede: ["15px", { lineHeight: "1.55" }], // page descriptions, intro lines
        "title-sm": ["22px", { lineHeight: "1.35" }],
        title: ["28px", { lineHeight: "1.2" }], // page titles on phones
        "title-lg": ["32px", { lineHeight: "1.2" }], // page titles from sm up
        display: ["40px", { lineHeight: "1.1" }], // landing hero on phones
        "display-lg": ["56px", { lineHeight: "1.08" }], // landing hero on desktop
      },
      fontFamily: {
        // Loaded with next/font in app/layout.tsx (self-hosted, no layout shift).
        sans: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        // Layered, low-opacity shadows read as depth rather than "drop shadow".
        xs: "0 1px 2px rgb(var(--shadow) / 0.05)",
        card: "0 1px 2px rgb(var(--shadow) / 0.04), 0 4px 16px -4px rgb(var(--shadow) / 0.06)",
        "card-hover": "0 2px 4px rgb(var(--shadow) / 0.05), 0 12px 32px -8px rgb(var(--shadow) / 0.12)",
        pop: "0 8px 24px -6px rgb(var(--shadow) / 0.18), 0 24px 64px -12px rgb(var(--shadow) / 0.22)",
      },
      // Form popups (components/ui/RouteModal.tsx): a short fade-and-rise.
      keyframes: {
        "modal-in": { from: { opacity: "0", transform: "translateY(8px) scale(0.99)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "modal-in": "modal-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "fade-in": "fade-in 200ms ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
