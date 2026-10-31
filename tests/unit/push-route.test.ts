import { beforeEach, describe, expect, test, vi } from "vitest";

// POST /api/notifications/push — the Supabase Database Webhook target.
// lib/push is mocked: these tests cover the route's checks, not Web Push itself.
const sendPushToUser = vi.fn(async () => 1);
vi.mock("@/lib/push", () => ({ pushConfigured: () => true, sendPushToUser }));
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

  test("sends the notification to its owner's devices, grouped by chat", async () => {
    const res = await call({ type: "INSERT", table: "notifications", schema: "public", record, old_record: null });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1, alertSentToMake: false });
    expect(sendPushToUser).toHaveBeenCalledWith(record.user_id, "messages", {
      title: "Alice",
      body: "Sent you a message",
      link: "/dashboard/chat/abc",
      tag: "chat:abc",
    });
  });
});
