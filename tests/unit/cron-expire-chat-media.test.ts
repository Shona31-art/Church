import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// A fake Supabase admin client: records what the route removes and updates.
const calls = { removed: [] as string[][], updatedIds: [] as string[][] };
let due: { id: string; media_path: string }[] = [];
let removeError: { message: string } | null = null;

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
      update: () => ({
        in: async (_column: string, ids: string[]) => {
          calls.updatedIds.push(ids);
          return { error: null };
        },
      }),
    };
    return {
      from: () => query,
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

const { GET } = await import("@/app/api/cron/expire-chat-media/route");
const call = (auth?: string) => GET(new Request("http://localhost/api/cron/expire-chat-media", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret";
  calls.removed = [];
  calls.updatedIds = [];
  removeError = null;
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
    expect(await response.json()).toEqual({ expired: 2 });
    expect(calls.removed).toEqual([["church/chan/user/a.m4a", "church/chan/user/b.webm"]]);
    expect(calls.updatedIds).toEqual([["m1", "m2"]]);
  });

  test("if Storage fails, messages are left alone to retry tomorrow", async () => {
    removeError = { message: "storage down" };
    const response = await call("Bearer s3cret");
    expect(response.status).toBe(500);
    expect(calls.updatedIds).toHaveLength(0);
  });
});
