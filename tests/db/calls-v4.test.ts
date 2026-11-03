import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// calls_v4.sql (migration #54): adding people to a call.

const CHURCH = "00000000-0000-0000-0000-0000000000c1";
const ALICE = "10000000-0000-0000-0000-0000000000c2";
const BOB = "10000000-0000-0000-0000-0000000000c3";
const CAROL = "10000000-0000-0000-0000-0000000000c4";
const DAN = "10000000-0000-0000-0000-0000000000c5";
const DM = "30000000-0000-0000-0000-0000000000c2";
const CALL = "50000000-0000-0000-0000-0000000000c1";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
const sees = (who: string, sql: string) => asUser(db, who, () => rows(sql));

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'Church');
    insert into auth.users (id) values ('${ALICE}'), ('${BOB}'), ('${CAROL}'), ('${DAN}');
    insert into app_users (id, church_id, name, email, role) values
      ('${ALICE}', '${CHURCH}', 'Alice', 'a@x.test', 'member'),
      ('${BOB}', '${CHURCH}', 'Bob', 'b@x.test', 'member'),
      ('${CAROL}', '${CHURCH}', 'Carol', 'c@x.test', 'member'),
      ('${DAN}', '${CHURCH}', 'Dan', 'd@x.test', 'member');
    insert into chat_channels (id, church_id, name, is_dm) values ('${DM}', '${CHURCH}', 'DM', true);
    insert into chat_channel_members (channel_id, user_id) values ('${DM}', '${ALICE}'), ('${DM}', '${BOB}');
    insert into video_calls (id, church_id, channel_id, room_name, room_url, started_by, expires_at, audio_only) values
      ('${CALL}', '${CHURCH}', '${DM}', 'dm-call', 'builtin:2', '${ALICE}', now() + interval '3 hours', true);
  `);
}, 120_000);

describe("adding people to a call", () => {
  test("someone added sees the call — but not the private chat it came from", async () => {
    expect(await sees(CAROL, `select id from video_calls`)).toEqual([]);
    await db.exec(`update video_calls set invited_user_ids = array['${CAROL}']::uuid[], invited_by = '${BOB}' where id = '${CALL}'`);
    expect(await sees(CAROL, `select id from video_calls`)).toEqual([{ id: CALL }]);
    expect(await sees(CAROL, `select id from chat_channels`)).toEqual([]);
    expect(await sees(DAN, `select id from video_calls`)).toEqual([]);
  });

  test("their phone rings: a call notification from whoever added them, once", async () => {
    expect(await rows(`select user_id, type, title, body, link from notifications where user_id = $1`, [CAROL])).toEqual([
      { user_id: CAROL, type: "video_call", title: "Bob is calling you", body: "Voice call — tap to join", link: `/dashboard/calls/${CALL}` },
    ]);
    await db.exec(`update video_calls set invited_user_ids = array['${CAROL}', '${DAN}']::uuid[], invited_by = '${ALICE}' where id = '${CALL}'`);
    expect((await rows(`select user_id from notifications where type = 'video_call' order by user_id`)).map((r) => r.user_id)).toEqual([CAROL, DAN]);
  });
});

describe("calls end when everyone has left (calls_v5.sql)", () => {
  const G = "50000000-0000-0000-0000-0000000000c9";
  test("the last one out ends the call; a member can't call it themselves", async () => {
    await db.exec(`update video_calls set ended_at = now() where id = '${CALL}'`);
    await db.exec(`insert into video_calls (id, church_id, channel_id, room_name, room_url, started_by, expires_at) values ('${G}', '${CHURCH}', '${DM}', 'g-call', 'builtin:6', '${ALICE}', now() + interval '3 hours')`);
    await expect(sees(ALICE, `select call_presence_write('${G}', '${ALICE}', false)`)).rejects.toThrow(/Not allowed/);
    expect(await rows(`select call_presence_write($1, $2, true) as n`, [G, ALICE])).toEqual([{ n: 1 }]);
    expect(await rows(`select call_presence_write($1, $2, true) as n`, [G, BOB])).toEqual([{ n: 2 }]);
    expect(await rows(`select call_presence_write($1, $2, false) as n`, [G, ALICE])).toEqual([{ n: 1 }]);
    expect((await rows(`select ended_at from video_calls where id = $1`, [G]))[0].ended_at).toBeNull();
    expect(await rows(`select call_presence_write($1, $2, false) as n`, [G, BOB])).toEqual([{ n: 0 }]);
    const [call] = await rows(`select ended_at, end_reason from video_calls where id = $1`, [G]);
    expect(call.ended_at).not.toBeNull();
    expect(call.end_reason).toBe("ended");
  });
});
