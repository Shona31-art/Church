import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// Sermon video uploads (sermon_video.sql, migration #46).

const CHURCH = "00000000-0000-0000-0000-00000000000a";
const PASTOR = "10000000-0000-0000-0000-000000000001";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'Church');
    insert into auth.users (id) values ('${PASTOR}');
    insert into app_users (id, church_id, name, email, role) values ('${PASTOR}', '${CHURCH}', 'Pastor', 'p@x.test', 'pastor');
  `);
}, 120_000);

describe("sermon-video bucket", () => {
  test("is public for watching, 1 GB per file, video types only", async () => {
    const [bucket] = await rows(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'sermon-video'`);
    expect(bucket.public).toBe(true);
    expect(Number(bucket.file_size_limit)).toBe(1024 * 1024 * 1024);
    expect(bucket.allowed_mime_types.sort()).toEqual(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"]);
  });

  test("can't be uploaded to directly from the browser — only through the server's one-time links", async () => {
    await expect(
      asUser(db, PASTOR, () => rows(`insert into storage.objects (bucket_id, name, owner) values ('sermon-video', $1, $2)`, [`${CHURCH}/direct.mp4`, PASTOR]))
    ).rejects.toThrow(/row-level security/);
  });
});
