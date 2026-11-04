import { expect, test, type Page } from "@playwright/test";

// Walks the dashboard as each seeded demo login (scripts/seed-demo.mjs), so
// every role is checked in a real browser against a real Supabase project.
// Run after `pnpm seed` with E2E_SEEDED=1; skipped otherwise.

test.skip(!process.env.E2E_SEEDED, "Needs a seeded test Supabase project: run `pnpm seed`, then set E2E_SEEDED=1.");

const PASSWORD = process.env.E2E_PASSWORD || "DemoPassword!2026";

const ROLES = [
  {
    role: "church admin",
    email: "admin@demo.church.test",
    sees: ["Members", "Pastoral Care", "Billing", "Church settings", "Giving report"],
    hidden: [],
    pages: ["/dashboard/members", "/dashboard/billing", "/dashboard/giving/report", "/dashboard/setup", "/dashboard/pastoral-care"],
  },
  {
    role: "pastor",
    email: "pastor@demo.church.test",
    sees: ["Members", "Pastoral Care"],
    hidden: ["Billing", "Church settings", "Giving report"],
    pages: ["/dashboard/members", "/dashboard/pastoral-care", "/dashboard/sermons"],
  },
  {
    role: "department leader",
    email: "leader@demo.church.test",
    sees: ["Announcements", "Calendar"],
    hidden: ["Members", "Pastoral Care", "Billing"],
    pages: ["/dashboard/announcements", "/dashboard/calendar"],
  },
  {
    role: "member",
    email: "member@demo.church.test",
    sees: ["Prayer Board", "Bible"],
    hidden: ["Members", "Pastoral Care", "Billing", "Church settings", "Giving report"],
    pages: ["/dashboard/prayer-board", "/dashboard/bible", "/dashboard/journal"],
  },
] as const;

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

for (const r of ROLES) {
  test.describe(`as a ${r.role}`, () => {
    test("signs in and sees the right menu", async ({ page }) => {
      await signIn(page, r.email);
      const nav = page.getByRole("navigation", { name: "Main" }).first();
      for (const label of r.sees) await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
      for (const label of r.hidden) await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
    });

    test("opens its pages without errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await signIn(page, r.email);
      for (const path of r.pages) {
        const response = await page.goto(path);
        expect(response?.status(), path).toBeLessThan(400);
        await expect(page.getByText("Something went wrong loading this page")).toHaveCount(0);
        await expect(page.getByText("You don't have access to this page")).toHaveCount(0);
      }
      expect(errors).toEqual([]);
    });
  });
}

test("a member is refused admin-only pages even by direct link", async ({ page }) => {
  await signIn(page, "member@demo.church.test");
  for (const path of ["/dashboard/billing", "/dashboard/giving/report", "/dashboard/pastoral-care"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: /You don.t have access to this page|not available/i }).first()).toBeVisible();
  }
});

test("signing out returns to the sign-in page and the dashboard is closed again", async ({ page }) => {
  await signIn(page, "member@demo.church.test");
  await page.getByRole("button", { name: /Sign out/i }).first().click();
  await expect(page).toHaveURL(/\/login|\/$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
