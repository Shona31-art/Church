import { describe, expect, test } from "vitest";
import { localInputToUtcIso, utcIsoToLocalInput, todayInAppZone, formatDate, formatMoney } from "@/lib/format";
import { assignableRoles, can, canEditMemberRole } from "@/lib/permissions";
import { enabledModules, resolveAccountStatus, daysUntil } from "@/lib/subscription";
import { activeHref, buildNavigation } from "@/lib/navigation";
import { buildQuery, likePattern, pageFrom } from "@/lib/list";

describe("timezone handling (server runs in UTC, church is in SAST)", () => {
  test("a 09:00 local event is stored as 07:00 UTC", () => {
    expect(localInputToUtcIso("2026-10-05T09:00", "Africa/Johannesburg")).toBe("2026-10-05T07:00:00.000Z");
  });

  test("round-trips back to the same local input for editing", () => {
    expect(utcIsoToLocalInput("2026-10-05T07:00:00.000Z", "Africa/Johannesburg")).toBe("2026-10-05T09:00");
  });

  test("handles daylight-saving zones", () => {
    expect(localInputToUtcIso("2026-07-01T09:00", "Europe/London")).toBe("2026-07-01T08:00:00.000Z");
    expect(localInputToUtcIso("2026-12-01T09:00", "Europe/London")).toBe("2026-12-01T09:00:00.000Z");
  });

  test("rejects malformed and impossible dates", () => {
    expect(localInputToUtcIso("2026-02-31T09:00")).toBeNull();
    expect(localInputToUtcIso("tomorrow")).toBeNull();
  });

  test("'today' follows the church's clock, not UTC", () => {
    // 23:30 UTC on 4 Oct is already 5 Oct in Johannesburg.
    expect(todayInAppZone(new Date("2026-10-04T23:30:00Z"))).toBe("2026-10-05");
  });

  test("calendar dates never shift a day", () => {
    expect(formatDate("2026-10-05", { weekday: undefined })).toContain("5");
  });

  test("money is shown in rand", () => {
    expect(formatMoney(125000)).toMatch(/R\s?1\s?250[,.]00/);
  });
});

describe("permissions", () => {
  test("pastors can't grant church admin; church admins can", () => {
    expect(assignableRoles("pastor")).not.toContain("church_admin");
    expect(assignableRoles("church_admin")).toContain("church_admin");
    expect(assignableRoles("member")).toEqual([]);
  });

  test("nobody edits their own role; pastors can't edit church admins", () => {
    expect(canEditMemberRole({ id: "a", role: "church_admin" }, { id: "a", role: "church_admin" })).toBe(false);
    expect(canEditMemberRole({ id: "p", role: "pastor" }, { id: "x", role: "church_admin" })).toBe(false);
    expect(canEditMemberRole({ id: "p", role: "pastor" }, { id: "x", role: "member" })).toBe(true);
    expect(canEditMemberRole({ id: "m", role: "member" }, { id: "x", role: "member" })).toBe(false);
  });

  test("confidential care is shepherds only; super admins don't get it", () => {
    expect(can("pastor", "pastoralCare")).toBe(true);
    expect(can("department_leader", "pastoralCare")).toBe(false);
    expect(can("super_admin", "pastoralCare")).toBe(false);
  });
});

describe("subscriptions and feature gating", () => {
  const now = new Date("2026-10-03T12:00:00Z");

  test("an expired trial is suspended even if the stored status says trial", () => {
    expect(resolveAccountStatus({ plan_key: "free_trial", status: "trial", trial_expires_at: "2026-10-01T00:00:00Z" }, now)).toBe("suspended");
  });

  test("a grace period that has run out is suspended", () => {
    expect(resolveAccountStatus({ plan_key: "basic", status: "grace", grace_period_end: "2026-10-02T00:00:00Z" }, now)).toBe("suspended");
    expect(resolveAccountStatus({ plan_key: "basic", status: "grace", grace_period_end: "2026-10-09T00:00:00Z" }, now)).toBe("grace");
  });

  test("lifetime access overrides everything", () => {
    expect(resolveAccountStatus({ plan_key: "basic", status: "suspended", is_lifetime: true }, now)).toBe("active");
  });

  test("module overrides win over the plan in both directions", () => {
    const modules = enabledModules(["members", "calendar"], [
      { module_key: "calendar", enabled: false },
      { module_key: "service_planner", enabled: true },
      { module_key: "not_a_module", enabled: true },
    ]);
    expect([...modules].sort()).toEqual(["members", "service_planner"]);
  });

  test("days left rounds up and never goes negative", () => {
    expect(daysUntil("2026-10-04T00:00:00Z", now)).toBe(1);
    expect(daysUntil("2026-09-01T00:00:00Z", now)).toBe(0);
  });
});

describe("navigation", () => {
  const all = new Set(["members", "announcements", "calendar", "pastoral_care", "giving", "support", "ai_poster"]);

  test("members don't see admin or pastoral items", () => {
    const hrefs = buildNavigation("member", all).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).not.toContain("/dashboard/members");
    expect(hrefs).not.toContain("/dashboard/pastoral-care");
    expect(hrefs).not.toContain("/dashboard/billing");
    expect(hrefs).toContain("/dashboard/announcements");
  });

  test("modules not on the plan are hidden", () => {
    const hrefs = buildNavigation("church_admin", new Set(["members"])).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("/dashboard/members");
    expect(hrefs).not.toContain("/dashboard/calendar");
  });

  test("super admins get the platform menu only", () => {
    const groups = buildNavigation("super_admin", all);
    expect(groups.map((g) => g.label)).toEqual(["Platform"]);
  });

  test("the most specific menu item is highlighted", () => {
    const groups = buildNavigation("church_admin", all);
    expect(activeHref("/dashboard/giving/report", groups)).toBe("/dashboard/giving/report");
    expect(activeHref("/dashboard/members/123/edit", groups)).toBe("/dashboard/members");
    expect(activeHref("/dashboard", groups)).toBe("/dashboard");
    // Reading plans live inside Bible.
    expect(activeHref("/dashboard/reading-plans/abc", buildNavigation("member", new Set(["bible", "reading_plans"])))).toBe("/dashboard/bible");
  });
});

describe("list helpers", () => {
  test("page numbers are parsed defensively", () => {
    expect(pageFrom("3")).toBe(3);
    expect(pageFrom("-1")).toBe(0);
    expect(pageFrom("abc")).toBe(0);
    expect(pageFrom(undefined)).toBe(0);
  });

  test("query strings drop empty filters and page 0", () => {
    expect(buildQuery({ q: "ann", role: "", page: 0 })).toBe("?q=ann");
  });

  test("search terms can't inject LIKE wildcards", () => {
    expect(likePattern("50%_off")).toBe("%50\\%\\_off%");
  });
});
