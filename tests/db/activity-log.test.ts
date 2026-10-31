import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// Automatic audit trail (activity_log.sql, migration #42).

const CHURCH_A = "00000000-0000-0000-0000-00000000000a";
const ADMIN_A = "10000000-0000-0000-0000-000000000001";
const MEMBER_A = "10000000-0000-0000-0000-000000000003";
const SUPER = "90000000-0000-0000-0000-000000000009";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH_A}', 'Church A');
    insert into auth.users (id) values ('${ADMIN_A}'), ('${MEMBER_A}'), ('${SUPER}');
    insert into app_users (id, church_id, name, email, role) values
      ('${ADMIN_A}',  '${CHURCH_A}', 'Admin A',  'a@a.test', 'church_admin'),
      ('${MEMBER_A}', '${CHURCH_A}', 'Member A', 'm@a.test', 'member'),
      ('${SUPER}', null, 'Platform', 'p@p.test', 'super_admin');
  `);
}, 120_000);

describe("automatic audit trail", () => {
  test("adding, editing and deleting a department are each recorded with who and which church", async () => {
    await asUser(db, ADMIN_A, () => rows(`insert into departments (church_id, name) values ($1, 'Youth')`, [CHURCH_A]));
    await asUser(db, ADMIN_A, () => rows(`update departments set name = 'Youth Ministry' where church_id = $1`, [CHURCH_A]));
    await asUser(db, ADMIN_A, () => rows(`delete from departments where church_id = $1`, [CHURCH_A]));

    const log = await rows(`select action, church_id, actor_id, metadata from audit_logs where target_table = 'departments' order by created_at, action`);
    expect(log.map((l) => l.action).sort()).toEqual(["department.created", "department.deleted", "department.updated"]);
    for (const l of log) {
      expect(l.church_id).toBe(CHURCH_A);
      expect(l.actor_id).toBe(ADMIN_A);
      expect(l.metadata.auto).toBe(true);
    }
    expect(log.find((l) => l.action === "department.updated").metadata.changed).toEqual(["name"]);
  });

  test("edits record which fields changed, never the values", async () => {
    await asUser(db, MEMBER_A, () => rows(`update app_users set phone = '082 555 0000' where id = $1`, [MEMBER_A]));
    const [entry] = await rows(`select metadata from audit_logs where action = 'member.updated' and actor_id = $1`, [MEMBER_A]);
    expect(entry.metadata.changed).toEqual(["phone"]);
    expect(JSON.stringify(entry.metadata)).not.toContain("555");
  });

  test("server/system writes (no signed-in person) aren't double-logged", async () => {
    const before = (await rows(`select count(*)::int as n from audit_logs`))[0].n;
    await rows(`insert into departments (church_id, name) values ($1, 'Choir')`, [CHURCH_A]);
    expect((await rows(`select count(*)::int as n from audit_logs`))[0].n).toBe(before);
  });

  test("only the platform admin sees every church's log; members see none", async () => {
    expect((await asUser(db, SUPER, () => rows(`select count(*)::int as n from audit_logs`)))[0].n).toBeGreaterThan(0);
    expect(await asUser(db, MEMBER_A, () => rows(`select * from audit_logs`))).toEqual([]);
  });

  test("nobody can forge log entries from the browser", async () => {
    await expect(asUser(db, ADMIN_A, () => rows(`insert into audit_logs (church_id, action) values ($1, 'auth.signed_in')`, [CHURCH_A]))).rejects.toThrow();
  });
});
