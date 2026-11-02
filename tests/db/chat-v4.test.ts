import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// chat_v4.sql (migration #49): last seen, stars, mentions, polls, archive,
// disappearing messages. Each query runs as a real member (RLS on).

const CHURCH = "00000000-0000-0000-0000-0000000000f1";
const PASTOR = "10000000-0000-0000-0000-0000000000f1";
const ALICE = "10000000-0000-0000-0000-0000000000f2";
const BOB = "10000000-0000-0000-0000-0000000000f3";
const CAROL = "10000000-0000-0000-0000-0000000000f4";
const GENERAL = "40000000-0000-0000-0000-0000000000f1";
const DM = "40000000-0000-0000-0000-0000000000f2";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
const as = <T>(who: string, sql: string, params: unknown[] = []) => asUser(db, who, () => rows(sql, params)) as Promise<T[]>;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'Church');
    insert into auth.users (id) values ('${PASTOR}'), ('${ALICE}'), ('${BOB}'), ('${CAROL}');
    insert into app_users (id, church_id, name, email, role, status) values
      ('${PASTOR}', '${CHURCH}', 'Pastor', 'p@x.test', 'pastor', 'active'),
      ('${ALICE}', '${CHURCH}', 'Alice', 'a@x.test', 'member', 'active'),
      ('${BOB}', '${CHURCH}', 'Bob', 'b@x.test', 'member', 'active'),
      ('${CAROL}', '${CHURCH}', 'Carol', 'c@x.test', 'member', 'active');
    insert into chat_channels (id, church_id, name, is_dm) values ('${GENERAL}', '${CHURCH}', 'General', false), ('${DM}', '${CHURCH}', 'dm', true);
    insert into chat_channel_members (channel_id, user_id) values ('${DM}', '${ALICE}'), ('${DM}', '${BOB}');
  `);
}, 120_000);

describe("online & last seen", () => {
  test("the other person in a private chat sees your last seen; nobody else can", async () => {
    await as(ALICE, `select touch_presence()`);
    const [{ t }] = await as<{ t: string | null }>(BOB, `select dm_last_seen($1) as t`, [DM]);
    expect(t).not.toBeNull();
    expect(await as(CAROL, `select dm_last_seen($1) as t`, [DM])).toEqual([{ t: null }]); // not in the chat
    expect(await as(CAROL, `select * from user_presence`)).toEqual([]); // rows are private
  });

  test("hide yours and it's gone — and you can't see theirs either", async () => {
    await as(ALICE, `select set_last_seen_visibility(false)`);
    expect(await as(BOB, `select dm_last_seen($1) as t`, [DM])).toEqual([{ t: null }]);
    await as(BOB, `select touch_presence()`);
    expect(await as(ALICE, `select dm_last_seen($1) as t`, [DM])).toEqual([{ t: null }]);
    await as(ALICE, `select set_last_seen_visibility(true)`);
    expect((await as<{ t: string | null }>(ALICE, `select dm_last_seen($1) as t`, [DM]))[0].t).not.toBeNull();
  });
});

describe("stars, forwarding and mentions", () => {
  test("stars are private and only for messages you can see", async () => {
    const [{ id }] = await as<{ id: string }>(ALICE, `insert into chat_messages (channel_id, sender_id, content) values ($1, $2, 'star me') returning id`, [DM, ALICE]);
    await as(ALICE, `insert into chat_starred_messages (user_id, message_id, channel_id) values ($1, $2, $3)`, [ALICE, id, DM]);
    expect(await as(BOB, `select * from chat_starred_messages`)).toEqual([]);
    await expect(as(CAROL, `insert into chat_starred_messages (user_id, message_id, channel_id) values ($1, $2, $3)`, [CAROL, id, DM])).rejects.toThrow(/row-level security/);
  });

  test("a forwarded message is labelled", async () => {
    const [m] = await as<{ forwarded: boolean }>(BOB, `insert into chat_messages (channel_id, sender_id, content, forwarded) values ($1, $2, 'fwd', true) returning forwarded`, [GENERAL, BOB]);
    expect(m.forwarded).toBe(true);
  });

  test("an @mention reaches the person even if they've muted the group, as its own notification", async () => {
    await db.exec(`insert into chat_member_settings (channel_id, user_id, muted_until) values ('${GENERAL}', '${CAROL}', now() + interval '1 day')`);
    await db.exec(`delete from notifications`);
    await as(ALICE, `insert into chat_messages (channel_id, sender_id, content, mentions) values ($1, $2, 'hey @Carol', $3)`, [GENERAL, ALICE, [CAROL, ALICE]]);
    const carol = await rows(`select type, title, body from notifications where user_id = $1`, [CAROL]);
    expect(carol).toEqual([{ type: "chat.mention", title: "Alice mentioned you in General", body: "hey @Carol" }]);
    // The sender's own id is dropped from mentions.
    expect(await rows(`select mentions from chat_messages where content = 'hey @Carol'`)).toEqual([{ mentions: [CAROL] }]);
  });
});

describe("polls", () => {
  let poll: string;
  test("a poll is made through create_chat_poll, never as a bare message", async () => {
    await expect(as(ALICE, `insert into chat_messages (channel_id, sender_id, content, kind) values ($1, $2, 'q?', 'poll')`, [GENERAL, ALICE])).rejects.toThrow(/row-level security/);
    [{ id: poll }] = (await as<{ id: string }>(ALICE, `select create_chat_poll($1, 'Lunch after church?', array['Yes', ' ', 'No'], false) as id`, [GENERAL])) as any;
    expect(await as(BOB, `select options, allow_multiple from chat_polls where message_id = $1`, [poll])).toEqual([{ options: ["Yes", "No"], allow_multiple: false }]);
    await expect(as(ALICE, `select create_chat_poll($1, 'Only one?', array['A'])`, [GENERAL])).rejects.toThrow(/2 to 12/);
  });

  test("voting: one choice unless the poll allows more; changing your vote replaces it", async () => {
    await as(BOB, `select vote_chat_poll($1, array[0]::smallint[])`, [poll]);
    await as(BOB, `select vote_chat_poll($1, array[1]::smallint[])`, [poll]);
    await expect(as(BOB, `select vote_chat_poll($1, array[0, 1]::smallint[])`, [poll])).rejects.toThrow(/one option/);
    await expect(as(BOB, `select vote_chat_poll($1, array[5]::smallint[])`, [poll])).rejects.toThrow(/isn't in the poll/);
    expect(await as(CAROL, `select user_id, option_index from chat_poll_votes`)).toEqual([{ user_id: BOB, option_index: 1 }]);
    await expect(as(BOB, `insert into chat_poll_votes (message_id, user_id, option_index, channel_id) values ($1, $2, 0, $3)`, [poll, BOB, GENERAL])).rejects.toThrow(/row-level security/);
  });
});

describe("archive and disappearing messages", () => {
  test("archiving is per person", async () => {
    await as(ALICE, `insert into chat_member_settings (channel_id, user_id, archived_at) values ($1, $2, now())`, [GENERAL, ALICE]);
    expect(await as(BOB, `select * from chat_member_settings where archived_at is not null`)).toEqual([]);
  });

  test("in a group only pastors and admins can turn on disappearing messages; in a DM either person", async () => {
    await expect(as(ALICE, `select set_chat_disappearing($1, 86400)`, [GENERAL])).rejects.toThrow(/pastors and church admins/);
    await as(BOB, `select set_chat_disappearing($1, 86400)`, [DM]);
    const [note] = await as<{ content: string; sender_id: string }>(ALICE, `select content, sender_id from chat_messages where channel_id = $1 order by created_at desc limit 1`, [DM]);
    expect(note).toEqual({ content: "⏱ Turned on disappearing messages. New messages will disappear 24 hours after they're sent.", sender_id: BOB });
    await expect(as(BOB, `select set_chat_disappearing($1, 123)`, [DM])).rejects.toThrow(/24 hours, 7 days or 90 days/);
  });

  test("new messages get a disappearing time the app can't override; disappeared ones are hidden, then purged", async () => {
    const [m] = await as<{ id: string; expires_at: string }>(ALICE, `insert into chat_messages (channel_id, sender_id, content, expires_at) values ($1, $2, 'temporary', null) returning id, expires_at`, [DM, ALICE]);
    expect(m.expires_at).not.toBeNull();
    await db.exec(`update chat_messages set expires_at = now() - interval '1 minute' where id = '${m.id}'`);
    expect(await as(BOB, `select id from chat_messages where id = $1`, [m.id])).toEqual([]);
    await expect(as(BOB, `select purge_expired_chat_messages()`)).rejects.toThrow();
    await rows(`select purge_expired_chat_messages()`);
    expect(await rows(`select id from chat_messages where id = $1`, [m.id])).toEqual([]);
  });
});
