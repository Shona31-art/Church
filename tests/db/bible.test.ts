import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// bible_reader_v2.sql — highlights, plus the privacy of bookmarks and notes:
// owner only, with no bypass for pastors, church admins or super admins.

const CHURCH = "00000000-0000-0000-0000-0000000000b1";
const ALICE = "10000000-0000-0000-0000-0000000000b1";
const BOB = "10000000-0000-0000-0000-0000000000b2";
const PASTOR = "10000000-0000-0000-0000-0000000000b3";
const ADMIN = "10000000-0000-0000-0000-0000000000b4";
const SUPER = "10000000-0000-0000-0000-0000000000b5";

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

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'Church');
    insert into auth.users (id) values ('${ALICE}'), ('${BOB}'), ('${PASTOR}'), ('${ADMIN}'), ('${SUPER}');
    insert into app_users (id, church_id, name, email, role, status) values
      ('${ALICE}', '${CHURCH}', 'Alice', 'al@b.test', 'member', 'active'),
      ('${BOB}', '${CHURCH}', 'Bob', 'bo@b.test', 'member', 'active'),
      ('${PASTOR}', '${CHURCH}', 'Pastor', 'p@b.test', 'pastor', 'active'),
      ('${ADMIN}', '${CHURCH}', 'Admin', 'a@b.test', 'church_admin', 'active'),
      ('${SUPER}', null, 'Super', 's@b.test', 'super_admin', 'active');
  `);
  await asUser(db, ALICE, async () => {
    await rows(`insert into bible_highlights (user_id, book, chapter, verse, color) values ($1, 'John', 3, 16, 'yellow')`, [ALICE]);
    await rows(`insert into bible_bookmarks (user_id, book, chapter, verse) values ($1, 'John', 3, 16)`, [ALICE]);
    await rows(`insert into bible_notes (user_id, book, chapter, verse, note) values ($1, 'John', 3, 16, 'Private thought')`, [ALICE]);
  });
}, 120_000);

describe("highlights", () => {
  test("the owner sees and changes their own highlight", async () => {
    expect(await asUser(db, ALICE, () => rows(`select verse, color from bible_highlights`))).toEqual([{ verse: 16, color: "yellow" }]);
    await asUser(db, ALICE, () => rows(`update bible_highlights set color = 'green' where verse = 16`));
    expect(await asUser(db, ALICE, () => rows(`select color from bible_highlights`))).toEqual([{ color: "green" }]);
  });

  test.each([
    ["another member", BOB],
    ["a pastor", PASTOR],
    ["a church admin", ADMIN],
    ["the super admin", SUPER],
  ])("%s can't see, change or delete it", async (_, user) => {
    expect(await asUser(db, user, () => rows(`select id from bible_highlights`))).toEqual([]);
    await asUser(db, user, () => rows(`update bible_highlights set color = 'pink'`));
    await asUser(db, user, () => rows(`delete from bible_highlights`));
    expect(await rows(`select color from bible_highlights where user_id = $1`, [ALICE])).toEqual([{ color: "green" }]);
  });

  test("nobody can create a highlight for someone else", async () => {
    expect(await attempt(BOB, `insert into bible_highlights (user_id, book, chapter, verse, color) values ($1, 'John', 1, 1, 'blue')`, [ALICE])).toMatch(
      /row-level security/,
    );
    expect(await attempt(ADMIN, `insert into bible_highlights (user_id, book, chapter, verse, color) values ($1, 'John', 1, 1, 'blue')`, [ALICE])).toMatch(
      /row-level security/,
    );
  });

  test("nobody can hand their highlight to someone else", async () => {
    await asUser(db, ALICE, () => rows(`insert into bible_highlights (user_id, book, chapter, verse, color) values ($1, 'Ruth', 1, 16, 'blue')`, [ALICE]));
    expect(await attempt(ALICE, `update bible_highlights set user_id = $1 where book = 'Ruth'`, [BOB])).toMatch(/row-level security/);
  });

  test("only the five colours, one per verse, sensible references", async () => {
    expect(await attempt(ALICE, `insert into bible_highlights (user_id, book, chapter, verse, color) values ($1, 'John', 1, 1, 'red')`, [ALICE])).toMatch(/check/);
    expect(await attempt(ALICE, `insert into bible_highlights (user_id, book, chapter, verse, color) values ($1, 'John', 3, 16, 'blue')`, [ALICE])).toMatch(/duplicate|unique/);
    expect(await attempt(ALICE, `insert into bible_highlights (user_id, book, chapter, verse, color) values ($1, 'John', 0, 1, 'blue')`, [ALICE])).toMatch(/check/);
  });

  test("deleting a member deletes their highlights (POPIA erasure)", async () => {
    await db.exec(`
      insert into auth.users (id) values ('10000000-0000-0000-0000-0000000000b9');
      insert into app_users (id, church_id, name, email, role, status) values ('10000000-0000-0000-0000-0000000000b9', '${CHURCH}', 'Gone', 'g@b.test', 'member', 'active');
      insert into bible_highlights (user_id, book, chapter, verse, color) values ('10000000-0000-0000-0000-0000000000b9', 'Acts', 2, 1, 'pink');
      delete from app_users where id = '10000000-0000-0000-0000-0000000000b9';
    `);
    expect(await rows(`select id from bible_highlights where user_id = '10000000-0000-0000-0000-0000000000b9'`)).toEqual([]);
  });
});

describe("bookmarks and notes stay private", () => {
  test.each([
    ["another member", BOB],
    ["a pastor", PASTOR],
    ["a church admin", ADMIN],
    ["the super admin", SUPER],
  ])("%s sees none of Alice's", async (_, user) => {
    expect(await asUser(db, user, () => rows(`select id from bible_bookmarks`))).toEqual([]);
    expect(await asUser(db, user, () => rows(`select id from bible_notes`))).toEqual([]);
  });

  test("notes are limited to 2,000 characters", async () => {
    expect(await attempt(ALICE, `insert into bible_notes (user_id, book, chapter, note) values ($1, 'John', 1, repeat('x', 2001))`, [ALICE])).toMatch(/check/);
    expect(await attempt(ALICE, `insert into bible_notes (user_id, book, chapter, note) values ($1, 'John', 1, '')`, [ALICE])).toMatch(/check/);
  });

  test("bookmarks have updated_at", async () => {
    expect(await asUser(db, ALICE, () => rows(`select updated_at is not null as ok from bible_bookmarks`))).toEqual([{ ok: true }]);
  });
});
