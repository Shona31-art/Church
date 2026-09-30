import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14161F",        // near-black navy — crisp, professional, not warm
        parchment: "#FAFAF8",  // barely-warm white background
        surface: "#FFFFFF",    // pure white cards, separated by subtle shadow not fill
        ember: "#1B2A4A",      // deep navy — primary accent
        gold: "#A88A4A",       // restrained brass — hairlines, small premium accents only
      },
    },
  },
  plugins: [],
};
export default config;
