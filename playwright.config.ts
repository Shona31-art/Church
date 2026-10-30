import { defineConfig, devices } from "@playwright/test";

// Browser (end-to-end) tests — run with `pnpm test:e2e`.
//
// Two groups:
//   * public — signed-out pages and access rules. Needs no database: runs in
//     CI on every push (a placeholder Supabase URL is enough).
//   * roles  — signs in as each seeded demo login (scripts/seed-demo.mjs) and
//     walks the dashboard. Needs a real test Supabase project: set
//     E2E_SEEDED=1 (and E2E_PASSWORD if you changed SEED_PASSWORD) after
//     `pnpm seed`. Skipped otherwise.
//
// E2E_BASE_URL tests an already-running app (e.g. a Vercel Preview);
// without it, Playwright starts one on port 3200.
const PORT = 3200;
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "public", testMatch: /public\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "public-mobile", testMatch: /public\.spec\.ts/, use: { ...devices["Pixel 7"] } },
    { name: "roles", testMatch: /roles\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // CI tests the production build (`pnpm build` runs first); locally the dev server is fine.
        command: process.env.CI ? `pnpm start -p ${PORT}` : `pnpm dev -p ${PORT}`,
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
