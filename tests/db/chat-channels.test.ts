import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// chat_v3.sql — creating, editing and deleting channels; deleting DMs.

const CHURCH = "00000000-0000-0000-0000-0000000000d1";
const OTHER = "00000000-0000-0000-0000-0000000000d2";
const ADMIN = "10000000-0000-0000-0000-0000000000d1";
const PASTOR = "10000000-0000-0000-0000-0000000000d2";
const ALICE = "10000000-0000-0000-0000-0000000000d3";
const BOB = "10000000-0000-0000-0000-0000000000d4";
const OUTSIDER = "10000000-0000-0000-0000-0000000000d5";
const GENERAL = "40000000-0000-0000-0000-0000000000d1";

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
const seeChannel = async (user: string, id: string) => (await asUser(db, user, () => rows(`select id from chat_channels where id = $1`, [id]))).length === 1;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'Church'), ('${OTHER}', 'Other');
    insert into church_subscriptions (church_id, plan_key, status) values ('${CHURCH}', 'premium', 'active');
    insert into auth.users (id) values ('${ADMIN}'), ('${PASTOR}'), ('${ALICE}'), ('${BOB}'), ('${OUTSIDER}');
    insert into app_users (id, church_id, name, email, role, status) values
      ('${ADMIN}', '${CHURCH}', 'Admin', 'a@d.test', 'church_admin', 'active'),
      ('${PASTOR}', '${CHURCH}', 'Pastor', 'p@d.test', 'pastor', 'active'),
      ('${ALICE}', '${CHURCH}', 'Alice', 'al@d.test', 'member', 'active'),
      ('${BOB}', '${CHURCH}', 'Bob', 'b@d.test', 'member', 'active'),
      ('${OUTSIDER}', '${OTHER}', 'Out', 'o@d.test', 'member', 'active');
    insert into chat_channels (id, church_id, department_id, name, is_dm) values ('${GENERAL}', '${CHURCH}', null, 'General', false);
  `);
}, 120_000);

describe("creating channels", () => {
  let prayerTeam: string;

  test("members can't create channels", async () => {
    expect(await attempt(ALICE, `select create_chat_channel('Mine', null, false, '{}')`)).toMatch(/Only pastors/);
    expect(await attempt(ALICE, `insert into chat_channels (church_id, name) values ($1, 'Sneaky')`, [CHURCH])).toMatch(/row-level security/);
  });

  test("a pastor creates a members-only channel; only members (and pastors/admins) can see it", async () => {
    const [{ id }] = await asUser(db, PASTOR, () => rows(`select create_chat_channel('Prayer team', 'Weekly prayer', true, array[$1::uuid, $2::uuid]) as id`, [ALICE, OUTSIDER]));
    prayerTeam = id;
    expect(await seeChannel(ALICE, prayerTeam)).toBe(true);
    expect(await seeChannel(PASTOR, prayerTeam)).toBe(true); // added automatically as creator
    expect(await seeChannel(ADMIN, prayerTeam)).toBe(true);
    expect(await seeChannel(BOB, prayerTeam)).toBe(false);
    // Someone from another church is silently left out.
    expect(await rows(`select user_id from chat_channel_members where channel_id = $1 order by user_id`, [prayerTeam])).toEqual([{ user_id: PASTOR }, { user_id: ALICE }].sort((a, b) => a.user_id.localeCompare(b.user_id)));
  });

  test("non-members can't post in or read a members-only channel", async () => {
    await asUser(db, ALICE, () => rows(`insert into chat_messages (channel_id, sender_id, content) values ($1, $2, 'Praying for you')`, [prayerTeam, ALICE]));
    expect(await asUser(db, BOB, () => rows(`select id from chat_messages where channel_id = $1`, [prayerTeam]))).toHaveLength(0);
    expect(await attempt(BOB, `insert into chat_messages (channel_id, sender_id, content) values ($1, $2, 'hi')`, [prayerTeam, BOB])).toMatch(/row-level security/);
  });

  test("editing: rename and change members; members can't edit", async () => {
    expect(await attempt(ALICE, `select update_chat_channel($1, 'Hacked', null, false, '{}')`, [prayerTeam])).toMatch(/Only pastors/);
    await asUser(db, ADMIN, () => rows(`select update_chat_channel($1, 'Prayer warriors', null, true, array[$2::uuid])`, [prayerTeam, BOB]));
    expect(await seeChannel(BOB, prayerTeam)).toBe(true);
    expect(await seeChannel(ALICE, prayerTeam)).toBe(false);
    expect((await rows(`select name from chat_channels where id = $1`, [prayerTeam]))[0].name).toBe("Prayer warriors");
  });

  test("an open channel is visible to everyone in the church, not outside it", async () => {
    const [{ id }] = await asUser(db, PASTOR, () => rows(`select create_chat_channel('Announcements chat', null, false, '{}') as id`));
    expect(await seeChannel(BOB, id)).toBe(true);
    expect(await seeChannel(OUTSIDER, id)).toBe(false);
  });
});

describe("deleting channels", () => {
  test("only church admins; never General", async () => {
    const [{ id }] = await asUser(db, PASTOR, () => rows(`select create_chat_channel('Temporary', null, false, '{}') as id`));
    await asUser(db, BOB, () => rows(`insert into chat_messages (channel_id, sender_id, content, kind, media_path) values ($1, $2, '', 'voice', $3)`, [id, BOB, `${CHURCH}/${id}/${BOB}/n.webm`]));

    expect(await attempt(PASTOR, `select delete_chat_channel($1)`, [id])).toMatch(/Only church admins/);
    expect(await attempt(ADMIN, `select delete_chat_channel($1)`, [GENERAL])).toMatch(/can't be deleted/);

    const [{ paths }] = await asUser(db, ADMIN, () => rows(`select delete_chat_channel($1) as paths`, [id]));
    expect(paths).toEqual([`${CHURCH}/${id}/${BOB}/n.webm`]);
    expect(await rows(`select id from chat_messages where channel_id = $1`, [id])).toHaveLength(0);
  });
});

describe("deleting DMs", () => {
  test("either person can delete for both; nobody else can", async () => {
    const [{ dm }] = await asUser(db, ALICE, () => rows(`select start_direct_message($1) as dm`, [BOB]));
    await asUser(db, ALICE, () => rows(`insert into chat_messages (channel_id, sender_id, content) values ($1, $2, 'hello')`, [dm, ALICE]));

    expect(await attempt(ADMIN, `select delete_direct_message($1)`, [dm])).toMatch(/your own conversations/);
    expect(await attempt(BOB, `select delete_direct_message($1)`, [dm])).toBeNull();
    expect(await rows(`select id from chat_channels where id = $1`, [dm])).toHaveLength(0);
  });

  test("'delete for me' is just my own setting", async () => {
    const [{ dm }] = await asUser(db, ALICE, () => rows(`select start_direct_message($1) as dm`, [PASTOR]));
    expect(await attempt(ALICE, `insert into chat_member_settings (channel_id, user_id, hidden_at, cleared_at) values ($1, $2, now(), now())`, [dm, ALICE])).toBeNull();
    expect(await attempt(BOB, `insert into chat_member_settings (channel_id, user_id, hidden_at) values ($1, $2, now())`, [dm, BOB])).toMatch(/row-level security/);
    expect(await seeChannel(PASTOR, dm)).toBe(true);
  });
});
