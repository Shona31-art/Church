import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createMeetingToken, createRoom, deleteRoom, isVideoConfigured } from "@/lib/daily";

const calls: { url: string; init: RequestInit }[] = [];
let reply: { status: number; body: unknown } = { status: 200, body: {} };

beforeEach(() => {
  calls.length = 0;
  process.env.DAILY_API_KEY = "test-key";
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DAILY_API_KEY;
});

describe("Daily.co client", () => {
  test("is only switched on with an API key", () => {
    expect(isVideoConfigured()).toBe(true);
    delete process.env.DAILY_API_KEY;
    expect(isVideoConfigured()).toBe(false);
  });

  test("rooms are private, close themselves, and can't be recorded", async () => {
    reply = { status: 200, body: { name: "grace-abc", url: "https://church.daily.co/grace-abc" } };
    const expiresAt = new Date("2026-11-02T13:00:00Z");
    expect(await createRoom({ name: "grace-abc", expiresAt, maxParticipants: 2 })).toEqual({ name: "grace-abc", url: "https://church.daily.co/grace-abc" });
    const body = JSON.parse(String(calls[0].init.body));
    expect(calls[0].url).toBe("https://api.daily.co/v1/rooms");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    expect(body).toMatchObject({ name: "grace-abc", privacy: "private", properties: { exp: expiresAt.getTime() / 1000, eject_at_room_exp: true, max_participants: 2, enable_recording: false } });
  });

  test("a voice call starts with cameras off", async () => {
    reply = { status: 200, body: { name: "grace-v", url: "https://church.daily.co/grace-v" } };
    await createRoom({ name: "grace-v", expiresAt: new Date(), maxParticipants: 2, audioOnly: true });
    expect(JSON.parse(String(calls[0].init.body)).properties.start_video_off).toBe(true);
  });

  test("meeting tokens are for one room and one person", async () => {
    reply = { status: 200, body: { token: "tok" } };
    expect(await createMeetingToken({ roomName: "grace-abc", userId: "u1", userName: "Ada", expiresAt: new Date("2026-11-02T13:00:00Z"), isOwner: false })).toBe("tok");
    expect(JSON.parse(String(calls[0].init.body)).properties).toMatchObject({ room_name: "grace-abc", user_id: "u1", user_name: "Ada", is_owner: false });
  });

  test("errors surface, except deleting a room that's already gone", async () => {
    reply = { status: 500, body: { error: "boom" } };
    await expect(createRoom({ name: "x", expiresAt: new Date(), maxParticipants: 2 })).rejects.toThrow(/500/);
    reply = { status: 404, body: { error: "not-found" } };
    await expect(deleteRoom("gone")).resolves.toBeUndefined();
    expect(calls.at(-1)?.init.method).toBe("DELETE");
  });
});
