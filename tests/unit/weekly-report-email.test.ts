import { describe, expect, test } from "vitest";
import { weeklyReportEmail, type WeeklyReport } from "@/lib/weekly-report-email";
import { certificateLine } from "@/lib/certificates";

const base: WeeklyReport = {
  churchName: "KAMI <Durban>",
  weekLabel: "27 Oct – 2 Nov",
  members: { total: 48, newThisWeek: [{ name: "Thabo" }], invitedWaiting: 3 },
  prayer: { newRequests: 5, answered: 1 },
  giving: { totalCents: 125000, gifts: 4, awaitingConfirmation: 2 },
  birthdays: [{ name: "Lerato", when: "Wednesday 5 Nov", child: true }],
  events: [],
  needsAttention: [{ label: "booking request(s) waiting", count: 2, link: "/dashboard/booking" }],
  rosterGaps: [{ team: "Ushers", when: "Sun 9 Nov", why: "nobody" }],
  readingPlans: [{ title: "John in March", readers: 12 }],
  appUrl: "https://app/dashboard",
};

describe("Monday report email", () => {
  test("covers people, prayer, giving, birthdays and what needs attention", () => {
    const { subject, text, html } = weeklyReportEmail(base);
    expect(subject).toContain("Monday report");
    expect(text).toContain("48 active members");
    expect(text).toContain("1 new this week: Thabo");
    expect(text).toContain("5 new prayer requests");
    expect(text).toMatch(/R\s?1\s?250,00 from 4 gifts/);
    expect(text).toContain("Lerato (child) — Wednesday 5 Nov");
    expect(text).toContain("Ushers, Sun 9 Nov: nobody on duty");
    expect(text).toContain("2 booking request(s) waiting");
    expect(html).toContain("KAMI &lt;Durban&gt;");
  });
  test("no giving section when giving isn't available", () => {
    expect(weeklyReportEmail({ ...base, giving: null }).text).not.toContain("GIVING");
  });
});

describe("certificates", () => {
  test("wording per kind", () => {
    expect(certificateLine({ kind: "course", recipient: "A", church: "C", courseName: "Foundations" })).toBe("has successfully completed Foundations");
    expect(certificateLine({ kind: "dedication", recipient: "A", church: "C", parents: "T and L" })).toContain("T and L");
    expect(certificateLine({ kind: "membership", recipient: "A", church: "Grace Church" })).toContain("Grace Church");
  });
});
