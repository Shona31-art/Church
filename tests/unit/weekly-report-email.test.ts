import { describe, expect, test } from "vitest";
import { weeklyReportEmail, type WeeklyReport } from "@/lib/weekly-report-email";
import { certificateLine } from "@/lib/certificates";

const base: WeeklyReport = {
  churchName: "KAMI <Durban>",
  weekLabel: "27 Oct – 2 Nov",
  newMembers: [{ name: "Thabo" }],
  liveServices: [{ title: "Sunday Service", when: "Sun 9 Nov, 09:00" }],
  prayerChains: [{ title: "7 days of prayer", when: "Mon 3 Nov – Mon 10 Nov", schedule: "daily at 05:00, 15:00 and 18:00", covered: 12, total: 21 }],
  testimoniesShared: 2,
  prayer: { newRequests: 5, answered: 1 },
  giving: { totalCents: 125000, gifts: 4, awaitingConfirmation: 2 },
  birthdays: [{ name: "Lerato", when: "Wednesday 5 Nov", child: true }],
  events: [],
  needsAttention: [{ label: "booking requests waiting", count: 2, link: "/dashboard/booking" }],
  rosterGaps: [{ team: "Ushers", when: "Sun 9 Nov", why: "nobody" }],
  readingPlans: [{ title: "John in March", readers: 12 }],
  appUrl: "https://app/dashboard",
};

describe("Monday report email", () => {
  test("covers people, prayer, giving, birthdays and what needs attention", () => {
    const { subject, text, html } = weeklyReportEmail(base);
    expect(subject).toContain("Monday report");
    expect(text).not.toContain("active members");
    expect(text).toContain("1 person joined Grace: Thabo");
    expect(text).toContain("7 days of prayer — Mon 3 Nov – Mon 10 Nov, daily at 05:00, 15:00 and 18:00. 12 of 21 slots covered");
    expect(text).toContain("🔴 Sunday Service — Sun 9 Nov, 09:00 (Live Sunday)");
    expect(text).toContain("2 testimonies on the wall");
    expect(text).toContain("5 new prayer requests");
    expect(text).toMatch(/R\s?1\s?250,00 from 4 gifts/);
    expect(text).toContain("Lerato (child) — Wednesday 5 Nov");
    expect(text).toContain("Ushers, Sun 9 Nov: nobody on duty");
    expect(text).toContain("2 booking requests waiting");
    expect(html).toContain("KAMI &lt;Durban&gt;");
  });
  test("no giving section when giving isn't available", () => {
    expect(weeklyReportEmail({ ...base, giving: null }).text).not.toContain("GIVING");
    // Nothing to report → no section (apart from new people).
    const quiet = weeklyReportEmail({ ...base, newMembers: [], prayer: { newRequests: 0, answered: 0 }, testimoniesShared: 0, giving: null, birthdays: [], events: [], liveServices: [], prayerChains: [], needsAttention: [], rosterGaps: [], readingPlans: [] });
    expect(quiet.sections.map((x) => x.title)).toEqual(["New people"]);
    expect(quiet.text).toContain("No one new joined this week.");
  });
});

describe("certificates", () => {
  test("wording per kind", () => {
    expect(certificateLine({ kind: "course", recipient: "A", church: "C", courseName: "Foundations" })).toBe("has successfully completed Foundations");
    expect(certificateLine({ kind: "dedication", recipient: "A", church: "C", parents: "T and L" })).toContain("T and L");
    expect(certificateLine({ kind: "membership", recipient: "A", church: "Grace Church" })).toContain("Grace Church");
  });
});

describe("certificate headings and wrapping", () => {
  test("splits 'Certificate of …' and keeps other titles whole", async () => {
    const { certificateHeading, wrapText } = await import("@/lib/certificates");
    expect(certificateHeading({ kind: "baptism" })).toEqual({ top: "Certificate", main: "of Baptism" });
    expect(certificateHeading({ kind: "custom", customTitle: "Certificate of Appreciation" })).toEqual({ top: "Certificate", main: "of Appreciation" });
    expect(certificateHeading({ kind: "custom", customTitle: "Ordination" })).toEqual({ top: "", main: "Ordination" });
    expect(wrapText("one two three four", 9)).toEqual(["one two", "three", "four"]);
  });
});
