import { describe, expect, test } from "vitest";
import {
  addOneMonth,
  billingReference,
  decideBillingPayment,
  isBillingReference,
  nextPeriodEnd,
  onlineBillingState,
  planCodesFromEnv,
  planForCode,
  priceToCents,
} from "@/lib/billing";

const ID = "1b4e28ba-2fa1-41d2-883f-0016d3cca427";
const payment = { id: ID, status: "pending", plan_key: "premium", amount_cents: 59900, reference: billingReference(ID) };
const tx = { status: "success", amountCents: 59900, currency: "ZAR", reference: billingReference(ID), metadata: { billing_payment_id: ID }, planCode: "PLN_premium" };

describe("online billing rules", () => {
  test("references are recognisable and distinct from card gifts", () => {
    expect(isBillingReference(billingReference(ID))).toBe(true);
    expect(isBillingReference(`gb-${ID}`)).toBe(false);
    expect(isBillingReference("gbsub-not-a-uuid")).toBe(false);
  });

  test("plan codes come from the environment and are validated", () => {
    const codes = planCodesFromEnv({ PAYSTACK_PLAN_BASIC: "PLN_basic", PAYSTACK_PLAN_PREMIUM: "not-a-code" });
    expect(codes).toEqual({ basic: "PLN_basic" });
    expect(planForCode("PLN_basic", codes)).toBe("basic");
    expect(planForCode("PLN_other", codes)).toBeNull();
    expect(planForCode(undefined, codes)).toBeNull();
  });

  test("prices convert to cents", () => {
    expect(priceToCents("299.00")).toBe(29900);
    expect(priceToCents(0.1 + 0.2)).toBe(30);
  });

  test("a month later, clamped to the month's last day", () => {
    expect(addOneMonth(new Date("2026-01-31T10:00:00Z")).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addOneMonth(new Date("2028-01-31T10:00:00Z")).toISOString()).toBe("2028-02-29T10:00:00.000Z");
    expect(addOneMonth(new Date("2026-12-15T00:00:00Z")).toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });

  test("paying early never shortens time already paid for", () => {
    const now = new Date("2026-10-30T00:00:00Z");
    expect(nextPeriodEnd("2026-11-20T00:00:00Z", now).toISOString()).toBe("2026-12-20T00:00:00.000Z");
    expect(nextPeriodEnd("2026-09-01T00:00:00Z", now).toISOString()).toBe("2026-11-30T00:00:00.000Z");
    expect(nextPeriodEnd(null, now).toISOString()).toBe("2026-11-30T00:00:00.000Z");
  });

  test("only an exact, successful match activates a plan", () => {
    expect(decideBillingPayment(payment, tx, "PLN_premium")).toBe("paid");
    expect(decideBillingPayment(null, tx, "PLN_premium")).toBe("not_found");
    expect(decideBillingPayment({ ...payment, status: "succeeded" }, tx, "PLN_premium")).toBe("already_settled");
    expect(decideBillingPayment(payment, { ...tx, amountCents: 100 }, "PLN_premium")).toBe("mismatch");
    expect(decideBillingPayment(payment, { ...tx, currency: "NGN" }, "PLN_premium")).toBe("mismatch");
    expect(decideBillingPayment(payment, { ...tx, planCode: "PLN_basic" }, "PLN_premium")).toBe("mismatch");
    expect(decideBillingPayment(payment, { ...tx, metadata: { billing_payment_id: "other" } }, "PLN_premium")).toBe("mismatch");
    expect(decideBillingPayment(payment, tx, undefined)).toBe("mismatch");
    expect(decideBillingPayment(payment, { ...tx, status: "abandoned" }, "PLN_premium")).toBe("failed");
    expect(decideBillingPayment(payment, { ...tx, status: "ongoing" }, "PLN_premium")).toBe("pending");
  });

  test("what the Billing page offers", () => {
    expect(onlineBillingState(null)).toBe("available");
    expect(onlineBillingState({ is_lifetime: true })).toBe("arranged");
    expect(onlineBillingState({ price_override: "0.00" })).toBe("arranged");
    expect(onlineBillingState({ price_override: null, paystack_subscription_code: "SUB_x" })).toBe("subscribed");
    expect(onlineBillingState({ price_override: null, paystack_subscription_code: "SUB_x", cancelled_at: "2026-10-01" })).toBe("cancelled");
  });
});

describe("yearly billing", () => {
  test("a year on lands on the same date (29 Feb → 28 Feb)", async () => {
    const { addOneYear, nextPeriodEnd } = await import("@/lib/billing");
    expect(addOneYear(new Date("2026-01-31T00:00:00Z")).toISOString()).toBe("2027-01-31T00:00:00.000Z");
    expect(addOneYear(new Date("2028-02-29T00:00:00Z")).toISOString()).toBe("2029-02-28T00:00:00.000Z");
    expect(nextPeriodEnd(null, new Date("2026-10-31T00:00:00Z"), "yearly").toISOString()).toBe("2027-10-31T00:00:00.000Z");
    // Paying early never shortens time already paid for.
    expect(nextPeriodEnd("2026-12-15T00:00:00Z", new Date("2026-10-31T00:00:00Z"), "yearly").toISOString()).toBe("2027-12-15T00:00:00.000Z");
  });

  test("monthly and yearly Paystack plans are told apart", async () => {
    const { planCodesFromEnv, planIntervalForCode } = await import("@/lib/billing");
    const env = { PAYSTACK_PLAN_BASIC: "PLN_bm", PAYSTACK_PLAN_BASIC_YEARLY: "PLN_by", PAYSTACK_PLAN_ENTERPRISE: "PLN_em" };
    expect(planCodesFromEnv(env, "yearly")).toEqual({ basic: "PLN_by" });
    expect(planIntervalForCode("PLN_by", env)).toEqual({ plan: "basic", interval: "yearly" });
    expect(planIntervalForCode("PLN_em", env)).toEqual({ plan: "enterprise", interval: "monthly" });
    expect(planIntervalForCode("PLN_other", env)).toBeNull();
  });
});
