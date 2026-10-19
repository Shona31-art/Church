import { afterEach, describe, expect, test, vi } from "vitest";

// POST /api/stripe/webhook — only the checks before any database work.
// The admin client is mocked so a mistake here can never write anywhere.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => { throw new Error("must not reach the database"); } }));
const { POST } = await import("@/app/api/stripe/webhook/route");

const call = (signature?: string) =>
  POST(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: signature ? { "stripe-signature": signature } : {},
      body: JSON.stringify({ id: "evt_test", type: "invoice.paid" }),
    }) as never,
  );

afterEach(() => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe("POST /api/stripe/webhook", () => {
  test("500 when Stripe isn't configured on this server", async () => {
    expect((await call("t=1,v1=abc")).status).toBe(500);
  });

  test("400 for a request with no signature, or a forged one", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
    expect((await call()).status).toBe(400);
    expect((await call("t=1,v1=forged")).status).toBe(400);
  });
});
