import { describe, expect, test } from "vitest";
import { buildNavigation, buildTabBar, hidesTabBar } from "@/lib/navigation";
import { shareFallbackText } from "@/lib/share";
import { MODULE_KEYS } from "@/lib/subscription";

const ALL = new Set<string>(MODULE_KEYS);

describe("phone tab bar", () => {
  test("a member gets Home, Prayer, Chats and Bible", () => {
    expect(buildTabBar(buildNavigation("member", ALL)).map((t) => t.label)).toEqual(["Home", "Prayer", "Chats", "Bible"]);
  });

  test("only what the plan includes, filled from the menu", () => {
    const tabs = buildTabBar(buildNavigation("member", new Set(["bible", "calendar"])));
    expect(tabs[0].href).toBe("/dashboard");
    expect(tabs.map((t) => t.href)).toContain("/dashboard/bible");
    expect(tabs.map((t) => t.href)).toContain("/dashboard/calendar");
    expect(tabs.length).toBeLessThanOrEqual(4);
  });

  test("the platform admin gets platform tabs", () => {
    expect(buildTabBar(buildNavigation("super_admin", ALL)).map((t) => t.href)).toEqual([
      "/dashboard/super-admin",
      "/dashboard/super-admin/churches",
      "/dashboard/super-admin/users",
      "/dashboard/support",
    ]);
  });

  test("hidden in chat threads and the poster editor, shown on the chat list", () => {
    expect(hidesTabBar("/dashboard/chat/7f0c")).toBe(true);
    expect(hidesTabBar("/dashboard/chat")).toBe(false);
    expect(hidesTabBar("/dashboard/chat/channels/new")).toBe(false);
    expect(hidesTabBar("/dashboard/chat/dm/new")).toBe(false);
    expect(hidesTabBar("/dashboard/posters/editor/new")).toBe(true);
    expect(hidesTabBar("/dashboard/prayer-board")).toBe(false);
  });
});

describe("sharing fallback", () => {
  test("copies the text then an absolute link", () => {
    expect(shareFallbackText({ title: "Easter", text: "Sunday 09:00", url: "/dashboard/calendar/1" }, "https://app.example")).toBe(
      "Sunday 09:00\n\nhttps://app.example/dashboard/calendar/1",
    );
    expect(shareFallbackText({ title: "Verse" })).toBe("Verse");
  });
});
