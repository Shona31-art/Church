import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => { throw new Error("no database in unit tests"); } }));
const { decideSettlement, cardReference } = await import("@/lib/card-giving");
const paystack = await import("@/lib/paystack");

const GIFT = { id: "1b4e28ba-2fa1-41d2-883f-0016d3cca427", status: "pending", amount_cents: 25000, fee_cents: 0, provider_reference: cardReference("1b4e28ba-2fa1-41d2-883f-0016d3cca427") };
const tx = (over: Partial<Parameters<typeof decideSettlement>[1]> = {}) => ({
  status: "success",
  amountCents: 25000,
  currency: "ZAR",
  reference: GIFT.provider_reference!,
  metadata: { giving_id: GIFT.id },
  ...over,
});

describe("decideSettlement", () => {
  test("received only when Paystack says success for exactly this gift, amount and currency", () => {
    expect(decideSettlement(GIFT, tx())).toBe("received");
  });
  test("the fee a member chose to add is part of the expected amount", () => {
    expect(decideSettlement({ ...GIFT, fee_cents: 850 }, tx({ amountCents: 25850 }))).toBe("received");
    expect(decideSettlement({ ...GIFT, fee_cents: 850 }, tx({ amountCents: 25000 }))).toBe("mismatch");
  });
  test("a success that doesn't match is never marked received", () => {
    expect(decideSettlement(GIFT, tx({ amountCents: 100 }))).toBe("mismatch");
    expect(decideSettlement(GIFT, tx({ currency: "NGN" }))).toBe("mismatch");
    expect(decideSettlement(GIFT, tx({ reference: "gb-someone-else" }))).toBe("mismatch");
    expect(decideSettlement(GIFT, tx({ metadata: { giving_id: "another-gift" } }))).toBe("mismatch");
  });
  test("failed, abandoned and reversed payments fail the gift; in-progress ones wait", () => {
    for (const status of ["failed", "abandoned", "reversed"]) expect(decideSettlement(GIFT, tx({ status }))).toBe("failed");
    for (const status of ["ongoing", "pending", "processing", "queued"]) expect(decideSettlement(GIFT, tx({ status }))).toBe("pending");
  });
  test("replays change nothing: a gift already settled stays as it is", () => {
    expect(decideSettlement({ ...GIFT, status: "succeeded" }, tx())).toBe("already_settled");
    expect(decideSettlement({ ...GIFT, status: "failed" }, tx())).toBe("already_settled");
    expect(decideSettlement(null, tx())).toBe("not_found");
  });
});

describe("isValidWebhookSignature", () => {
  const SECRET = "sk_test_unit";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "gb-x" } });
  const sign = (b: string, s = SECRET) => createHmac("sha512", s).update(b).digest("hex");

  test("accepts Paystack's signature of the exact raw body", () => {
    expect(paystack.isValidWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });
  test("rejects a missing, forged or re-serialised signature, and refuses everything without a key", () => {
    expect(paystack.isValidWebhookSignature(body, null, SECRET)).toBe(false);
    expect(paystack.isValidWebhookSignature(body, sign(body, "sk_test_other"), SECRET)).toBe(false);
    expect(paystack.isValidWebhookSignature(body + " ", sign(body), SECRET)).toBe(false);
    expect(paystack.isValidWebhookSignature(body, "short", SECRET)).toBe(false);
    expect(paystack.isValidWebhookSignature(body, sign(body), "")).toBe(false);
  });
});

describe("Paystack client", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_unit";
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.PAYSTACK_SECRET_KEY;
  });

  test("initialize sends rand in cents, the church's subaccount, fee on the subaccount, card only", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: true, message: "ok", data: { authorization_url: "https://checkout.paystack.com/abc", access_code: "abc", reference: "gb-1" } })));
    globalThis.fetch = fetchMock as never;
    const out = await paystack.initializeTransaction({ email: "m@a.test", amountCents: 25000, reference: "gb-1", callbackUrl: "https://app/x", subaccountCode: "ACCT_abc", metadata: { giving_id: "g" } });
    expect(out).toEqual({ authorizationUrl: "https://checkout.paystack.com/abc", reference: "gb-1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.paystack.co/transaction/initialize");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_unit");
    expect(JSON.parse(String(init.body))).toMatchObject({ amount: 25000, currency: "ZAR", subaccount: "ACCT_abc", bearer: "subaccount", channels: ["card"] });
  });

  test("Paystack refusals and network errors become PaystackError", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ status: false, message: "Invalid key" }), { status: 401 })) as never;
    await expect(paystack.verifyTransaction("gb-1")).rejects.toThrow("Invalid key");
    globalThis.fetch = vi.fn(async () => { throw new TypeError("fetch failed"); }) as never;
    await expect(paystack.verifyTransaction("gb-1")).rejects.toThrow(/request failed/);
  });

  test("subaccounts take 0 % for the platform", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: true, message: "ok", data: { subaccount_code: "ACCT_new" } })));
    globalThis.fetch = fetchMock as never;
    await paystack.createSubaccount({ businessName: "KAMI", bankCode: "250655", accountNumber: "62812345678", contactEmail: "a@a.test" });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ settlement_bank: "250655", account_number: "62812345678", percentage_charge: 0 });
  });

  test("nothing is sent without a key", async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    await expect(paystack.verifyTransaction("gb-1")).rejects.toThrow(/PAYSTACK_SECRET_KEY/);
  });
});
