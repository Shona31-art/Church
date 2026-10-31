import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// Pastor alerts (pastor_alerts.sql, migration #43).

const CHURCH_A = "00000000-0000-0000-0000-00000000000a";
const ADMIN_A = "10000000-0000-0000-0000-000000000001";
const PASTOR_A = "10000000-0000-0000-0000-000000000002";
const MEMBER_A = "10000000-0000-0000-0000-000000000003";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
const alertsFor = (type: string) => rows(`select user_id from notifications where type = $1 order by user_id`, [type]);

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH_A}', 'Church A');
    insert into auth.users (id) values ('${ADMIN_A}'), ('${PASTOR_A}'), ('${MEMBER_A}');
    insert into app_users (id, church_id, name, email, role) values
      ('${ADMIN_A}',  '${CHURCH_A}', 'Admin A',  'a@a.test', 'church_admin'),
      ('${PASTOR_A}', '${CHURCH_A}', 'Pastor A', 'p@a.test', 'pastor'),
      ('${MEMBER_A}', '${CHURCH_A}', 'Member A', 'm@a.test', 'member');
  `);
}, 120_000);

describe("pastor alerts", () => {
  test("a private prayer doesn't alert anyone; sharing it on the wall alerts pastors and admins", async () => {
    const [p] = await rows(`insert into prayer_board_items (church_id, user_id, prayer_text) values ($1, $2, 'For my family') returning id`, [CHURCH_A, MEMBER_A]);
    expect(await alertsFor("prayer.requested")).toEqual([]);
    await rows(`update prayer_board_items set is_shared_request = true where id = $1`, [p.id]);
    expect((await alertsFor("prayer.requested")).map((r) => r.user_id)).toEqual([ADMIN_A, PASTOR_A]);
  });

  test("sharing a counseling conversation alerts pastors and admins once", async () => {
    const [c] = await rows(`insert into counseling_conversations (church_id, member_id) values ($1, $2) returning id`, [CHURCH_A, MEMBER_A]);
    await rows(`update counseling_conversations set shared_with_pastor = true where id = $1`, [c.id]);
    await rows(`update counseling_conversations set shared_with_pastor = true where id = $1`, [c.id]);
    const alerts = await rows(`select user_id, link from notifications where type = 'counseling.shared' order by user_id`);
    expect(alerts.map((r) => r.user_id)).toEqual([ADMIN_A, PASTOR_A]);
    expect(alerts[0].link).toBe(`/dashboard/counseling/${c.id}`);
  });

  test("each person can switch WhatsApp alerts off for themselves only", async () => {
    await asUser(db, PASTOR_A, () => rows(`insert into notification_preferences (user_id, whatsapp_alerts) values ($1, false)`, [PASTOR_A]));
    expect((await rows(`select whatsapp_alerts from notification_preferences where user_id = $1`, [PASTOR_A]))[0]).toEqual({ whatsapp_alerts: false });
    await expect(asUser(db, PASTOR_A, () => rows(`insert into notification_preferences (user_id, whatsapp_alerts) values ($1, false)`, [ADMIN_A]))).rejects.toThrow();
  });
});
