import { describe, expect, test, vi } from "vitest";
import { bookingCallWindow, isCallOpen, newRoomName } from "@/lib/video-call-rules";

describe("video call rules", () => {
  test("an appointment's call opens on its day and the day after", () => {
    expect(bookingCallWindow("2026-11-10", "2026-11-09")).toBe("early");
    expect(bookingCallWindow("2026-11-10", "2026-11-10")).toBe("open");
    expect(bookingCallWindow("2026-11-10", "2026-11-11")).toBe("open");
    expect(bookingCallWindow("2026-11-10", "2026-11-12")).toBe("past");
    expect(bookingCallWindow("2026-12-31", "2027-01-01")).toBe("open");
  });

  test("a call is open until it's ended or runs out", () => {
    const now = new Date("2026-11-02T10:00:00Z");
    expect(isCallOpen({ ended_at: null, expires_at: "2026-11-02T12:00:00Z" }, now)).toBe(true);
    expect(isCallOpen({ ended_at: null, expires_at: "2026-11-02T09:59:00Z" }, now)).toBe(false);
    expect(isCallOpen({ ended_at: "2026-11-02T09:00:00Z", expires_at: "2026-11-02T12:00:00Z" }, now)).toBe(false);
  });

  test("room names are safe for Daily: letters, numbers and dashes", () => {
    expect(newRoomName("3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toBe("grace-3f2504e04f8911d39a0c0305e82c3301");
    expect(newRoomName()).toMatch(/^grace-[a-z0-9]{32}$/);
  });
});

describe("built-in calls", () => {
  test("the call's size limit is stored with it", async () => {
    const { callCapacity, MAX_PARTICIPANTS } = await import("@/lib/video-call-rules");
    expect(callCapacity("builtin:2")).toBe(2);
    expect(callCapacity("builtin:6")).toBe(6);
    expect(callCapacity("https://x.daily.co/old")).toBe(MAX_PARTICIPANTS.group);
    expect(callCapacity(null)).toBe(MAX_PARTICIPANTS.group);
  });

  test("exactly one side of each pair starts the connection", async () => {
    const { shouldInitiate } = await import("@/lib/video-call-rules");
    expect(shouldInitiate("a", "b")).toBe(true);
    expect(shouldInitiate("b", "a")).toBe(false);
  });

  test("relay servers are only added when fully set up", async () => {
    const { iceServersFrom } = await import("@/lib/video-call-rules");
    const env = { TURN_URLS: "turn:relay.example:80, turns:relay.example:443, http://nope", TURN_USERNAME: "u", TURN_CREDENTIAL: "p" };
    expect(iceServersFrom(env)).toEqual([
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
      { urls: ["turn:relay.example:80", "turns:relay.example:443"], username: "u", credential: "p" },
    ]);
    expect(iceServersFrom({ ...env, TURN_CREDENTIAL: "" })).toHaveLength(1);
  });

});
