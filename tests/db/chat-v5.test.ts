import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// chat_v5.sql (migration #52): delete messages for me only.

const CHURCH = "00000000-0000-0000-0000-0000000000e1";
const ALICE = "10000000-0000-0000-0000-0000000000e2";
const BOB = "10000000-0000-0000-0000-0000000000e3";
const CAROL = "10000000-0000-0000-0000-0000000000e4";
const DM = "40000000-0000-0000-0000-0000000000e2";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
const as = <T>(who: string, sql: string, params: unknown[] = []) => asUser(db, who, () => rows(sql, params)) as Promise<T[]>;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'Church');
    insert into auth.users (id) values ('${ALICE}'), ('${BOB}'), ('${CAROL}');
    insert into app_users (id, church_id, name, email, role, status) values
      ('${ALICE}', '${CHURCH}', 'Alice', 'a@x.test', 'member', 'active'),
      ('${BOB}', '${CHURCH}', 'Bob', 'b@x.test', 'member', 'active'),
      ('${CAROL}', '${CHURCH}', 'Carol', 'c@x.test', 'member', 'active');
    insert into chat_channels (id, church_id, name, is_dm) values ('${DM}', '${CHURCH}', 'dm', true);
    insert into chat_channel_members (channel_id, user_id) values ('${DM}', '${ALICE}'), ('${DM}', '${BOB}');
  `);
}, 120_000);

describe("delete for me", () => {
  test("a message I delete for me disappears for me only", async () => {
    const [{ id }] = await as<{ id: string }>(ALICE, `insert into chat_messages (channel_id, sender_id, content) values ($1, $2, '📞 Missed video call') returning id`, [DM, ALICE]);
    await as(BOB, `insert into chat_hidden_messages (user_id, message_id, channel_id) values ($1, $2, $3)`, [BOB, id, DM]);
    expect(await as(BOB, `select id from chat_messages where id = $1`, [id])).toEqual([]);
    expect(await as(ALICE, `select id from chat_messages where id = $1`, [id])).toEqual([{ id }]);
    // Nobody else can see what I hid.
    expect(await as(ALICE, `select * from chat_hidden_messages`)).toEqual([]);
  });

  test("you can't hide for someone else, or in a chat you're not in", async () => {
    const [{ id }] = await as<{ id: string }>(ALICE, `insert into chat_messages (channel_id, sender_id, content) values ($1, $2, 'hi') returning id`, [DM, ALICE]);
    await expect(as(ALICE, `insert into chat_hidden_messages (user_id, message_id, channel_id) values ($1, $2, $3)`, [BOB, id, DM])).rejects.toThrow(/row-level security/);
    await expect(as(CAROL, `insert into chat_hidden_messages (user_id, message_id, channel_id) values ($1, $2, $3)`, [CAROL, id, DM])).rejects.toThrow(/row-level security/);
  });
});
