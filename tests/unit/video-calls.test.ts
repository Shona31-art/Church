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

describe("WhatsApp-style calls", () => {
  test("an unanswered two-person call lapses after a minute; group and answered calls don't", async () => {
    const { isLiveCall } = await import("@/lib/video-call-rules");
    const now = new Date("2026-11-02T10:00:00Z");
    const base = { ended_at: null, expires_at: "2026-11-02T12:00:00Z" };
    expect(isLiveCall({ ...base, started_at: "2026-11-02T09:59:30Z", connected_at: null }, true, now)).toBe(true);
    expect(isLiveCall({ ...base, started_at: "2026-11-02T09:58:30Z", connected_at: null }, true, now)).toBe(false);
    expect(isLiveCall({ ...base, started_at: "2026-11-02T09:30:00Z", connected_at: "2026-11-02T09:30:10Z" }, true, now)).toBe(true);
    expect(isLiveCall({ ...base, started_at: "2026-11-02T09:30:00Z", connected_at: null }, false, now)).toBe(true);
  });

  test("a group call nobody is in any more stops showing Join (calls_v5.sql)", async () => {
    const { isLiveCall } = await import("@/lib/video-call-rules");
    const now = new Date("2026-11-02T10:00:00Z");
    const base = { ended_at: null, expires_at: "2026-11-02T12:00:00Z", connected_at: null };
    // Just started: time to join.
    expect(isLiveCall({ ...base, started_at: "2026-11-02T09:59:30Z", presence: {} }, false, now)).toBe(true);
    // Someone's phone checked in 30 s ago.
    expect(isLiveCall({ ...base, started_at: "2026-11-02T09:30:00Z", presence: { a: "2026-11-02T09:59:30Z" } }, false, now)).toBe(true);
    // Everyone gone (or their phones stopped checking in).
    expect(isLiveCall({ ...base, started_at: "2026-11-02T09:30:00Z", presence: {} }, false, now)).toBe(false);
    expect(isLiveCall({ ...base, started_at: "2026-11-02T09:30:00Z", presence: { a: "2026-11-02T09:55:00Z" } }, false, now)).toBe(false);
  });

  test("call history lines become call bubbles", async () => {
    const { parseCallLog, humanCallLength } = await import("@/lib/chat");
    expect(parseCallLog("📞 Voice call · 0:10")).toEqual({ kind: "voice", missed: false, length: "10 secs" });
    expect(parseCallLog("📹 Missed video call")).toEqual({ kind: "video", missed: true, length: null });
    expect(parseCallLog("📞 I started a voice call — tap “Join call” at the top of this chat.")).toBeNull();
    expect(parseCallLog("hello")).toBeNull();
    expect(humanCallLength("1:05")).toBe("1 min");
    expect(humanCallLength("12:40")).toBe("12 mins");
    expect(humanCallLength("1:02:10")).toBe("1 hr 2 mins");
  });
});
