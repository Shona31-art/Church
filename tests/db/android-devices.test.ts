import { beforeAll, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// android_devices.sql (migration #53): phones' push addresses are server-only.

const CHURCH = "00000000-0000-0000-0000-0000000000d1";
const ALICE = "10000000-0000-0000-0000-0000000000d2";
let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'Church');
    insert into auth.users (id) values ('${ALICE}');
    insert into app_users (id, church_id, name, email, role, status) values ('${ALICE}', '${CHURCH}', 'Alice', 'a@x.test', 'member', 'active');
    insert into android_devices (token, user_id) values ('${"t".repeat(40)}', '${ALICE}');
  `);
}, 120_000);

test("members can't read or add phones, not even their own", async () => {
  expect(await asUser(db, ALICE, async () => (await db.query(`select * from android_devices`)).rows)).toEqual([]);
  await expect(asUser(db, ALICE, () => db.query(`insert into android_devices (token, user_id) values ($1, $2)`, ["u".repeat(40), ALICE]))).rejects.toThrow(/row-level security/);
});
