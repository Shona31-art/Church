import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// Online billing (paystack_billing.sql, migration #34).

const CHURCH_A = "00000000-0000-0000-0000-00000000000a";
const CHURCH_B = "00000000-0000-0000-0000-00000000000b";
const ADMIN_A = "10000000-0000-0000-0000-000000000001";
const MEMBER_A = "10000000-0000-0000-0000-000000000003";
const ADMIN_B = "20000000-0000-0000-0000-000000000001";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH_A}', 'Church A'), ('${CHURCH_B}', 'Church B');
    insert into auth.users (id) values ('${ADMIN_A}'), ('${MEMBER_A}'), ('${ADMIN_B}');
    insert into app_users (id, church_id, name, email, role) values
      ('${ADMIN_A}',  '${CHURCH_A}', 'Admin A',  'a@a.test', 'church_admin'),
      ('${MEMBER_A}', '${CHURCH_A}', 'Member A', 'm@a.test', 'member'),
      ('${ADMIN_B}',  '${CHURCH_B}', 'Admin B',  'a@b.test', 'church_admin');
    insert into church_subscriptions (church_id, plan_key, status) values ('${CHURCH_A}', 'free_trial', 'trial'), ('${CHURCH_B}', 'free_trial', 'trial');
    -- What the server does (service role) when a checkout starts.
    insert into billing_payments (church_id, plan_key, amount_cents, reference, started_by)
      values ('${CHURCH_A}', 'premium', 59900, 'gbsub-00000000-0000-0000-0000-000000000001', '${ADMIN_A}');
  `);
}, 120_000);

describe("billing_payments", () => {
  test("a church's admins see its payments; members and other churches don't", async () => {
    expect(await asUser(db, ADMIN_A, () => rows(`select plan_key, amount_cents from billing_payments`))).toEqual([{ plan_key: "premium", amount_cents: 59900 }]);
    expect(await asUser(db, MEMBER_A, () => rows(`select * from billing_payments`))).toEqual([]);
    expect(await asUser(db, ADMIN_B, () => rows(`select * from billing_payments`))).toEqual([]);
  });

  test("nobody can record or change a payment from the browser — not even a church admin", async () => {
    await expect(
      asUser(db, ADMIN_A, () => rows(`insert into billing_payments (church_id, plan_key, amount_cents, reference) values ($1, 'premium', 1, 'gbsub-forged-000')`, [CHURCH_A])),
    ).rejects.toThrow();
    expect(await asUser(db, ADMIN_A, () => rows(`update billing_payments set status = 'succeeded' returning id`))).toEqual([]);
    expect(await asUser(db, ADMIN_A, () => rows(`delete from billing_payments returning id`))).toEqual([]);
  });

  test("a payment reference can only be recorded once", async () => {
    await expect(
      rows(`insert into billing_payments (church_id, plan_key, amount_cents, reference) values ($1, 'premium', 59900, 'gbsub-00000000-0000-0000-0000-000000000001')`, [CHURCH_A]),
    ).rejects.toThrow();
  });

  test("only Basic and Premium can be paid online, in rand", async () => {
    await expect(rows(`insert into billing_payments (church_id, plan_key, amount_cents, reference) values ($1, 'enterprise', 1, 'gbsub-x-enterprise')`, [CHURCH_A])).rejects.toThrow();
    await expect(rows(`insert into billing_payments (church_id, plan_key, amount_cents, reference, currency) values ($1, 'basic', 1, 'gbsub-x-usd', 'USD')`, [CHURCH_A])).rejects.toThrow();
  });
});

describe("church_subscriptions Paystack fields", () => {
  test("a church admin still can't change their own subscription (e.g. mark it paid)", async () => {
    const updated = await asUser(db, ADMIN_A, () => rows(`update church_subscriptions set paystack_subscription_code = 'SUB_free', status = 'active' returning church_id`));
    expect(updated).toEqual([]);
  });

  test("codes must look like Paystack's, and one customer belongs to one church", async () => {
    await expect(rows(`update church_subscriptions set paystack_customer_code = 'nope' where church_id = $1`, [CHURCH_A])).rejects.toThrow();
    await rows(`update church_subscriptions set paystack_customer_code = 'CUS_one' where church_id = $1`, [CHURCH_A]);
    await expect(rows(`update church_subscriptions set paystack_customer_code = 'CUS_one' where church_id = $1`, [CHURCH_B])).rejects.toThrow();
  });
});
