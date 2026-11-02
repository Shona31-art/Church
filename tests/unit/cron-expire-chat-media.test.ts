import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// A fake Supabase admin client: records what the route removes and updates.
const calls = { removed: [] as string[][], updatedIds: [] as string[][], notificationCutoffs: [] as string[] };
let notificationDeleteError: { message: string } | null = null;
let due: { id: string; media_path: string }[] = [];
let removeError: { message: string } | null = null;
let disappearedFiles: { media_path: string }[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const query = {
      select: () => query,
      not: () => query,
      is: () => query,
      lt: () => query,
      order: () => query,
      limit: async () => {
        const batch = due;
        due = [];
        return { data: batch, error: null };
      },
      // notifications clean-up: delete({ count }).lt("created_at", cutoff)
      delete: () => ({
        lt: async (_column: string, cutoff: string) => {
          calls.notificationCutoffs.push(cutoff);
          return notificationDeleteError ? { error: notificationDeleteError, count: null } : { error: null, count: 3 };
        },
      }),
      update: () => ({
        in: async (_column: string, ids: string[]) => {
          calls.updatedIds.push(ids);
          return { error: null };
        },
      }),
    };
    return {
      from: () => query,
      // Disappearing messages (chat_v4.sql): one disappeared photo to remove.
      rpc: async () => ({ data: disappearedFiles.splice(0), error: null }),
      storage: {
        from: () => ({
          remove: async (paths: string[]) => {
            calls.removed.push(paths);
            return { error: removeError };
          },
        }),
      },
    };
  },
}));

vi.mock("@/lib/subscription-billing", () => ({ endCancelledSubscriptions: async () => 0 }));

const { GET } = await import("@/app/api/cron/expire-chat-media/route");
const call = (auth?: string) => GET(new Request("http://localhost/api/cron/expire-chat-media", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret";
  calls.removed = [];
  calls.updatedIds = [];
  calls.notificationCutoffs = [];
  removeError = null;
  notificationDeleteError = null;
  disappearedFiles = [{ media_path: "church/chan/user/gone.webp" }];
  due = [
    { id: "m1", media_path: "church/chan/user/a.m4a" },
    { id: "m2", media_path: "church/chan/user/b.webm" },
  ];
});
afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("expire-chat-media cron", () => {
  test("refuses calls without the right secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(calls.removed).toHaveLength(0);
  });

  test("refuses everything when CRON_SECRET isn't set", async () => {
    delete process.env.CRON_SECRET;
    expect((await call("Bearer ")).status).toBe(401);
  });

  test("deletes due files, then marks those messages expired", async () => {
    const response = await call("Bearer s3cret");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ expired: 2, notificationsDeleted: 3, subscriptionsEnded: 0, disappearedFiles: 1 });
    // Disappeared messages' files first, then the 90-day media clean-up.
    expect(calls.removed).toEqual([["church/chan/user/gone.webp"], ["church/chan/user/a.m4a", "church/chan/user/b.webm"]]);
    expect(calls.updatedIds).toEqual([["m1", "m2"]]);
  });

  test("if Storage fails, messages are left alone to retry tomorrow", async () => {
    removeError = { message: "storage down" };
    const response = await call("Bearer s3cret");
    expect(response.status).toBe(500);
    expect(calls.updatedIds).toHaveLength(0);
  });

  test("deletes notifications older than 90 days, and a failure there doesn't fail the run", async () => {
    await call("Bearer s3cret");
    const days = (Date.now() - new Date(calls.notificationCutoffs[0]).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(90);

    notificationDeleteError = { message: "db down" };
    const response = await call("Bearer s3cret");
    expect(response.status).toBe(200);
    expect((await response.json()).notificationsDeleted).toBe(0);
  });
});
