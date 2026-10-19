import { describe, expect, test } from "vitest";
import { cardFeeRateFromEnv, coverFeeCents, defaultReferencePrefix, eftReference, givingDetailsSchema, transferReportSchema } from "@/lib/giving";

describe("eftReference", () => {
  test("matches what the database trigger stores (same example as tests/db/eft-giving.test.ts)", () => {
    expect(eftReference("KAMI", "3f9a2c00-0000-0000-0000-000000000003")).toBe("KAMI-3F9A2C");
  });
});

describe("defaultReferencePrefix", () => {
  test("uses the name's letters, skipping filler words, up to 8 characters", () => {
    expect(defaultReferencePrefix("KAMI Church")).toBe("KAMI");
    expect(defaultReferencePrefix("St Mark's")).toBe("STMARKS");
    expect(defaultReferencePrefix("The Church of the Good Shepherd")).toBe("GOODSHEP");
  });
  test("falls back when there's nothing usable", () => {
    expect(defaultReferencePrefix("Church")).toBe("GIVE");
    expect(defaultReferencePrefix("é")).toBe("GIVE");
  });
});

describe("givingDetailsSchema", () => {
  const ok = { account_name: "KAMI Church", bank_name: "FNB", account_number: "6281 234 5678", branch_code: "250 655", account_type: "cheque", reference_prefix: "kami" };
  test("tidies spaces and case", () => {
    expect(givingDetailsSchema.parse(ok)).toMatchObject({ account_number: "62812345678", branch_code: "250655", reference_prefix: "KAMI" });
  });
  test("refuses letters in numbers, short branch codes and long prefixes", () => {
    expect(givingDetailsSchema.safeParse({ ...ok, account_number: "62812O45678" }).success).toBe(false);
    expect(givingDetailsSchema.safeParse({ ...ok, branch_code: "25065" }).success).toBe(false);
    expect(givingDetailsSchema.safeParse({ ...ok, reference_prefix: "TOOLONGPREFIX" }).success).toBe(false);
    expect(givingDetailsSchema.safeParse({ ...ok, account_type: "crypto" }).success).toBe(false);
  });
});

describe("transferReportSchema", () => {
  const schema = transferReportSchema("2026-10-19");
  test("parses rand amounts to cents", () => {
    expect(schema.parse({ amount_cents: "1 250,50", fund: "tithe", paid_on: "2026-10-19" })).toEqual({ amount_cents: 125050, fund: "tithe", paid_on: "2026-10-19" });
  });
  test("refuses future dates, zero and silly amounts, unknown funds", () => {
    expect(schema.safeParse({ amount_cents: "250", fund: "general", paid_on: "2026-10-20" }).success).toBe(false);
    expect(schema.safeParse({ amount_cents: "0", fund: "general", paid_on: "2026-10-19" }).success).toBe(false);
    expect(schema.safeParse({ amount_cents: "100001", fund: "general", paid_on: "2026-10-19" }).success).toBe(false);
    expect(schema.safeParse({ amount_cents: "abc", fund: "general", paid_on: "2026-10-19" }).success).toBe(false);
    expect(schema.safeParse({ amount_cents: "250", fund: "car_wash", paid_on: "2026-10-19" }).success).toBe(false);
  });
});

describe("coverFeeCents", () => {
  const rate = { percent: 2.9, flatCents: 100 };
  test("after Paystack takes its share of the total, the church keeps the whole gift", () => {
    for (const gift of [1000, 25000, 99999, 10_000_000]) {
      const total = gift + coverFeeCents(gift, rate);
      const paystackTakes = Math.round(total * 0.029) + 100;
      expect(total - paystackTakes).toBeGreaterThanOrEqual(gift);
      expect(total - paystackTakes - gift).toBeLessThanOrEqual(1); // never more than a cent over
    }
  });
  test("nonsense rates add nothing", () => {
    expect(coverFeeCents(25000, { percent: 80, flatCents: 0 })).toBe(0);
    expect(coverFeeCents(25000, { percent: -1, flatCents: 0 })).toBe(0);
  });
});

describe("cardFeeRateFromEnv", () => {
  test("hidden unless a sensible rate is configured", () => {
    expect(cardFeeRateFromEnv({})).toBeNull();
    expect(cardFeeRateFromEnv({ PAYSTACK_FEE_PERCENT: "abc" })).toBeNull();
    expect(cardFeeRateFromEnv({ PAYSTACK_FEE_PERCENT: "2.9", PAYSTACK_FEE_FLAT_CENTS: "1.5" })).toBeNull();
    expect(cardFeeRateFromEnv({ PAYSTACK_FEE_PERCENT: "2.9", PAYSTACK_FEE_FLAT_CENTS: "100" })).toEqual({ percent: 2.9, flatCents: 100 });
    expect(cardFeeRateFromEnv({ PAYSTACK_FEE_PERCENT: "2.9" })).toEqual({ percent: 2.9, flatCents: 0 });
  });
});
