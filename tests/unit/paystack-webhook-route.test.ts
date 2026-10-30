import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// POST /api/paystack/webhook — signature check and routing only; settlement
// itself is tested in card-giving.test.ts. Nothing here reaches a database.
vi.mock("server-only", () => ({}));
const settle = vi.fn(async () => "received");
vi.mock("@/lib/card-giving", () => ({ settlePaystackGift: settle }));
const billing = {
  settleBillingCheckout: vi.fn(async () => "paid"),
  recordRenewal: vi.fn(async () => "ignored"),
  linkSubscription: vi.fn(async () => "linked"),
  markPaymentFailed: vi.fn(async () => "grace"),
  markCancelled: vi.fn(async () => "cancelled"),
};
vi.mock("@/lib/subscription-billing", () => billing);
const { POST } = await import("@/app/api/paystack/webhook/route");

const SECRET = "sk_test_route";
const call = (body: unknown, signature?: string) => {
  const raw = JSON.stringify(body);
  const sig = signature ?? createHmac("sha512", SECRET).update(raw).digest("hex");
  return POST(new Request("http://localhost/api/paystack/webhook", { method: "POST", headers: { "x-paystack-signature": sig }, body: raw }) as never);
};

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = SECRET;
  settle.mockClear();
  Object.values(billing).forEach((fn) => fn.mockClear());
});
afterEach(() => {
  delete process.env.PAYSTACK_SECRET_KEY;
});

describe("POST /api/paystack/webhook", () => {
  test("a forged or missing signature is refused and nothing is settled", async () => {
    expect((await call({ event: "charge.success", data: { reference: "gb-1" } }, "forged")).status).toBe(401);
    delete process.env.PAYSTACK_SECRET_KEY;
    expect((await call({ event: "charge.success", data: { reference: "gb-1" } })).status).toBe(401);
    expect(settle).not.toHaveBeenCalled();
  });

  test("a signed charge event for one of our gifts is settled (by asking Paystack, not trusting the body)", async () => {
    const res = await call({ event: "charge.success", data: { reference: "gb-abc", amount: 1, status: "success" } });
    expect(res.status).toBe(200);
    expect(settle).toHaveBeenCalledWith("gb-abc");
  });

  test("other events and other references are acknowledged but ignored", async () => {
    expect((await call({ event: "transfer.success", data: { reference: "gb-abc" } })).status).toBe(200);
    expect((await call({ event: "charge.success", data: { reference: "someone-elses-ref" } })).status).toBe(200);
    expect(settle).not.toHaveBeenCalled();
    // A charge with Paystack's own reference may be a subscription renewal: recordRenewal verifies and decides.
    expect(billing.recordRenewal).toHaveBeenCalledWith("someone-elses-ref");
  });

  test("subscription checkouts, renewals, failures and cancellations go to billing", async () => {
    await call({ event: "charge.success", data: { reference: "gbsub-123" } });
    expect(billing.settleBillingCheckout).toHaveBeenCalledWith("gbsub-123");
    await call({ event: "subscription.create", data: { subscription_code: "SUB_abc" } });
    expect(billing.linkSubscription).toHaveBeenCalledWith("SUB_abc");
    await call({ event: "invoice.payment_failed", data: { subscription: { subscription_code: "SUB_abc" } } });
    expect(billing.markPaymentFailed).toHaveBeenCalledWith("SUB_abc");
    await call({ event: "subscription.not_renew", data: { subscription_code: "SUB_abc" } });
    await call({ event: "subscription.disable", data: { subscription_code: "SUB_abc" } });
    expect(billing.markCancelled).toHaveBeenCalledTimes(2);
    expect(settle).not.toHaveBeenCalled();
  });

  test("a temporary billing failure asks Paystack to retry", async () => {
    billing.linkSubscription.mockRejectedValueOnce(new Error("db down"));
    expect((await call({ event: "subscription.create", data: { subscription_code: "SUB_abc" } })).status).toBe(500);
  });

  test("a temporary failure asks Paystack to retry", async () => {
    settle.mockRejectedValueOnce(new Error("db down"));
    expect((await call({ event: "charge.success", data: { reference: "gb-abc" } })).status).toBe(500);
  });
});
