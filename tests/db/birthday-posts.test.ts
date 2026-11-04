import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// record_members.sql: birthday posters are posted "as the church"
// (chat_messages.from_church) — only by the server's morning job, and
// without the usual "new message in General" notification.

const CHURCH = "00000000-0000-0000-0000-0000000000b1";
const ADMIN = "10000000-0000-0000-0000-0000000000b1";
const ALICE = "10000000-0000-0000-0000-0000000000b2";
const GENERAL = "40000000-0000-0000-0000-0000000000b1";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
const as = <T>(who: string | null, sql: string, params: unknown[] = []) => asUser(db, who, () => rows(sql, params)) as Promise<T[]>;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'Church');
    insert into auth.users (id) values ('${ADMIN}'), ('${ALICE}');
    insert into app_users (id, church_id, name, email, role, status) values
      ('${ADMIN}', '${CHURCH}', 'Admin', 'ad@x.test', 'church_admin', 'active'),
      ('${ALICE}', '${CHURCH}', 'Alice', 'al@x.test', 'member', 'active');
    insert into chat_channels (id, church_id, name, is_dm) values ('${GENERAL}', '${CHURCH}', 'General', false);
  `);
}, 120_000);

describe("posts from the church", () => {
  test("members can't post as the church", async () => {
    const [m] = await as<{ from_church: boolean; id: string }>(ALICE, `insert into chat_messages (channel_id, sender_id, content, from_church) values ($1, $2, 'pretend', true) returning id, from_church`, [GENERAL, ALICE]);
    expect(m.from_church).toBe(false);
  });

  test("the morning job posts as the church, without a chat notification", async () => {
    const before = await rows(`select count(*)::int n from notifications where type like 'chat.%'`);
    const [m] = await as<{ from_church: boolean; id: string }>(null, `insert into chat_messages (channel_id, sender_id, content, from_church) values ($1, $2, 'Happy birthday!', true) returning id, from_church`, [GENERAL, ADMIN]);
    expect(m.from_church).toBe(true);
    expect(await rows(`select count(*)::int n from notifications where type like 'chat.%'`)).toEqual(before);
    // …and an edit by a signed-in user can't change it either way.
    await as(ADMIN, `update chat_messages set content = 'Happy birthday!!' where id = $1`, [m.id]);
    expect((await rows(`select from_church from chat_messages where id = $1`, [m.id]))[0].from_church).toBe(true);
  });

  test("ordinary messages still notify the church", async () => {
    await as(ADMIN, `insert into chat_messages (channel_id, sender_id, content) values ($1, $2, 'hello')`, [GENERAL, ADMIN]);
    expect((await rows(`select count(*)::int n from notifications where user_id = $1 and type like 'chat.%'`, [ALICE]))[0].n).toBeGreaterThan(0);
  });
});
