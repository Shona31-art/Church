import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// poster_editor.sql — editable designs on posters, the church photo library,
// and the locked-down poster-assets bucket.

const CHURCH = "00000000-0000-0000-0000-0000000000c1";
const OTHER = "00000000-0000-0000-0000-0000000000c2";
const ADMIN = "10000000-0000-0000-0000-0000000000c1";
const PASTOR = "10000000-0000-0000-0000-0000000000c2";
const LEADER = "10000000-0000-0000-0000-0000000000c3";
const LEADER2 = "10000000-0000-0000-0000-0000000000c4";
const MEMBER = "10000000-0000-0000-0000-0000000000c5";
const OUTSIDER = "10000000-0000-0000-0000-0000000000c6"; // leader in another church

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
async function attempt(user: string, sql: string, params: unknown[] = []) {
  try {
    await asUser(db, user, () => rows(sql, params));
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

const design = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ version: 1, size: "square", width: 1080, height: 1080, background: { color: "#ffffff" }, elements: [], ...extra });
const insertPoster = (user: string, d: string | null, more = "") =>
  attempt(
    user,
    `insert into posters (church_id, created_by, event_title, title, design, design_version, width, height ${more ? ", thumbnail_path" : ""})
     values ($1, $2, 'Worship night', 'Worship night', $3::jsonb, 1, 1080, 1080 ${more ? ", $4" : ""})`,
    more ? [CHURCH, user, d, more] : [CHURCH, user, d],
  );
