import { describe, expect, test } from "vitest";
import { isOverdue, monthlyValue } from "@/lib/platform";

const now = new Date("2026-11-03T10:00:00Z");
const prices = { basic: { monthly: 200, yearly: 2000 }, premium: { monthly: 799, yearly: 7990 } };

describe("platform admin", () => {
  test("overdue: a paying plan past its paid-up date", () => {
    expect(isOverdue({ plan_key: "basic", status: "active", billing_date: "2026-11-01T00:00:00Z" }, now)).toBe(true);
    expect(isOverdue({ plan_key: "basic", status: "active", billing_date: "2026-11-10T00:00:00Z" }, now)).toBe(false);
    expect(isOverdue({ plan_key: "basic", status: "suspended", billing_date: "2026-10-01T00:00:00Z" }, now)).toBe(false);
    expect(isOverdue({ plan_key: "sponsored", status: "active", billing_date: "2026-10-01T00:00:00Z" }, now)).toBe(false);
    expect(isOverdue({ plan_key: "premium", status: "active", is_lifetime: true, billing_date: "2026-10-01T00:00:00Z" }, now)).toBe(false);
  });
  test("monthly income: plan price, yearly as a twelfth, special prices, nothing for trials or suspended", () => {
    expect(monthlyValue({ plan_key: "basic", status: "active" }, prices, now)).toBe(200);
    expect(monthlyValue({ plan_key: "premium", status: "active", billing_interval: "yearly" }, prices, now)).toBeCloseTo(7990 / 12);
    expect(monthlyValue({ plan_key: "basic", status: "active", price_override: "150" }, prices, now)).toBe(150);
    expect(monthlyValue({ plan_key: "free_trial", status: "trial", trial_expires_at: "2026-12-01T00:00:00Z" }, prices, now)).toBe(0);
    expect(monthlyValue({ plan_key: "premium", status: "suspended" }, prices, now)).toBe(0);
  });
});
