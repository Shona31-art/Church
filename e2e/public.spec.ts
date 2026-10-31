import { expect, test } from "@playwright/test";

// Signed-out pages and the access rules around them. No database needed.

test("the opening intro presents Grace and can be skipped, once per visit", async ({ page }) => {
  await page.goto("/");
  const intro = page.getByRole("dialog", { name: "Welcome to Grace" });
  await expect(intro).toBeVisible();
  await expect(intro.getByAltText("Grace-bound Ventures")).toBeVisible();
  await intro.getByRole("button", { name: "Skip intro" }).click();
  await expect(intro).toBeHidden();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Welcome to Grace" })).toHaveCount(0);
});

test("the intro ends with Enter", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter" }).click({ timeout: 15_000 });
  await expect(page.getByRole("dialog", { name: "Welcome to Grace" })).toBeHidden();
});

test("landing page introduces the product and leads to sign-up", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Run your church with confidence");
  await expect(page.getByText("Grace-bound Ventures presents")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Everything your church does through the week" })).toBeVisible();
  await page.getByRole("link", { name: /Begin your 30-day trial/i }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole("heading", { name: "Start your free trial" })).toBeVisible();
});

test("sign-in form has labelled fields and links to password reset", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to your church" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await page.getByRole("link", { name: /Forgot password/i }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
});

test("the dashboard sends signed-out visitors to sign in, remembering where they were going", async ({ page }) => {
  await page.goto("/dashboard/members");
  await expect(page).toHaveURL(/\/login/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/dashboard/members");
});

test("unknown pages show the not-found page", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Error 404")).toBeVisible();
});

test("the browser error endpoint only accepts this site's own pages", async ({ request, baseURL }) => {
  const forged = await request.post("/api/errors", { data: { message: "x" }, headers: { origin: "https://evil.example" } });
  expect(forged.status()).toBe(403);
  const own = await request.post("/api/errors", { data: { message: "e2e check" }, headers: { origin: new URL(baseURL!).origin } });
  expect(own.status()).toBe(204);
});

test("no horizontal scrolling on the landing page", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
