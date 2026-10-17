/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  experimental: {
    // Server code that reads Bible text from disk (lib/bible/text.ts) needs the
    // files bundled with its route: on Vercel, public/ is served by the CDN and
    // isn't in server functions by default. WEB only — it's the version used
    // for the daily verse and the AI study passage.
    outputFileTracingIncludes: {
      "/dashboard": ["./public/bibles/web/**"],
      "/dashboard/bible": ["./public/bibles/web/**"],
      "/dashboard/bible/study": ["./public/bibles/web/**"],
    },
  },
  async headers() {
    return [
      {
        // The offline service worker (public/sw.js) must never be cached, or
        // phones would keep running an old version after a deploy.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};
