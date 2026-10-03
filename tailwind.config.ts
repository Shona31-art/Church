import type { Config } from "tailwindcss";

// Design tokens. Pages use these names, never raw hex values or Tailwind's
// stock red/green/amber — so a palette change happens here, once.
//
// Neutrals (ink, parchment, surface, line) carry most of every screen.
// ember (navy) is for primary actions; gold is a small accent only.
// success / warning / danger / info are reserved for state and always paired
// with an icon or words, never colour alone. Each foreground colour passes
// WCAG AA (4.5:1) on both white and its own tint.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14161F", // near-black navy — primary text
        parchment: "#FAFAF8", // page background
        surface: "#FFFFFF", // cards
        line: "#E6E4DE", // borders and dividers
        ember: "#1B2A4A", // deep navy — primary actions, links
        gold: "#A88A4A", // restrained brass — hairlines, small accents only
        success: { DEFAULT: "#17714F", tint: "#E7F4EE", line: "#B7DECB" },
        warning: { DEFAULT: "#8A4F06", tint: "#FBF1E1", line: "#EBCB95" },
        danger: { DEFAULT: "#B42318", tint: "#FDECEA", line: "#F2B8B2" },
        info: { DEFAULT: "#24508F", tint: "#EAF0FA", line: "#BCCDEA" },
      },
      fontFamily: {
        display: ["'Playfair Display'", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
