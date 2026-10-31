import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { absoluteLink, alertText, makePayload, toWhatsAppNumber } from "@/lib/alert-delivery";

describe("WhatsApp numbers", () => {
  test("South African local numbers become +27", () => {
    expect(toWhatsAppNumber("082 555 0000")).toBe("+27825550000");
    expect(toWhatsAppNumber("+27 82 555 0000")).toBe("+27825550000");
    expect(toWhatsAppNumber("0027825550000")).toBe("+27825550000");
  });
  test("junk isn't sent", () => {
    expect(toWhatsAppNumber(null)).toBeNull();
    expect(toWhatsAppNumber("call me")).toBeNull();
    expect(toWhatsAppNumber("123")).toBeNull();
  });
});

describe("alert messages", () => {
  test("links open in the app, never elsewhere", () => {
    expect(absoluteLink("/dashboard/booking/1", "https://grace.app/")).toBe("https://grace.app/dashboard/booking/1");
    expect(absoluteLink("//evil.com", "https://grace.app")).toBe("https://grace.app/dashboard/notifications");
  });
  test("the message includes the title, details and link", () => {
    const msg = { title: "New booking request", body: "Thandi · Counseling", link: "/dashboard/booking/1" };
    expect(alertText(msg, "KAMI", "https://x/y")).toBe("*New booking request* — KAMI\nThandi · Counseling\nOpen: https://x/y");
  });
});

describe("Make payload", () => {
  const msg = { title: "New prayer request", body: "Thandi: healing", link: "/dashboard/prayer-board/wall" };
  const user = { name: "Pastor P", phone: "082 555 0000" };
  test("on by default, with a ready-made message and no email", () => {
    const p = makePayload(user, null, msg, "KAMI", "https://g/x");
    expect(p.whatsapp_to).toBe("+27825550000");
    expect(p.whatsapp_text).toContain("Open: https://g/x");
    expect(JSON.stringify(p)).not.toContain("email");
  });
  test("left empty when the pastor switched WhatsApp off", () => {
    expect(makePayload(user, { whatsapp_alerts: false }, msg, null, "https://g/x").whatsapp_to).toBe("");
  });
});
