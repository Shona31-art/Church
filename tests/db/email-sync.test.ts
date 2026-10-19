import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// Email change (email_sync.sql, migration #33). Supabase Auth changes
// auth.users.email once the change is confirmed; the app's copy follows.

const CHURCH = "00000000-0000-0000-0000-00000000000a";
const MEMBER = "10000000-0000-0000-0000-000000000003";
const OTHER = "10000000-0000-0000-0000-000000000004";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'KAMI');
    insert into auth.users (id, email) values ('${MEMBER}', 'videshin@gmail.com'), ('${OTHER}', 'other@x.test');
    insert into app_users (id, church_id, name, email, role) values
      ('${MEMBER}', '${CHURCH}', 'Member', 'videshin@gmail.com', 'member'),
      ('${OTHER}',  '${CHURCH}', 'Other',  'other@x.test',       'member');
  `);
}, 120_000);

describe("sign-in email → app_users.email", () => {
  test("when Supabase confirms a new email, the app's copy follows (lower-cased) and it's audit-logged, masked", async () => {
    // Supabase Auth does this itself (no user session), like the service role here.
    await asUser(db, null, () => rows(`update auth.users set email = 'New.Address@Example.com' where id = $1`, [MEMBER]));
    expect(await rows(`select email from app_users where id = $1`, [MEMBER])).toEqual([{ email: "new.address@example.com" }]);
    const [audit] = await rows(`select church_id, actor_id, metadata from audit_logs where action = 'account.email_changed'`);
    expect(audit).toEqual({ church_id: CHURCH, actor_id: MEMBER, metadata: { from: "vi***@gmail.com", to: "Ne***@Example.com" } });
  });

  test("other people's rows and unrelated auth updates are untouched", async () => {
    await asUser(db, null, () => rows(`update auth.users set email = 'NEW.ADDRESS@example.com' where id = $1`, [MEMBER])); // case-only change
    expect(await rows(`select count(*)::int as n from audit_logs where action = 'account.email_changed'`)).toEqual([{ n: 1 }]);
    expect(await rows(`select email from app_users where id = $1`, [OTHER])).toEqual([{ email: "other@x.test" }]);
  });

  test("members still can't change app_users.email directly", async () => {
    await expect(asUser(db, MEMBER, () => rows(`update app_users set email = 'sneaky@x.test' where id = $1`, [MEMBER]))).rejects.toThrow(/account settings/);
  });
});
