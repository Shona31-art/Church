import { beforeEach, describe, expect, test, vi } from "vitest";

// POST /api/notifications/push — the Supabase Database Webhook target.
// lib/push is mocked: these tests cover the route's checks, not Web Push itself.
const sendPushToUser = vi.fn(async () => 1);
vi.mock("@/lib/push", () => ({ pushConfigured: () => true, sendPushToUser, unreadCountFor: vi.fn(async () => 2) }));
vi.mock("@/lib/alert-delivery", () => ({ deliverAlert: vi.fn(async () => ({ sent: false })), makeConfigured: () => false }));
const { POST } = await import("@/app/api/notifications/push/route");

const SECRET = "test-secret-123";
const record = {
  id: "00000000-0000-0000-0000-000000000001",
  user_id: "1b4e28ba-2fa1-41d2-883f-0016d3cca427", // a real v4 UUID: Zod 4 checks the version digit
  category: "messages",
  type: "chat.message",
  title: "Alice",
  body: "Sent you a message",
  link: "/dashboard/chat/abc",
  group_key: "chat:abc",
};
const call = (body: unknown, secret: string | null = SECRET) =>
  POST(
    new Request("http://localhost/api/notifications/push", {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret === null ? {} : { "x-webhook-secret": secret }) },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  process.env.NOTIFICATIONS_WEBHOOK_SECRET = SECRET;
  sendPushToUser.mockClear();
});

describe("POST /api/notifications/push", () => {
  test("rejects a missing or wrong secret, and refuses everything if the secret isn't configured", async () => {
    expect((await call({ type: "INSERT", table: "notifications", record }, null)).status).toBe(401);
    expect((await call({ type: "INSERT", table: "notifications", record }, "wrong")).status).toBe(401);
    delete process.env.NOTIFICATIONS_WEBHOOK_SECRET;
    expect((await call({ type: "INSERT", table: "notifications", record }, "")).status).toBe(401);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  test("rejects anything that isn't a notifications insert", async () => {
    expect((await call({ type: "UPDATE", table: "notifications", record })).status).toBe(400);
    expect((await call({ type: "INSERT", table: "app_users", record })).status).toBe(400);
    expect((await call({ type: "INSERT", table: "notifications", record: { ...record, user_id: "nope" } })).status).toBe(400);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  test("sends the notification to its owner's devices, grouped by chat, with Mark as read and the icon badge", async () => {
    const res = await call({ type: "INSERT", table: "notifications", schema: "public", record, old_record: null });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1, alertSentToMake: false });
    expect(sendPushToUser).toHaveBeenCalledWith(record.user_id, "messages", {
      title: "Alice",
      body: "Sent you a message",
      link: "/dashboard/chat/abc",
      tag: "chat:abc",
      messageId: record.id,
      badge: 2,
    });
  });

  test("another message in the same chat pops up again, WhatsApp-style; other updates don't", async () => {
    const more = { ...record, count: 3, body: "See you at 6", read_at: null };
    expect((await call({ type: "UPDATE", table: "notifications", record: more, old_record: { ...record, count: 2 } })).status).toBe(200);
    expect(sendPushToUser).toHaveBeenCalledWith(record.user_id, "messages", expect.objectContaining({ title: "Alice (3 messages)", body: "See you at 6", tag: "chat:abc" }));
    sendPushToUser.mockClear();
    // Marked read, or a preview replaced without a new message: nothing.
    await call({ type: "UPDATE", table: "notifications", record: { ...more, read_at: "2026-11-02T10:00:00Z" }, old_record: { ...record, count: 3 } });
    await call({ type: "UPDATE", table: "notifications", record: more, old_record: { ...record, count: 3 } });
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  test("an incoming video call is sent as a call (rings, delivered fast or not at all)", async () => {
    const ring = { ...record, type: "video_call", title: "Alice is calling you", body: "Video call — tap to join", link: "/dashboard/calls/1b4e28ba-2fa1-41d2-883f-0016d3cca427", group_key: null };
    expect((await call({ type: "INSERT", table: "notifications", record: ring })).status).toBe(200);
    expect(sendPushToUser).toHaveBeenCalledWith(record.user_id, "messages", {
      title: "Alice",
      body: "Incoming video call",
      link: ring.link,
      tag: `call:${ring.link}`,
      call: true,
      badge: 2,
    });
  });
});
