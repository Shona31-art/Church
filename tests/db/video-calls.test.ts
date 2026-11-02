import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// Video calls (video_calls.sql, migration #47): a call is visible — and so
// joinable — only to people who can see its chat or appointment.

const CHURCH = "00000000-0000-0000-0000-00000000000a";
const OTHER_CHURCH = "00000000-0000-0000-0000-00000000000b";
const PASTOR = "10000000-0000-0000-0000-000000000001";
const ALICE = "10000000-0000-0000-0000-000000000002";
const BOB = "10000000-0000-0000-0000-000000000003";
const CAROL = "10000000-0000-0000-0000-000000000004";
const OUTSIDER = "20000000-0000-0000-0000-000000000001";
const GENERAL = "30000000-0000-0000-0000-000000000001";
const DM = "30000000-0000-0000-0000-000000000002";
const BOOKING = "40000000-0000-0000-0000-000000000001";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
const seen = (who: string) => asUser(db, who, () => rows(`select room_name from video_calls order by room_name`)).then((r) => r.map((x) => x.room_name));

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'Church'), ('${OTHER_CHURCH}', 'Other');
    insert into auth.users (id) values ('${PASTOR}'), ('${ALICE}'), ('${BOB}'), ('${CAROL}'), ('${OUTSIDER}');
    insert into app_users (id, church_id, name, email, role) values
      ('${PASTOR}', '${CHURCH}', 'Pastor', 'p@x.test', 'pastor'),
      ('${ALICE}', '${CHURCH}', 'Alice', 'a@x.test', 'member'),
      ('${BOB}', '${CHURCH}', 'Bob', 'b@x.test', 'member'),
      ('${CAROL}', '${CHURCH}', 'Carol', 'c@x.test', 'member'),
      ('${OUTSIDER}', '${OTHER_CHURCH}', 'Outsider', 'o@x.test', 'pastor');
    insert into chat_channels (id, church_id, name, is_dm) values ('${GENERAL}', '${CHURCH}', 'General', false), ('${DM}', '${CHURCH}', 'DM', true);
    insert into chat_channel_members (channel_id, user_id) values ('${DM}', '${ALICE}'), ('${DM}', '${BOB}');
    insert into pastor_bookings (id, church_id, requested_by, booking_type, preferred_date, status) values ('${BOOKING}', '${CHURCH}', '${CAROL}', 'counselling', current_date, 'approved');
    insert into video_calls (church_id, channel_id, room_name, room_url, started_by, expires_at) values
      ('${CHURCH}', '${GENERAL}', 'general-call', 'https://x.daily.co/general-call', '${PASTOR}', now() + interval '3 hours'),
      ('${CHURCH}', '${DM}', 'dm-call', 'https://x.daily.co/dm-call', '${ALICE}', now() + interval '3 hours');
    insert into video_calls (church_id, booking_id, room_name, room_url, started_by, expires_at) values
      ('${CHURCH}', '${BOOKING}', 'booking-call', 'https://x.daily.co/booking-call', '${PASTOR}', now() + interval '3 hours');
  `);
}, 120_000);

describe("video_calls: who can see (and so join) a call", () => {
  test("the two people in a private chat see its call; others in the church don't", async () => {
    expect(await seen(ALICE)).toEqual(["dm-call", "general-call"]);
    expect(await seen(BOB)).toEqual(["dm-call", "general-call"]);
    expect(await seen(CAROL)).toEqual(["booking-call", "general-call"]);
  });

  test("an appointment's call: the member who booked it and the church's pastors", async () => {
    expect(await seen(PASTOR)).toEqual(["booking-call", "general-call"]); // not the private chat
  });

  test("another church sees none", async () => {
    expect(await seen(OUTSIDER)).toEqual([]);
  });

  test("calls can't be created or changed from the browser", async () => {
    await expect(
      asUser(db, ALICE, () => rows(`insert into video_calls (church_id, channel_id, room_name, room_url, expires_at) values ($1, $2, 'x', 'https://x', now())`, [CHURCH, GENERAL]))
    ).rejects.toThrow(/row-level security/);
    await asUser(db, PASTOR, () => rows(`update video_calls set ended_at = now()`));
    expect(await rows(`select count(*)::int as n from video_calls where ended_at is not null`)).toEqual([{ n: 0 }]);
  });

  test("one open call per chat; a call belongs to a chat or an appointment, not both", async () => {
    await expect(db.exec(`insert into video_calls (church_id, channel_id, room_name, room_url, expires_at) values ('${CHURCH}', '${GENERAL}', 'second', 'https://x', now())`)).rejects.toThrow();
    await expect(db.exec(`insert into video_calls (church_id, room_name, room_url, expires_at) values ('${CHURCH}', 'nowhere', 'https://x', now())`)).rejects.toThrow();
  });
});

describe("ringing", () => {
  test("a new call notifies exactly the people it rings — same church, not the caller, not anyone deactivated", async () => {
    await db.exec(`
      insert into auth.users (id) values ('10000000-0000-0000-0000-000000000009');
      insert into app_users (id, church_id, name, email, role, status) values ('10000000-0000-0000-0000-000000000009', '${CHURCH}', 'Gone', 'g@x.test', 'member', 'disabled');
      update video_calls set ended_at = now() where channel_id = '${DM}';
    `);
    const [{ id }] = await rows(
      `insert into video_calls (church_id, channel_id, room_name, room_url, started_by, expires_at, ring_user_ids)
       values ($1, $2, 'ring-call', 'https://x.daily.co/ring-call', $3, now() + interval '3 hours', $4) returning id`,
      [CHURCH, DM, ALICE, [BOB, ALICE, OUTSIDER, "10000000-0000-0000-0000-000000000009"]]
    );
    const sent = await rows(`select user_id, category, type, title, body, link from notifications where type = 'video_call' order by user_id`);
    expect(sent).toEqual([{ user_id: BOB, category: "messages", type: "video_call", title: "Alice is calling you", body: "Video call — tap to join", link: `/dashboard/calls/${id}` }]);
    // Only Bob can read it (notifications are private).
    expect(await asUser(db, BOB, () => rows(`select type from notifications where type = 'video_call'`))).toHaveLength(1);
    expect(await asUser(db, CAROL, () => rows(`select type from notifications where type = 'video_call'`))).toHaveLength(0);
  });

  test("a call that rings nobody (a group chat) sends no call notifications", async () => {
    const before = (await rows(`select count(*)::int as n from notifications where type = 'video_call'`))[0].n;
    await db.exec(`update video_calls set ended_at = now() where channel_id = '${GENERAL}'`);
    await db.exec(`insert into video_calls (church_id, channel_id, room_name, room_url, started_by, expires_at) values ('${CHURCH}', '${GENERAL}', 'group-2', 'https://x', '${PASTOR}', now() + interval '1 hour')`);
    expect((await rows(`select count(*)::int as n from notifications where type = 'video_call'`))[0].n).toBe(before);
  });
});

describe("voice calls", () => {
  test("a voice call rings as a voice call", async () => {
    await db.exec(`update video_calls set ended_at = now() where channel_id = '${DM}'`);
    await db.exec(`delete from notifications where type = 'video_call'`);
    await rows(
      `insert into video_calls (church_id, channel_id, room_name, room_url, started_by, expires_at, ring_user_ids, audio_only)
       values ($1, $2, 'voice-call', 'https://x.daily.co/voice-call', $3, now() + interval '1 hour', $4, true)`,
      [CHURCH, DM, BOB, [ALICE]]
    );
    expect(await rows(`select user_id, title, body from notifications where type = 'video_call'`)).toEqual([{ user_id: ALICE, title: "Bob is calling you", body: "Voice call — tap to join" }]);
  });
});

describe("call channels (calls_v2.sql): only the call's people can join its Realtime channel", () => {
  const joinAs = async (who: string, callRoom: string) => {
    const [{ id }] = await rows(`select id from video_calls where room_name = $1`, [callRoom]);
    await db.exec(`set test.topic = 'call:${id}'`);
    try {
      return await asUser(db, who, () => rows(`insert into realtime.messages (topic, extension) values (realtime.topic(), 'presence') returning id`));
    } finally {
      await db.exec(`set test.topic = ''`);
    }
  };

  test("the two people in a private chat can; others in the church can't", async () => {
    await db.exec(`update video_calls set ended_at = null where room_name = 'voice-call'`);
    expect(await joinAs(BOB, "voice-call")).toHaveLength(1);
    await expect(joinAs(CAROL, "voice-call")).rejects.toThrow(/row-level security/);
    await expect(joinAs(OUTSIDER, "voice-call")).rejects.toThrow(/row-level security/);
  });

  test("an appointment's call: the member and pastors", async () => {
    expect(await joinAs(CAROL, "booking-call")).toHaveLength(1);
    expect(await joinAs(PASTOR, "booking-call")).toHaveLength(1);
    await expect(joinAs(ALICE, "booking-call")).rejects.toThrow(/row-level security/);
  });

  test("once a call has ended, nobody can join its channel", async () => {
    await db.exec(`update video_calls set ended_at = now() where room_name = 'voice-call'`);
    await expect(joinAs(BOB, "voice-call")).rejects.toThrow(/row-level security/);
  });
});