const insertAsset = (user: string, church: string, path: string) =>
  attempt(user, `insert into poster_assets (church_id, uploaded_by, storage_path, width, height, bytes) values ($1, $2, $3, 800, 800, 120000)`, [church, user, path]);

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'Church'), ('${OTHER}', 'Other');
    insert into auth.users (id) values ('${ADMIN}'), ('${PASTOR}'), ('${LEADER}'), ('${LEADER2}'), ('${MEMBER}'), ('${OUTSIDER}');
    insert into app_users (id, church_id, name, email, role, status) values
      ('${ADMIN}', '${CHURCH}', 'Admin', 'a@c.test', 'church_admin', 'active'),
      ('${PASTOR}', '${CHURCH}', 'Pastor', 'p@c.test', 'pastor', 'active'),
      ('${LEADER}', '${CHURCH}', 'Leader', 'l@c.test', 'department_leader', 'active'),
      ('${LEADER2}', '${CHURCH}', 'Leader2', 'l2@c.test', 'department_leader', 'active'),
      ('${MEMBER}', '${CHURCH}', 'Member', 'm@c.test', 'member', 'active'),
      ('${OUTSIDER}', '${OTHER}', 'Out', 'o@c.test', 'department_leader', 'active');
  `);
}, 120_000);

describe("posters with editable designs", () => {
  test("a poster maker saves a design; members can view it but not create one", async () => {
    expect(await insertPoster(LEADER, design())).toBeNull();
    expect(await insertPoster(MEMBER, design())).toMatch(/row-level security/);
    expect((await asUser(db, MEMBER, () => rows(`select title from posters`))).map((r) => r.title)).toContain("Worship night");
  });

  test("oversized, unversioned or mis-sized designs are refused", async () => {
    const huge = design({ elements: [{ id: "t", type: "text", text: "x".repeat(210_000) }] });
    expect(await insertPoster(LEADER, huge)).toMatch(/posters_design_shape/);
    expect(
      await attempt(LEADER, `insert into posters (church_id, created_by, event_title, design, width, height) values ($1, $2, 'X', $3::jsonb, 1080, 1080)`, [CHURCH, LEADER, design()]),
    ).toMatch(/posters_design_shape/);
    expect(
      await attempt(LEADER, `insert into posters (church_id, created_by, event_title, design, design_version, width, height) values ($1, $2, 'X', $3::jsonb, 1, 99999, 1080)`, [CHURCH, LEADER, design()]),
    ).toMatch(/posters_design_shape/);
  });

  test("a preview image must sit in the church's own folder", async () => {
    expect(await insertPoster(LEADER, design(), `${CHURCH}/thumbs/a.jpg`)).toBeNull();
    expect(await insertPoster(LEADER, design(), `${OTHER}/thumbs/a.jpg`)).toMatch(/posters_thumbnail_path/);
  });

  test("old-style posters without a design still save", async () => {
    expect(await attempt(PASTOR, `insert into posters (church_id, created_by, event_title) values ($1, $2, 'Old style')`, [CHURCH, PASTOR])).toBeNull();
  });
});

describe("the church photo library", () => {
  test("poster makers record uploads in their own folder only", async () => {
    expect(await insertAsset(LEADER, CHURCH, `${CHURCH}/${LEADER}/speaker.webp`)).toBeNull();
    expect(await insertAsset(LEADER, CHURCH, `${CHURCH}/${LEADER2}/sneaky.webp`)).toMatch(/row-level security/);
    expect(await insertAsset(LEADER, OTHER, `${OTHER}/${LEADER}/x.webp`)).toMatch(/row-level security/);
    expect(await insertAsset(MEMBER, CHURCH, `${CHURCH}/${MEMBER}/x.webp`)).toMatch(/row-level security/);
  });

  test("only the church's poster makers can see the library", async () => {
    const seen = async (user: string) => (await asUser(db, user, () => rows(`select storage_path from poster_assets`))).length;
    expect(await seen(LEADER2)).toBe(1);
    expect(await seen(ADMIN)).toBe(1);
    expect(await seen(MEMBER)).toBe(0);
    expect(await seen(OUTSIDER)).toBe(0);
  });

  test("uploaders delete their own; another leader can't; a pastor can", async () => {
    await insertAsset(LEADER2, CHURCH, `${CHURCH}/${LEADER2}/logo.png`);
    await asUser(db, LEADER, () => rows(`delete from poster_assets where uploaded_by = $1`, [LEADER2]));
    expect((await rows(`select count(*)::int as n from poster_assets where uploaded_by = $1`, [LEADER2]))[0].n).toBe(1);
    await asUser(db, PASTOR, () => rows(`delete from poster_assets where uploaded_by = $1`, [LEADER2]));
    expect((await rows(`select count(*)::int as n from poster_assets where uploaded_by = $1`, [LEADER2]))[0].n).toBe(0);
    await asUser(db, LEADER, () => rows(`delete from poster_assets where uploaded_by = $1`, [LEADER]));
    expect((await rows(`select count(*)::int as n from poster_assets where uploaded_by = $1`, [LEADER]))[0].n).toBe(0);
  });

  test("a photo's church, owner and file can't be changed; its label can", async () => {
    await insertAsset(LEADER, CHURCH, `${CHURCH}/${LEADER}/p.webp`);
    expect(await attempt(LEADER, `update poster_assets set label = 'Pastor Thabo' where uploaded_by = $1`, [LEADER])).toBeNull();
    expect(await attempt(LEADER, `update poster_assets set storage_path = $2 where uploaded_by = $1`, [LEADER, `${CHURCH}/${LEADER}/other.webp`])).toMatch(
      /can't be changed/,
    );
    expect(await attempt(PASTOR, `update poster_assets set uploaded_by = $1 where uploaded_by = $2`, [PASTOR, LEADER])).toMatch(/can't be changed/);
  });
});

describe("poster-assets bucket", () => {
  test("is private and can't be read or written from the browser directly", async () => {
    expect(await rows(`select public, file_size_limit::int as limit from storage.buckets where id = 'poster-assets'`)).toEqual([{ public: false, limit: 5242880 }]);
    await db.exec(`insert into storage.objects (bucket_id, name, owner) values ('poster-assets', '${CHURCH}/${LEADER}/existing.webp', '${LEADER}')`);
    expect(
      await attempt(LEADER, `insert into storage.objects (bucket_id, name, owner) values ('poster-assets', $1, $2)`, [`${CHURCH}/${LEADER}/direct.webp`, LEADER]),
    ).toMatch(/row-level security/);
    expect(await asUser(db, LEADER, () => rows(`select name from storage.objects where bucket_id = 'poster-assets'`))).toEqual([]);
    expect(await asUser(db, ADMIN, () => rows(`select name from storage.objects where bucket_id = 'poster-assets'`))).toEqual([]);
  });
});
