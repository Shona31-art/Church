import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// platform_hardening.sql. Each query runs as a real end user with RLS on —
// what someone could do from the browser console with the public anon key.

const CHURCH_A = "00000000-0000-0000-0000-00000000000a";
const CHURCH_B = "00000000-0000-0000-0000-00000000000b";
const DEPT_A = "30000000-0000-0000-0000-000000000001";
const ADMIN_A = "10000000-0000-0000-0000-000000000001";
const PASTOR_A = "10000000-0000-0000-0000-000000000002";
const MEMBER_A = "10000000-0000-0000-0000-000000000003";
const MEMBER2_A = "10000000-0000-0000-0000-000000000004";
const LEADER_A = "10000000-0000-0000-0000-000000000005";
const DISABLED_A = "10000000-0000-0000-0000-000000000006";
const MEMBER_B = "20000000-0000-0000-0000-000000000002";

let db: PGlite;

async function rows(sql: string, params: unknown[] = []) {
  return (await db.query<any>(sql, params)).rows;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH_A}', 'Church A'), ('${CHURCH_B}', 'Church B');
    insert into departments (id, church_id, name) values ('${DEPT_A}', '${CHURCH_A}', 'Youth');
    insert into auth.users (id) values ('${ADMIN_A}'), ('${PASTOR_A}'), ('${MEMBER_A}'), ('${MEMBER2_A}'),
      ('${LEADER_A}'), ('${DISABLED_A}'), ('${MEMBER_B}');
    insert into app_users (id, church_id, department_id, name, email, role, status) values
      ('${ADMIN_A}',    '${CHURCH_A}', null,        'Admin A',    'a@a.test',  'church_admin',      'active'),
      ('${PASTOR_A}',   '${CHURCH_A}', null,        'Pastor A',   'p@a.test',  'pastor',            'active'),
      ('${MEMBER_A}',   '${CHURCH_A}', null,        'Member A',   'm@a.test',  'member',            'active'),
      ('${MEMBER2_A}',  '${CHURCH_A}', null,        'Member2 A',  'm2@a.test', 'member',            'active'),
      ('${LEADER_A}',   '${CHURCH_A}', '${DEPT_A}', 'Leader A',   'l@a.test',  'department_leader', 'active'),
      ('${DISABLED_A}', '${CHURCH_A}', null,        'Disabled A', 'd@a.test',  'member',            'disabled'),
      ('${MEMBER_B}',   '${CHURCH_B}', null,        'Member B',   'm@b.test',  'member',            'active');
    insert into announcements (church_id, author_id, title, body) values ('${CHURCH_A}', '${PASTOR_A}', 'Welcome', 'Hello');
  `);
}, 120_000);

describe("disabled accounts lose access", () => {
  test("a disabled member can't read church announcements", async () => {
    const seen = await asUser(db, DISABLED_A, () => rows(`select id from announcements`));
    expect(seen).toHaveLength(0);
  });

  test("…but can still read their own profile (so the app can explain why)", async () => {
    const me = await asUser(db, DISABLED_A, () => rows(`select status from app_users where id = $1`, [DISABLED_A]));
    expect(me).toEqual([{ status: "disabled" }]);
  });

  test("a disabled member can't see other members", async () => {
    const others = await asUser(db, DISABLED_A, () => rows(`select id from app_users where id <> $1`, [DISABLED_A]));
    expect(others).toHaveLength(0);
  });
});

describe("direct messages", () => {
  let dm: string;

  test("a member can start a DM with someone in their church", async () => {
    const [{ id }] = await asUser(db, MEMBER_A, () => rows(`select start_direct_message($1) as id`, [MEMBER2_A]));
    dm = id;
    expect(dm).toBeTruthy();
  });

  test("starting again reuses the same conversation", async () => {
    const [{ id }] = await asUser(db, MEMBER2_A, () => rows(`select start_direct_message($1) as id`, [MEMBER_A]));
    expect(id).toBe(dm);
  });

  test("a member can't start a DM with someone in another church", async () => {
    await expect(asUser(db, MEMBER_A, () => rows(`select start_direct_message($1)`, [MEMBER_B]))).rejects.toThrow();
  });

  test("nobody can add themselves to someone else's DM", async () => {
    await expect(
      asUser(db, PASTOR_A, () =>
        rows(`insert into chat_channel_members (channel_id, user_id) values ($1, $2)`, [dm, PASTOR_A])
      )
    ).rejects.toThrow();
  });

  test("an outsider can't read the DM, and listing memberships doesn't error", async () => {
    await asUser(db, MEMBER_A, () =>
      rows(`insert into chat_messages (channel_id, sender_id, content) values ($1, $2, 'private')`, [dm, MEMBER_A])
    );
    const seen = await asUser(db, PASTOR_A, () => rows(`select id from chat_messages where channel_id = $1`, [dm]));
    expect(seen).toHaveLength(0);
    const mine = await asUser(db, MEMBER_A, () => rows(`select user_id from chat_channel_members where channel_id = $1`, [dm]));
    expect(mine).toHaveLength(2);
  });
});

describe("AI counseling escalation", () => {
  let convo: string;

  beforeAll(async () => {
    [{ id: convo }] = await asUser(db, MEMBER_A, () =>
      rows(`insert into counseling_conversations (church_id, member_id) values ($1, $2) returning id`, [CHURCH_A, MEMBER_A])
    );
  });

  test("a member can share their conversation with a pastor", async () => {
    const updated = await asUser(db, MEMBER_A, () =>
      rows(`update counseling_conversations set shared_with_pastor = true, shared_at = now() where id = $1 returning id`, [convo])
    );
    expect(updated).toHaveLength(1);
  });

  test("a member can't clear a crisis flag set by the system", async () => {
    await db.exec(`update counseling_conversations set flagged = true where id = '${convo}'`);
    await expect(
      asUser(db, MEMBER_A, () => rows(`update counseling_conversations set flagged = false where id = $1`, [convo]))
    ).rejects.toThrow();
  });

  test("a member can't write a message pretending to be the assistant", async () => {
    await expect(
      asUser(db, MEMBER_A, () =>
        rows(`insert into counseling_messages (conversation_id, sender, content) values ($1, 'assistant', 'fake')`, [convo])
      )
    ).rejects.toThrow();
  });

  test("a pastor can acknowledge an escalation; another member can't", async () => {
    const [{ id }] = await rows(
      `insert into counseling_escalations (conversation_id, notified_user_id) values ($1, $2) returning id`,
      [convo, PASTOR_A]
    );
    const byMember = await asUser(db, MEMBER2_A, () =>
      rows(`update counseling_escalations set acknowledged_at = now() where id = $1 returning id`, [id])
    );
    expect(byMember).toHaveLength(0);
    const byPastor = await asUser(db, PASTOR_A, () =>
      rows(`update counseling_escalations set acknowledged_at = now() where id = $1 returning id`, [id])
    );
    expect(byPastor).toHaveLength(1);
  });
});

describe("events and RSVPs", () => {
  let event: string;
  let deptEvent: string;

  beforeAll(async () => {
    [{ id: event }] = await rows(
      `insert into events (church_id, created_by, title, start_time) values ($1, $2, 'Picnic', '2030-01-01T10:00Z') returning id`,
      [CHURCH_A, PASTOR_A]
    );
    [{ id: deptEvent }] = await asUser(db, LEADER_A, () =>
      rows(
        `insert into events (church_id, department_id, created_by, title, start_time) values ($1, $2, $3, 'Youth night', '2030-01-02T18:00Z') returning id`,
        [CHURCH_A, DEPT_A, LEADER_A]
      )
    );
  });

  test("a member of another church can't RSVP by guessing the event id", async () => {
    await expect(
      asUser(db, MEMBER_B, () => rows(`insert into event_rsvps (event_id, user_id, status) values ($1, $2, 'going')`, [event, MEMBER_B]))
    ).rejects.toThrow();
  });

  test("a member can RSVP and then remove their RSVP", async () => {
    await asUser(db, MEMBER_A, () => rows(`insert into event_rsvps (event_id, user_id, status) values ($1, $2, 'going')`, [event, MEMBER_A]));
    const removed = await asUser(db, MEMBER_A, () =>
      rows(`delete from event_rsvps where event_id = $1 and user_id = $2 returning user_id`, [event, MEMBER_A])
    );
    expect(removed).toHaveLength(1);
  });

  test("nobody can RSVP to a cancelled event", async () => {
    await db.exec(`update events set cancelled_at = now() where id = '${event}'`);
    await expect(
      asUser(db, MEMBER2_A, () => rows(`insert into event_rsvps (event_id, user_id, status) values ($1, $2, 'going')`, [event, MEMBER2_A]))
    ).rejects.toThrow();
  });

  test("a department leader can't turn their event into a church-wide one", async () => {
    await expect(
      asUser(db, LEADER_A, () => rows(`update events set department_id = null where id = $1`, [deptEvent]))
    ).rejects.toThrow();
  });
});

describe("announcements: drafts and safe edits", () => {
  let draft: string;
  let leaderPost: string;

  beforeAll(async () => {
    [{ id: draft }] = await asUser(db, PASTOR_A, () =>
      rows(`insert into announcements (church_id, author_id, title, body, status) values ($1, $2, 'Draft', 'x', 'draft') returning id`, [CHURCH_A, PASTOR_A])
    );
    [{ id: leaderPost }] = await asUser(db, LEADER_A, () =>
      rows(
        `insert into announcements (church_id, department_id, author_id, title, body) values ($1, $2, $3, 'Youth', 'x') returning id`,
        [CHURCH_A, DEPT_A, LEADER_A]
      )
    );
  });

  test("members can't see drafts", async () => {
    const seen = await asUser(db, MEMBER_A, () => rows(`select id from announcements where id = $1`, [draft]));
    expect(seen).toHaveLength(0);
  });

  test("the church admin can see a pastor's draft", async () => {
    const seen = await asUser(db, ADMIN_A, () => rows(`select id from announcements where id = $1`, [draft]));
    expect(seen).toHaveLength(1);
  });

  test("a department leader can't widen their post to the whole church or pin it", async () => {
    await expect(
      asUser(db, LEADER_A, () => rows(`update announcements set department_id = null where id = $1`, [leaderPost]))
    ).rejects.toThrow();
    await expect(
      asUser(db, LEADER_A, () => rows(`update announcements set pinned = true where id = $1`, [leaderPost]))
    ).rejects.toThrow();
  });
});

describe("plan catalogue can't be edited by churches", () => {
  test("a church admin can't add premium modules to their plan", async () => {
    await expect(
      asUser(db, ADMIN_A, () => rows(`insert into plan_modules (plan_key, module_key) values ('free_trial', 'service_planner')`))
    ).rejects.toThrow();
  });

  test("a member can't change plan prices, but can read them", async () => {
    const changed = await asUser(db, MEMBER_A, () => rows(`update plans set monthly_price = 0 where key = 'premium' returning key`));
    expect(changed).toHaveLength(0);
    const readable = await asUser(db, MEMBER_A, () => rows(`select key from plans`));
    expect(readable.length).toBeGreaterThan(0);
  });
});

describe("booking cancellation", () => {
  const insert = (status: string) =>
    rows(
      `insert into pastor_bookings (church_id, requested_by, booking_type, preferred_date, status)
       values ($1, $2, 'baptism', '2030-01-01', $3) returning id`,
      [CHURCH_A, MEMBER_A, status]
    );

  test("the requester can cancel their pending request", async () => {
    const [{ id }] = await insert("pending");
    const [{ ok }] = await asUser(db, MEMBER_A, () => rows(`select cancel_booking_request($1) as ok`, [id]));
    expect(ok).toBe(true);
  });

  test("someone else can't cancel it", async () => {
    const [{ id }] = await insert("pending");
    const [{ ok }] = await asUser(db, MEMBER2_A, () => rows(`select cancel_booking_request($1) as ok`, [id]));
    expect(ok).toBe(false);
  });

  test("a declined request can't be cancelled (the decision stands)", async () => {
    const [{ id }] = await insert("declined");
    const [{ ok }] = await asUser(db, MEMBER_A, () => rows(`select cancel_booking_request($1) as ok`, [id]));
    expect(ok).toBe(false);
  });
});
