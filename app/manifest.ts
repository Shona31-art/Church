import type { MetadataRoute } from "next";

// Web app manifest: lets members "Add to Home Screen" so the app opens like an
// app (full screen, own icon) — which also stops iPhones clearing offline Bible
// downloads after a few weeks unused.
//
// Icons are generated from the Grace cross (components/brand/Cross.tsx) by
// scripts/build-brand.mjs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Grace — by Grace-bound Ventures",
    short_name: "Grace",
    description: "Your church, together — every day of the week. By Grace-bound Ventures.",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#1A0B21", // aubergine splash screen behind the icon
    theme_color: "#FDF7F8", // matches the light status bar (app/layout.tsx viewport)
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    lang: "en-ZA",
    categories: ["lifestyle", "social", "education"],
    prefer_related_applications: false,
    // Lets the dashboard ask Chrome "is Grace already installed on this phone?"
    // (navigator.getInstalledRelatedApps), so it stops offering to install it.
    related_applications: [{ platform: "webapp", url: `${process.env.NEXT_PUBLIC_APP_URL || ""}/manifest.webmanifest` }],
  };
}
