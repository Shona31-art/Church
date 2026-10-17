import type { MetadataRoute } from "next";

// Web app manifest: lets members "Add to Home Screen" so the app opens like an
// app (full screen, own icon) — which also stops iPhones clearing offline Bible
// downloads after a few weeks unused.
//
// BRAND PLACEHOLDER: no icons yet. Phones fall back to a screenshot or letter
// icon. Add 192×192 and 512×512 PNGs of the real logo to public/ and list them
// in `icons` before launch (see README "Known gaps").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Grace-bound",
    short_name: "Grace-bound",
    description: "A church operating system for people, not just Sundays.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F8F7F4", // --parchment (light)
    theme_color: "#1B2A4A", // --ember (light)
  };
}
