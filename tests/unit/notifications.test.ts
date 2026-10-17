import { describe, expect, test } from "vitest";
import { badgeText, relativeTime, safeNotificationLink } from "@/lib/notifications";

describe("relativeTime", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();
  test.each([
    [10, "Just now"],
    [5 * 60, "5 min ago"],
    [3 * 3600, "3 h ago"],
    [26 * 3600, "Yesterday"],
    [4 * 86_400, "4 days ago"],
  ])("%i seconds ago → %s", (seconds, expected) => {
    expect(relativeTime(ago(seconds), now)).toBe(expected);
  });
  test("older dates show the date, with the year only when it differs", () => {
    expect(relativeTime("2026-10-01T12:00:00Z", now)).toMatch(/1 Oct/);
    expect(relativeTime("2025-10-01T12:00:00Z", now)).toMatch(/2025/);
  });
  test("a clock slightly ahead never shows a negative time", () => {
    expect(relativeTime(new Date(now.getTime() + 5000).toISOString(), now)).toBe("Just now");
  });
});

describe("badgeText and safeNotificationLink", () => {
  test("caps the badge at 99+", () => {
    expect(badgeText(7)).toBe("7");
    expect(badgeText(99)).toBe("99");
    expect(badgeText(150)).toBe("99+");
  });
  test("only follows in-app dashboard links", () => {
    expect(safeNotificationLink("/dashboard/chat/abc")).toBe("/dashboard/chat/abc");
    expect(safeNotificationLink("https://evil.test")).toBe("/dashboard/notifications");
    expect(safeNotificationLink("//evil.test/dashboard")).toBe("/dashboard/notifications");
    expect(safeNotificationLink(null)).toBe("/dashboard/notifications");
  });
});
