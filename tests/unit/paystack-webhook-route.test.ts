import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// POST /api/paystack/webhook — signature check and routing only; settlement
// itself is tested in card-giving.test.ts. Nothing here reaches a database.
vi.mock("server-only", () => ({}));
const settle = vi.fn(async () => "received");
vi.mock("@/lib/card-giving", () => ({ settlePaystackGift: settle }));
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
  });

  test("a temporary failure asks Paystack to retry", async () => {
    settle.mockRejectedValueOnce(new Error("db down"));
    expect((await call({ event: "charge.success", data: { reference: "gb-abc" } })).status).toBe(500);
  });
});
