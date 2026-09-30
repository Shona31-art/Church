import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// Row Level Security tests: each query runs as a real end user (RLS on), so
// these prove what a member could do with the public anon key from a browser
// console — not just what our UI happens to show.

const CHURCH_A = "00000000-0000-0000-0000-00000000000a";
const CHURCH_B = "00000000-0000-0000-0000-00000000000b";
const ADMIN_A = "10000000-0000-0000-0000-000000000001";
const PASTOR_A = "10000000-0000-0000-0000-000000000002";
const MEMBER_A = "10000000-0000-0000-0000-000000000003";
const MEMBER2_A = "10000000-0000-0000-0000-000000000004";
const PASTOR_B = "20000000-0000-0000-0000-000000000001";
const MEMBER_B = "20000000-0000-0000-0000-000000000002";

let db: PGlite;

async function rows(sql: string, params: unknown[] = []) {
  return (await db.query<any>(sql, params)).rows;
}

beforeAll(async () => {
  db = await createTestDb();
  // Seed as the service role (no user session → RLS bypassed as superuser).
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH_A}', 'Church A'), ('${CHURCH_B}', 'Church B');
    insert into auth.users (id) values ('${ADMIN_A}'), ('${PASTOR_A}'), ('${MEMBER_A}'), ('${MEMBER2_A}'), ('${PASTOR_B}'), ('${MEMBER_B}');
    insert into app_users (id, church_id, name, email, role) values
      ('${ADMIN_A}',   '${CHURCH_A}', 'Admin A',   'a@a.test',  'church_admin'),
      ('${PASTOR_A}',  '${CHURCH_A}', 'Pastor A',  'p@a.test',  'pastor'),
      ('${MEMBER_A}',  '${CHURCH_A}', 'Member A',  'm@a.test',  'member'),
      ('${MEMBER2_A}', '${CHURCH_A}', 'Member2 A', 'm2@a.test', 'member'),
      ('${PASTOR_B}',  '${CHURCH_B}', 'Pastor B',  'p@b.test',  'pastor'),
      ('${MEMBER_B}',  '${CHURCH_B}', 'Member B',  'm@b.test',  'member');
  `);
}, 120_000);

describe("app_users — privilege escalation is blocked", () => {
  test("a member cannot promote themselves to church_admin", async () => {
    await expect(
      asUser(db, MEMBER_A, () => rows(`update app_users set role = 'church_admin' where id = $1`, [MEMBER_A]))
    ).rejects.toThrow();
  });

  test("a member cannot make themselves super_admin", async () => {
    await expect(
      asUser(db, MEMBER_A, () =>
        rows(`update app_users set role = 'super_admin', church_id = null where id = $1`, [MEMBER_A])
      )
    ).rejects.toThrow();
  });

  test("a member cannot move themselves into another church", async () => {
    await expect(
      asUser(db, MEMBER_A, () => rows(`update app_users set church_id = $1 where id = $2`, [CHURCH_B, MEMBER_A]))
    ).rejects.toThrow();
  });

  test("a member can still edit their own name and phone", async () => {
    const updated = await asUser(db, MEMBER_A, () =>
      rows(`update app_users set name = 'Member A Renamed', phone = '082' where id = $1 returning id`, [MEMBER_A])
    );
    expect(updated).toHaveLength(1);
  });

  test("a member cannot edit someone else's row", async () => {
    const updated = await asUser(db, MEMBER_A, () =>
      rows(`update app_users set name = 'hacked' where id = $1 returning id`, [MEMBER2_A])
    );
    expect(updated).toHaveLength(0);
  });

  test("a pastor can change a member's role (the old policy silently blocked this)", async () => {
    const updated = await asUser(db, PASTOR_A, () =>
      rows(`update app_users set role = 'department_leader' where id = $1 returning role`, [MEMBER2_A])
    );
    expect(updated).toEqual([{ role: "department_leader" }]);
  });

  test("a pastor cannot grant church_admin", async () => {
    await expect(
      asUser(db, PASTOR_A, () => rows(`update app_users set role = 'church_admin' where id = $1`, [MEMBER2_A]))
    ).rejects.toThrow(/church admin/i);
  });

  test("a church_admin can grant church_admin", async () => {
    const updated = await asUser(db, ADMIN_A, () =>
      rows(`update app_users set role = 'church_admin' where id = $1 returning role`, [MEMBER2_A])
    );
    expect(updated).toEqual([{ role: "church_admin" }]);
    await db.exec(`update app_users set role = 'member' where id = '${MEMBER2_A}'`); // reset
  });

  test("a pastor cannot change their own role", async () => {
    await expect(
      asUser(db, PASTOR_A, () => rows(`update app_users set role = 'church_admin' where id = $1`, [PASTOR_A]))
    ).rejects.toThrow();
  });

  test("a pastor in church B cannot touch church A's members", async () => {
    const updated = await asUser(db, PASTOR_B, () =>
      rows(`update app_users set status = 'disabled' where id = $1 returning id`, [MEMBER_A])
    );
    expect(updated).toHaveLength(0);
  });

  test("members cannot see another church's people", async () => {
    const visible = await asUser(db, MEMBER_B, () => rows(`select id from app_users where church_id = $1`, [CHURCH_A]));
    expect(visible).toHaveLength(0);
  });
});

describe("pastoral_care_logs — pastors and admins of that church only", () => {
  beforeAll(async () => {
    await db.exec(`
      insert into pastoral_care_logs (church_id, member_id, member_name, log_type, notes, created_by)
      values ('${CHURCH_A}', '${MEMBER_A}', 'Member A', 'hospital_visit', 'confidential note', '${PASTOR_A}');
    `);
  });

  test("the pastor and admin of the church can read care notes", async () => {
    expect(await asUser(db, PASTOR_A, () => rows(`select notes from pastoral_care_logs`))).toHaveLength(1);
    expect(await asUser(db, ADMIN_A, () => rows(`select notes from pastoral_care_logs`))).toHaveLength(1);
  });

  test("the member the note is ABOUT cannot read it", async () => {
    expect(await asUser(db, MEMBER_A, () => rows(`select notes from pastoral_care_logs`))).toHaveLength(0);
  });

  test("another church's pastor cannot read it", async () => {
    expect(await asUser(db, PASTOR_B, () => rows(`select notes from pastoral_care_logs`))).toHaveLength(0);
  });

  test("a member cannot create care notes", async () => {
    await expect(
      asUser(db, MEMBER_A, () =>
        rows(
          `insert into pastoral_care_logs (church_id, member_name, log_type, notes, created_by)
           values ($1, 'x', 'other', 'x', $2)`,
          [CHURCH_A, MEMBER_A]
        )
      )
    ).rejects.toThrow();
  });
});

describe("member_birthdays — self and shepherds only", () => {
  beforeAll(async () => {
    await db.exec(`
      insert into member_birthdays (user_id, church_id, birth_date) values
        ('${MEMBER_A}', '${CHURCH_A}', '1990-05-01'),
        ('${MEMBER2_A}', '${CHURCH_A}', '1985-12-24');
    `);
  });

  test("a member sees only their own birthday", async () => {
    const visible = await asUser(db, MEMBER_A, () => rows(`select user_id from member_birthdays`));
    expect(visible).toEqual([{ user_id: MEMBER_A }]);
  });

  test("a pastor sees every birthday in their church", async () => {
    expect(await asUser(db, PASTOR_A, () => rows(`select user_id from member_birthdays`))).toHaveLength(2);
  });

  test("another church's pastor sees none", async () => {
    expect(await asUser(db, PASTOR_B, () => rows(`select user_id from member_birthdays`))).toHaveLength(0);
  });
});

describe("prayer board & wall", () => {
  let privateId: string;
  let sharedId: string;

  beforeAll(async () => {
    const created = await rows(
      `insert into prayer_board_items (church_id, user_id, prayer_text, is_shared_request) values
         ($1, $2, 'private prayer', false),
         ($1, $2, 'shared prayer', true)
       returning id, is_shared_request`,
      [CHURCH_A, MEMBER_A]
    );
    privateId = created.find((r) => !r.is_shared_request).id;
    sharedId = created.find((r) => r.is_shared_request).id;
  });

  test("a private prayer is invisible to others in the same church", async () => {
    const visible = await asUser(db, MEMBER2_A, () => rows(`select id from prayer_board_items where id = $1`, [privateId]));
    expect(visible).toHaveLength(0);
  });

  test("a shared prayer is visible to the church, not to other churches", async () => {
    expect(await asUser(db, MEMBER2_A, () => rows(`select id from prayer_board_items where id = $1`, [sharedId]))).toHaveLength(1);
    expect(await asUser(db, MEMBER_B, () => rows(`select id from prayer_board_items where id = $1`, [sharedId]))).toHaveLength(0);
  });

  test("members can comment on a shared prayer but not a private one", async () => {
    const ok = await asUser(db, MEMBER2_A, () =>
      rows(`insert into prayer_comments (prayer_id, church_id, user_id, body) values ($1, $2, $3, 'praying!') returning id`, [
        sharedId, CHURCH_A, MEMBER2_A,
      ])
    );
    expect(ok).toHaveLength(1);

    await expect(
      asUser(db, MEMBER2_A, () =>
        rows(`insert into prayer_comments (prayer_id, church_id, user_id, body) values ($1, $2, $3, 'peek')`, [
          privateId, CHURCH_A, MEMBER2_A,
        ])
      )
    ).rejects.toThrow();
  });

  test("nobody can record an 'I prayed' as someone else", async () => {
    await expect(
      asUser(db, MEMBER2_A, () =>
        rows(`insert into prayer_intercessions (prayer_id, user_id, church_id) values ($1, $2, $3)`, [sharedId, MEMBER_A, CHURCH_A])
      )
    ).rejects.toThrow();
  });

  test("a member cannot push their prayer into another church (church_id is frozen)", async () => {
    await expect(
      asUser(db, MEMBER_A, () => rows(`update prayer_board_items set church_id = $1 where id = $2`, [CHURCH_B, sharedId]))
    ).rejects.toThrow(/church_id/);
  });

  test("a pastor can take a prayer off the wall but cannot rewrite it", async () => {
    // A direct UPDATE by a pastor matches no rows (no policy lets them update).
    const edited = await asUser(db, PASTOR_A, () =>
      rows(`update prayer_board_items set prayer_text = 'edited' where id = $1 returning id`, [sharedId])
    );
    expect(edited).toHaveLength(0);

    // The moderation function only switches sharing off.
    const [{ ok }] = await asUser(db, PASTOR_A, () => rows(`select unshare_prayer($1) as ok`, [sharedId]));
    expect(ok).toBe(true);
    expect(await rows(`select is_shared_request, prayer_text from prayer_board_items where id = $1`, [sharedId])).toEqual([
      { is_shared_request: false, prayer_text: "shared prayer" },
    ]);
    await db.exec(`update prayer_board_items set is_shared_request = true where id = '${sharedId}'`); // reset
  });

  test("a member can't use the moderation function, nor a pastor from another church", async () => {
    expect((await asUser(db, MEMBER2_A, () => rows(`select unshare_prayer($1) as ok`, [sharedId])))[0].ok).toBe(false);
    expect((await asUser(db, PASTOR_B, () => rows(`select unshare_prayer($1) as ok`, [sharedId])))[0].ok).toBe(false);
    expect(await rows(`select is_shared_request from prayer_board_items where id = $1`, [sharedId])).toEqual([
      { is_shared_request: true },
    ]);
  });

  test("a member cannot edit someone else's prayer", async () => {
    const updated = await asUser(db, MEMBER2_A, () =>
      rows(`update prayer_board_items set prayer_text = 'x' where id = $1 returning id`, [sharedId])
    );
    expect(updated).toHaveLength(0);
  });
});

describe("journal privacy (existing guarantee still holds)", () => {
  test("a pastor cannot read a member's journal rows", async () => {
    await db.exec(`
      insert into journal_entries (church_id, user_id, encrypted_content, iv, auth_tag)
      values ('${CHURCH_A}', '${MEMBER_A}', '\\x00', '\\x00', '\\x00');
    `);
    expect(await asUser(db, PASTOR_A, () => rows(`select id from journal_entries`))).toHaveLength(0);
    expect(await asUser(db, MEMBER_A, () => rows(`select id from journal_entries`))).toHaveLength(1);
  });
});

describe("audit_logs", () => {
  test("end users cannot write audit entries (only trusted server code can)", async () => {
    await expect(
      asUser(db, ADMIN_A, () =>
        rows(`insert into audit_logs (church_id, actor_id, action) values ($1, $2, 'forged')`, [CHURCH_A, ADMIN_A])
      )
    ).rejects.toThrow();
  });
});

describe("member deletion / POPIA erasure", () => {
  test("a member with givings, chats and authored content can be deleted", async () => {
    const GONE = "30000000-0000-0000-0000-000000000009";
    await db.exec(`
      insert into auth.users (id) values ('${GONE}');
      insert into app_users (id, church_id, name, email, role) values ('${GONE}', '${CHURCH_A}', 'Leaving', 'l@a.test', 'pastor');
      insert into announcements (church_id, author_id, title, body) values ('${CHURCH_A}', '${GONE}', 't', 'b');
      insert into pastoral_care_logs (church_id, member_name, log_type, notes, created_by)
        values ('${CHURCH_A}', 'x', 'other', 'n', '${GONE}');
      insert into prayer_board_items (church_id, user_id, prayer_text) values ('${CHURCH_A}', '${GONE}', 'p');
    `);
    await db.exec(`insert into givings (church_id, user_id, amount_cents, fund) values ('${CHURCH_A}', '${GONE}', 10000, 'erasure-test')`);

    // Deleting the auth user is what the app does (cascades to app_users).
    await db.exec(`delete from auth.users where id = '${GONE}'`);
    await db.exec(`delete from app_users where id = '${GONE}'`);

    expect(await rows(`select id from app_users where id = $1`, [GONE])).toHaveLength(0);
    expect(await rows(`select author_id from announcements where title = 't'`)).toEqual([{ author_id: null }]);
    expect(await rows(`select id from prayer_board_items where prayer_text = 'p'`)).toHaveLength(0);
    // Giving record kept for financial retention, but no longer linked to the person.
    expect(await rows(`select user_id from givings where fund = 'erasure-test'`)).toEqual([{ user_id: null }]);
  });
});
