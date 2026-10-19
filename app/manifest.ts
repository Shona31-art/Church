import type { MetadataRoute } from "next";

// Web app manifest: lets members "Add to Home Screen" so the app opens like an
// app (full screen, own icon) — which also stops iPhones clearing offline Bible
// downloads after a few weeks unused.
//
// BRAND PLACEHOLDER: no icons yet — waiting for the real logo (no stand-in
// icon on purpose). Until they exist, phones show a screenshot or letter, and
// Chrome on Android won't offer its install prompt (it requires a 192×192 and
// a 512×512 icon); the Install section then shows the browser-menu steps.
// To finish: add icons/icon-192.png, icon-512.png and icon-maskable-512.png
// to public/, list them in `icons`, and add apple-touch-icon in app/layout.tsx.
// Steps: docs/plans/installable-app.md.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Grace-bound",
    short_name: "Grace-bound",
    description: "A church operating system for people, not just Sundays.",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F8F7F4", // --parchment (light)
    theme_color: "#F8F7F4", // matches the light status bar (app/layout.tsx viewport)
    lang: "en-ZA",
    categories: ["lifestyle", "social", "education"],
    prefer_related_applications: false,
  };
}
