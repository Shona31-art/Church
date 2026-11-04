import { describe, expect, test } from "vitest";
import { invoiceNumber, receiptEmail, reminderEmail } from "@/lib/billing-emails";

describe("billing emails", () => {
  const base = { churchName: "KAMI <Church>", planKey: "basic", interval: "monthly" as const, amountCents: 20000 };

  test("reminder says when and how much, and whether the card is charged by itself", () => {
    const auto = reminderEmail({ ...base, dueDate: "2026-12-05T08:00:00Z", autoCharge: true, billingUrl: "https://app/dashboard/billing" });
    expect(auto.subject).toContain("5 December 2026");
    expect(auto.subject).toMatch(/R\s?200,00/);
    expect(auto.text).toContain("charge the card on file automatically");
    expect(auto.html).toContain("KAMI &lt;Church&gt;"); // names are escaped
    expect(auto.html).not.toContain("KAMI <Church>");
    const manual = reminderEmail({ ...base, dueDate: "2026-12-05T08:00:00Z", autoCharge: false, billingUrl: "https://app/dashboard/billing" });
    expect(manual.text).toContain("Please pay before then");
  });

  test("receipt carries the invoice number, a thank-you and the invoice link", () => {
    const r = receiptEmail({
      ...base,
      interval: "yearly",
      invoiceNo: 1001,
      kind: "renewal",
      paidAt: "2026-11-03T10:00:00Z",
      periodEnd: "2027-11-03T10:00:00Z",
      reference: "T123",
      invoiceUrl: "https://app/dashboard/billing/invoice/x",
    });
    expect(invoiceNumber(1001)).toBe("GBV-1001");
    expect(r.subject).toContain("GBV-1001");
    expect(r.text).toContain("Thank you");
    expect(r.text).toContain("yearly renewal");
    expect(r.text).toContain("3 November 2027");
    expect(r.html).toContain("https://app/dashboard/billing/invoice/x");
  });
});
