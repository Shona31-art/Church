import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// notifications.sql — who gets told about what (the triggers), and that
// people can only ever see and change their own notifications.

const CHURCH = "00000000-0000-0000-0000-0000000000e1";
const OTHER_CHURCH = "00000000-0000-0000-0000-0000000000e2";
const YOUTH = "20000000-0000-0000-0000-0000000000e1";
const ADMIN = "10000000-0000-0000-0000-0000000000e1";
const PASTOR = "10000000-0000-0000-0000-0000000000e2";
const ALICE = "10000000-0000-0000-0000-0000000000e3"; // youth
const BOB = "10000000-0000-0000-0000-0000000000e4"; // no department
const CAROL = "10000000-0000-0000-0000-0000000000e5"; // youth
const DISABLED = "10000000-0000-0000-0000-0000000000e6";
const OUTSIDER = "10000000-0000-0000-0000-0000000000e7";
const SUPER = "10000000-0000-0000-0000-0000000000e8";
const GENERAL = "40000000-0000-0000-0000-0000000000e1";
const DM = "40000000-0000-0000-0000-0000000000e2";
const TEAM = "40000000-0000-0000-0000-0000000000e3";
const EVERYONE_IN_CHURCH = [ADMIN, PASTOR, ALICE, BOB, CAROL];

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
/** Who has an unread notification of this type (sorted), optionally for one link. */
async function recipients(type: string, link?: string) {
  const r = await rows(
    `select distinct user_id from notifications where type = $1 and read_at is null ${link ? "and link = $2" : ""} order by user_id`,
    link ? [type, link] : [type],
  );
  return r.map((x) => x.user_id);
}
const sorted = (ids: string[]) => [...ids].sort();
const latestFor = async (user: string, type: string) =>
  (await rows(`select * from notifications where user_id = $1 and type = $2 order by created_at desc limit 1`, [user, type]))[0];

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'Church'), ('${OTHER_CHURCH}', 'Other');
    insert into departments (id, church_id, name) values ('${YOUTH}', '${CHURCH}', 'Youth');
    insert into auth.users (id) values ('${ADMIN}'), ('${PASTOR}'), ('${ALICE}'), ('${BOB}'), ('${CAROL}'), ('${DISABLED}'), ('${OUTSIDER}'), ('${SUPER}');
    insert into app_users (id, church_id, department_id, name, email, role, status) values
      ('${ADMIN}', '${CHURCH}', null, 'Admin', 'a@e.test', 'church_admin', 'active'),
      ('${PASTOR}', '${CHURCH}', null, 'Pastor', 'p@e.test', 'pastor', 'active'),
      ('${ALICE}', '${CHURCH}', '${YOUTH}', 'Alice', 'al@e.test', 'member', 'active'),
      ('${BOB}', '${CHURCH}', null, 'Bob', 'b@e.test', 'member', 'active'),
      ('${CAROL}', '${CHURCH}', '${YOUTH}', 'Carol', 'c@e.test', 'member', 'active'),
      ('${DISABLED}', '${CHURCH}', null, 'Gone', 'g@e.test', 'member', 'disabled'),
      ('${OUTSIDER}', '${OTHER_CHURCH}', null, 'Out', 'o@e.test', 'member', 'active'),
      ('${SUPER}', null, null, 'Super', 's@e.test', 'super_admin', 'active');
    insert into chat_channels (id, church_id, department_id, name, is_dm) values ('${GENERAL}', '${CHURCH}', null, 'General', false);
    insert into chat_channels (id, church_id, department_id, name, is_dm) values ('${DM}', '${CHURCH}', null, 'dm', true);
    insert into chat_channels (id, church_id, department_id, name, is_dm, is_custom, members_only) values ('${TEAM}', '${CHURCH}', null, 'Prayer team', false, true, true);
    insert into chat_channel_members (channel_id, user_id) values ('${DM}', '${ALICE}'), ('${DM}', '${BOB}'), ('${TEAM}', '${ALICE}'), ('${TEAM}', '${CAROL}');
  `);
  // Setting up the cast above fires "new member" alerts; start each test group clean.
  await db.exec(`delete from notifications`);
}, 120_000);

describe("church news", () => {
  test("a published church-wide announcement reaches everyone active in the church except the author", async () => {
    await db.exec(`insert into announcements (id, church_id, author_id, title, body, status) values ('50000000-0000-0000-0000-0000000000e1', '${CHURCH}', '${ADMIN}', 'Youth camp', 'Body', 'published')`);
    expect(await recipients("announcement.published")).toEqual(sorted([PASTOR, ALICE, BOB, CAROL]));
    const n = await latestFor(BOB, "announcement.published");
    expect(n).toMatchObject({ category: "church_news", title: "New announcement", body: "Youth camp", link: "/dashboard/announcements/50000000-0000-0000-0000-0000000000e1", actor_id: ADMIN });
  });

  test("drafts notify nobody; publishing later notifies once", async () => {
    await db.exec(`delete from notifications`);
    const id = "50000000-0000-0000-0000-0000000000e2";
    await db.exec(`insert into announcements (id, church_id, author_id, title, body, status) values ('${id}', '${CHURCH}', '${ADMIN}', 'Draft', 'Body', 'draft')`);
    expect(await recipients("announcement.published")).toEqual([]);
    await db.exec(`update announcements set status = 'published' where id = '${id}'`);
    await db.exec(`update announcements set status = 'published', title = 'Edited' where id = '${id}'`);
    expect((await rows(`select count(*)::int as n from notifications where user_id = $1`, [BOB]))[0].n).toBe(1);
  });

  test("a department announcement reaches that department plus pastors and admins only", async () => {
    await db.exec(`delete from notifications`);
    await db.exec(`insert into announcements (church_id, department_id, author_id, title, body, status) values ('${CHURCH}', '${YOUTH}', '${PASTOR}', 'Youth only', 'Body', 'published')`);
    expect(await recipients("announcement.published")).toEqual(sorted([ADMIN, ALICE, CAROL]));
  });

  test("a new event notifies its audience; a cancelled one doesn't", async () => {
    await db.exec(`delete from notifications`);
    await db.exec(`insert into events (church_id, created_by, title, start_time) values ('${CHURCH}', '${PASTOR}', 'Picnic', now() + interval '3 days')`);
    expect(await recipients("event.created")).toEqual(sorted([ADMIN, ALICE, BOB, CAROL]));
    await db.exec(`delete from notifications`);
    await db.exec(`insert into events (church_id, created_by, title, start_time, cancelled_at) values ('${CHURCH}', '${PASTOR}', 'Off', now(), now())`);
    expect(await recipients("event.created")).toEqual([]);
  });
});

describe("messages", () => {
  const send = (from: string, channel: string, text = "hi") => db.exec(`insert into chat_messages (channel_id, sender_id, content) values ('${channel}', '${from}', '${text}')`);

  test("a channel message reaches everyone in it except the sender, grouped per chat", async () => {
    await db.exec(`delete from notifications`);
    await send(ALICE, GENERAL);
    expect(await recipients("chat.message")).toEqual(sorted([ADMIN, PASTOR, BOB, CAROL]));
    await send(ALICE, GENERAL);
    const bob = await rows(`select count, title, body from notifications where user_id = $1 and type = 'chat.message'`, [BOB]);
    // WhatsApp-style (chat_notifications_v2.sql): the latest message, with who sent it.
    expect(bob).toEqual([{ count: 2, title: "General", body: "Alice: hi" }]);
  });

  test("muted chats and blocked senders create nothing", async () => {
    await db.exec(`
      insert into chat_member_settings (channel_id, user_id, muted_until) values ('${GENERAL}', '${BOB}', now() + interval '1 day');
      insert into chat_blocks (blocker_id, blocked_id) values ('${CAROL}', '${ALICE}');
    `);
    await send(ALICE, GENERAL);
    expect((await latestFor(BOB, "chat.message")).count).toBe(2); // unchanged while muted
    expect((await latestFor(CAROL, "chat.message")).count).toBe(2); // unchanged: Carol blocked Alice
    expect((await latestFor(PASTOR, "chat.message")).count).toBe(3);
  });

  test("opening the chat marks its notification read; the next message starts a new one", async () => {
    await db.exec(`insert into chat_member_settings (channel_id, user_id, last_read_at) values ('${GENERAL}', '${PASTOR}', now())
                   on conflict (channel_id, user_id) do update set last_read_at = now()`);
    expect((await latestFor(PASTOR, "chat.message")).read_at).not.toBeNull();
    await send(ALICE, GENERAL);
    const open = await rows(`select count from notifications where user_id = $1 and type = 'chat.message' and read_at is null`, [PASTOR]);
    expect(open).toEqual([{ count: 1 }]);
  });

  test("a direct message reaches only the other person, titled with the sender's name", async () => {
    await db.exec(`delete from notifications`);
    await send(ALICE, DM);
    expect(await recipients("chat.message")).toEqual([BOB]);
    expect(await latestFor(BOB, "chat.message")).toMatchObject({ title: "Alice", body: "hi", link: `/dashboard/chat/${DM}` });
  });

  test("a members-only channel reaches its members plus pastors and admins", async () => {
    await db.exec(`delete from notifications`);
    await send(ALICE, TEAM);
    // Bob isn't a member. Carol is, but she blocked Alice (above), so only the pastor and admin are told.
    expect(await recipients("chat.message")).toEqual(sorted([ADMIN, PASTOR]));
  });

  test("someone who turns message text off never gets it — only the people the message reached see it at all", async () => {
    await db.exec(`delete from notifications`);
    await db.exec(`insert into notification_preferences (user_id, show_previews) values ('${ADMIN}', false) on conflict (user_id) do update set show_previews = false`);
    await send(BOB, GENERAL, "my secret prayer request");
    const withText = await rows(`select user_id from notifications where body ilike '%secret%' order by user_id`);
    // Everyone the message reached, except the admin who turned text off (and never Bob, the sender).
    expect(withText.map((r) => r.user_id)).toEqual(sorted([PASTOR, ALICE, CAROL]));
    expect((await latestFor(ADMIN, "chat.message")).body).toBe("New message from Bob");
    // Notifications are private: Alice can't read the pastor's.
    expect(await asUser(db, ALICE, () => rows(`select user_id from notifications where body ilike '%secret%'`))).toEqual([{ user_id: ALICE }]);
  });

  test("voice notes and photos are described, long messages are shortened", async () => {
    await db.exec(`delete from notifications`);
    await send(ALICE, DM, "x".repeat(300));
    expect((await latestFor(BOB, "chat.message")).body).toBe(`${"x".repeat(139)}…`);
    expect(await rows(`select app_private.chat_preview('voice', '') as v, app_private.chat_preview('image', 'p') as i`)).toEqual([{ v: "🎤 Voice message", i: "📷 Photo" }]);
  });

  test("a message deleted before it's read leaves no trace of its text in notifications", async () => {
    await db.exec(`delete from notifications`);
    const [{ id }] = await rows(`insert into chat_messages (channel_id, sender_id, content) values ($1, $2, 'oops wrong chat') returning id`, [DM, ALICE]);
    expect((await latestFor(BOB, "chat.message")).body).toBe("oops wrong chat");
    await db.exec(`update chat_messages set deleted_at = now(), content = '' where id = '${id}'`);
    expect((await latestFor(BOB, "chat.message")).body).toBe("🚫 This message was deleted");
  });
});

describe("prayer & care", () => {
  const PRAYER = "60000000-0000-0000-0000-0000000000e1";

  test("prayers for your request are anonymous and grouped; your own prayer doesn't notify you", async () => {
    await db.exec(`delete from notifications`);
    await db.exec(`insert into prayer_board_items (id, church_id, user_id, prayer_text) values ('${PRAYER}', '${CHURCH}', '${BOB}', 'Healing for my mother')`);
    await db.exec(`insert into prayer_intercessions (prayer_id, user_id, church_id) values ('${PRAYER}', '${ALICE}', '${CHURCH}')`);
    expect(await latestFor(BOB, "prayer.prayed")).toMatchObject({ title: "Someone prayed for you", actor_id: null, count: 1 });
    await db.exec(`insert into prayer_intercessions (prayer_id, user_id, church_id) values ('${PRAYER}', '${CAROL}', '${CHURCH}')`);
    await db.exec(`insert into prayer_intercessions (prayer_id, user_id, church_id) values ('${PRAYER}', '${BOB}', '${CHURCH}')`);
    expect(await latestFor(BOB, "prayer.prayed")).toMatchObject({ count: 2, body: "2 people prayed for your prayer request." });
    expect(await recipients("prayer.prayed")).toEqual([BOB]);
  });

  test("a comment tells the owner who encouraged them, without the prayer text", async () => {
    await db.exec(`insert into prayer_comments (prayer_id, church_id, user_id, body) values ('${PRAYER}', '${CHURCH}', '${ALICE}', 'Praying!')`);
    const n = await latestFor(BOB, "prayer.commented");
    expect(n.body).toBe("Alice left an encouragement on your prayer request.");
    expect(n.body).not.toMatch(/mother/);
  });

  test("booking requests go to the requested pastor (or all pastors/admins); decisions go back to the requester", async () => {
    await db.exec(`delete from notifications`);
    await db.exec(`insert into pastor_bookings (id, church_id, requested_by, pastor_id, booking_type, preferred_date) values ('70000000-0000-0000-0000-0000000000e1', '${CHURCH}', '${ALICE}', '${PASTOR}', 'baptism', '2026-11-01')`);
    expect(await recipients("booking.requested")).toEqual([PASTOR]);
    expect((await latestFor(PASTOR, "booking.requested")).body).toBe("Alice · Baptism · 01 Nov 2026");

    await db.exec(`insert into pastor_bookings (church_id, requested_by, booking_type, preferred_date) values ('${CHURCH}', '${BOB}', 'other', '2026-11-02')`);
    expect(await recipients("booking.requested")).toEqual(sorted([ADMIN, PASTOR]));

    await db.exec(`update pastor_bookings set status = 'approved' where id = '70000000-0000-0000-0000-0000000000e1'`);
    expect(await latestFor(ALICE, "booking.decided")).toMatchObject({ title: "Booking approved", body: "Baptism on 01 Nov 2026" });
  });

  test("support replies reach the ticket's creator, not the person replying", async () => {
    await db.exec(`delete from notifications`);
    await db.exec(`insert into support_tickets (id, church_id, created_by, subject) values ('80000000-0000-0000-0000-0000000000e1', '${CHURCH}', '${ALICE}', 'Can''t upload')`);
    await db.exec(`insert into support_ticket_messages (ticket_id, sender_id, content) values ('80000000-0000-0000-0000-0000000000e1', '${ALICE}', 'Details')`);
    expect(await recipients("support.reply")).toEqual([]);
    await db.exec(`insert into support_ticket_messages (ticket_id, sender_id, content) values ('80000000-0000-0000-0000-0000000000e1', '${SUPER}', 'Fixed')`);
    expect(await recipients("support.reply")).toEqual([ALICE]);
  });
});

describe("pastor and admin alerts", () => {
  test("a crisis escalation alerts the pastor it was recorded for, with no details", async () => {
    await db.exec(`delete from notifications`);
    await db.exec(`
      insert into counseling_conversations (id, church_id, member_id) values ('90000000-0000-0000-0000-0000000000e1', '${CHURCH}', '${BOB}');
      insert into counseling_escalations (conversation_id, notified_user_id) values ('90000000-0000-0000-0000-0000000000e1', '${PASTOR}');
    `);
    expect(await recipients("counseling.crisis")).toEqual([PASTOR]);
    const n = await latestFor(PASTOR, "counseling.crisis");
    expect(n).toMatchObject({ category: "alerts", actor_id: null, link: "/dashboard/counseling/90000000-0000-0000-0000-0000000000e1" });
    expect(`${n.title} ${n.body}`).not.toMatch(/Bob/);
  });

  test("church admins hear about new members once, when they become active", async () => {
    await db.exec(`delete from notifications`);
    await db.exec(`
      insert into auth.users (id) values ('10000000-0000-0000-0000-0000000000f1'), ('10000000-0000-0000-0000-0000000000f2');
      insert into app_users (id, church_id, name, email, role, status) values ('10000000-0000-0000-0000-0000000000f1', '${CHURCH}', 'Newbie', 'n@e.test', 'member', 'active');
      insert into app_users (id, church_id, name, email, role, status) values ('10000000-0000-0000-0000-0000000000f2', '${CHURCH}', 'Invitee', 'i@e.test', 'member', 'invited');
    `);
    expect(await recipients("member.joined")).toEqual([ADMIN]);
    expect((await rows(`select count(*)::int as n from notifications where type = 'member.joined'`))[0].n).toBe(1);
    await db.exec(`update app_users set status = 'active' where id = '10000000-0000-0000-0000-0000000000f2'`);
    expect((await rows(`select count(*)::int as n from notifications where type = 'member.joined'`))[0].n).toBe(2);
  });
});

describe("privacy and permissions", () => {
  test("each person sees only their own notifications", async () => {
    await db.exec(`delete from notifications`);
    await db.exec(`insert into announcements (church_id, author_id, title, body, status) values ('${CHURCH}', '${ADMIN}', 'Hello', 'Body', 'published')`);
    for (const user of EVERYONE_IN_CHURCH.filter((u) => u !== ADMIN)) {
      const mine = await asUser(db, user, () => rows(`select user_id from notifications`));
      expect(mine.every((r) => r.user_id === user)).toBe(true);
      expect(mine.length).toBe(1);
    }
    expect(await asUser(db, ADMIN, () => rows(`select id from notifications`))).toEqual([]);
    expect(await asUser(db, SUPER, () => rows(`select id from notifications`))).toEqual([]);
  });

  test("nobody can create, rewrite or call the helpers directly", async () => {
    expect(
      await attempt(ALICE, `insert into notifications (user_id, category, type, title) values ($1, 'alerts', 'fake', 'Fake')`, [BOB]),
    ).toMatch(/row-level security|permission denied/);
    await asUser(db, ALICE, () => rows(`update notifications set title = 'Hacked'`));
    expect(await rows(`select id from notifications where title = 'Hacked'`)).toEqual([]);
    expect(await attempt(ALICE, `select app_private.notify(array[$1::uuid], null, 'alerts', 'fake', 'Fake', null, null, null)`, [BOB])).toMatch(
      /permission denied/,
    );
  });

  test("mark as read and clear only touch your own", async () => {
    const [{ n }] = await asUser(db, ALICE, () => rows(`select mark_notifications_read(null) as n`));
    expect(n).toBe(1);
    expect((await rows(`select read_at from notifications where user_id = $1`, [BOB]))[0].read_at).toBeNull();
    await asUser(db, ALICE, () => rows(`delete from notifications`));
    expect(await rows(`select id from notifications where user_id = $1`, [ALICE])).toEqual([]);
    expect((await rows(`select count(*)::int as n from notifications where user_id = $1`, [BOB]))[0].n).toBe(1);
  });

  test("push subscriptions are private; a shared device moves to whoever signs in", async () => {
    const endpoint = "https://push.example.test/device-1";
    await asUser(db, ALICE, () => rows(`select save_push_subscription($1, 'key', 'auth', 'Phone')`, [endpoint]));
    expect(await asUser(db, BOB, () => rows(`select id from push_subscriptions`))).toEqual([]);
    await asUser(db, BOB, () => rows(`select save_push_subscription($1, 'key2', 'auth2', 'Phone')`, [endpoint]));
    expect(await rows(`select user_id from push_subscriptions where endpoint = $1`, [endpoint])).toEqual([{ user_id: BOB }]);
    expect(await attempt(ALICE, `insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://x.test', 'k', 'a')`, [ALICE])).toMatch(
      /row-level security/,
    );
  });

  test("preferences are private", async () => {
    await asUser(db, ALICE, () => rows(`insert into notification_preferences (user_id, push_messages) values ($1, false)`, [ALICE]));
    expect(await asUser(db, BOB, () => rows(`select user_id from notification_preferences`))).toEqual([]);
    expect(await attempt(BOB, `insert into notification_preferences (user_id) values ($1)`, [ALICE])).toMatch(/row-level security/);
  });
});
