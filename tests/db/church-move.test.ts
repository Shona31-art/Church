import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// Moving a member to another church (church_move.sql, migration #32): the old
// church stops seeing the person's own information; its records stay.

const OLD = "00000000-0000-0000-0000-00000000000a";
const NEW = "00000000-0000-0000-0000-00000000000b";
const OLD_PASTOR = "10000000-0000-0000-0000-000000000001";
const NEW_PASTOR = "20000000-0000-0000-0000-000000000001";
const OLD_MEMBER = "10000000-0000-0000-0000-000000000009";
const MOVER = "30000000-0000-0000-0000-000000000003";
const SUPER = "90000000-0000-0000-0000-000000000001";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${OLD}', 'Old church'), ('${NEW}', 'New church');
    insert into auth.users (id) values ('${OLD_PASTOR}'), ('${NEW_PASTOR}'), ('${OLD_MEMBER}'), ('${MOVER}'), ('${SUPER}');
    insert into app_users (id, church_id, name, email, role) values
      ('${OLD_PASTOR}', '${OLD}', 'Old Pastor', 'op@x.test', 'pastor'),
      ('${NEW_PASTOR}', '${NEW}', 'New Pastor', 'np@x.test', 'pastor'),
      ('${OLD_MEMBER}', '${OLD}', 'Stays',      'st@x.test', 'member'),
      ('${MOVER}',      '${OLD}', 'Mover',      'mv@x.test', 'member'),
      ('${SUPER}',      null,     'Platform',   'pa@x.test', 'super_admin');

    insert into member_birthdays (user_id, church_id, birth_date) values ('${MOVER}', '${OLD}', '1990-05-17');
    insert into prayer_board_items (church_id, user_id, prayer_text, is_shared_request) values
      ('${OLD}', '${MOVER}', 'Shared request', true),
      ('${OLD}', '${MOVER}', 'Private prayer', false);
    insert into pastor_bookings (church_id, requested_by, booking_type, preferred_date, status) values
      ('${OLD}', '${MOVER}', 'counselling', '${day(7)}',   'pending'),
      ('${OLD}', '${MOVER}', 'baptism',     '${day(14)}',  'approved'),
      ('${OLD}', '${MOVER}', 'wedding',     '${day(-30)}', 'completed'),
      ('${OLD}', '${OLD_MEMBER}', 'other',  '${day(7)}',   'pending');
    insert into events (id, church_id, created_by, title, start_time) values
      ('50000000-0000-0000-0000-000000000001', '${OLD}', '${OLD_PASTOR}', 'Next Sunday', now() + interval '3 days'),
      ('50000000-0000-0000-0000-000000000002', '${OLD}', '${OLD_PASTOR}', 'Last Sunday', now() - interval '3 days');
    insert into event_rsvps (event_id, user_id, status) values
      ('50000000-0000-0000-0000-000000000001', '${MOVER}', 'going'),
      ('50000000-0000-0000-0000-000000000002', '${MOVER}', 'going'),
      ('50000000-0000-0000-0000-000000000001', '${OLD_MEMBER}', 'going');
  `);
  // The platform admin moves the person (the only role allowed to).
  await asUser(db, SUPER, () => rows(`update app_users set church_id = $1 where id = $2`, [NEW, MOVER]));
}, 120_000);

describe("after a member moves church", () => {
  test("their birthday moves: the old pastors no longer see it, the new pastors do", async () => {
    expect(await asUser(db, OLD_PASTOR, () => rows(`select * from member_birthdays where user_id = $1`, [MOVER]))).toEqual([]);
    const seen = await asUser(db, NEW_PASTOR, () => rows(`select birth_date::text as d, church_id from member_birthdays where user_id = $1`, [MOVER]));
    expect(seen).toEqual([{ d: "1990-05-17", church_id: NEW }]);
  });

  test("shared prayers leave the old wall but stay on the person's own board; nothing is deleted", async () => {
    expect(await asUser(db, OLD_MEMBER, () => rows(`select * from prayer_board_items where user_id = $1`, [MOVER]))).toEqual([]);
    const own = await asUser(db, MOVER, () => rows(`select prayer_text, is_shared_request from prayer_board_items order by prayer_text`));
    expect(own).toEqual([
      { prayer_text: "Private prayer", is_shared_request: false },
      { prayer_text: "Shared request", is_shared_request: false },
    ]);
  });

  test("upcoming bookings are cancelled; past ones and other people's are untouched", async () => {
    const mine = await rows(`select booking_type, status from pastor_bookings where requested_by = $1 order by booking_type`, [MOVER]);
    expect(mine).toEqual([
      { booking_type: "baptism", status: "cancelled" },
      { booking_type: "counselling", status: "cancelled" },
      { booking_type: "wedding", status: "completed" },
    ]);
    const others = await rows(`select status from pastor_bookings where requested_by = $1`, [OLD_MEMBER]);
    expect(others).toEqual([{ status: "pending" }]);
    // Cancelling is silent: no "booking decided" notification to anyone.
    expect(await rows(`select * from notifications where type = 'booking.decided'`)).toEqual([]);
  });

  test("RSVPs to upcoming old-church events go; past attendance and other people's stay", async () => {
    const left = await rows(`select event_id, user_id from event_rsvps order by event_id, user_id`);
    expect(left).toEqual([
      { event_id: "50000000-0000-0000-0000-000000000001", user_id: OLD_MEMBER },
      { event_id: "50000000-0000-0000-0000-000000000002", user_id: MOVER },
    ]);
  });

  test("one audit entry records what changed", async () => {
    const audit = await rows(`select church_id, actor_id, metadata from audit_logs where action = 'user.church_move_cleanup'`);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ church_id: OLD, actor_id: SUPER });
    expect(audit[0].metadata).toMatchObject({ to_church_id: NEW, birthday_moved: true, prayers_unshared: 1, bookings_cancelled: 2, rsvps_removed: 1 });
  });

  test("saving the person again without changing church does nothing more", async () => {
    await asUser(db, SUPER, () => rows(`update app_users set name = 'Mover Renamed', church_id = $1 where id = $2`, [NEW, MOVER]));
    expect(await rows(`select count(*)::int as n from audit_logs where action = 'user.church_move_cleanup'`)).toEqual([{ n: 1 }]);
  });
});
