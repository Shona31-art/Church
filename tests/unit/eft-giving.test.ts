import { describe, expect, test } from "vitest";
import { defaultReferencePrefix, eftReference, givingDetailsSchema, transferReportSchema } from "@/lib/giving";

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
