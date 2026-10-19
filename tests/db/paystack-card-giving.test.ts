import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// Card giving (paystack_card_giving.sql, migration #31).

const CHURCH_A = "00000000-0000-0000-0000-00000000000a";
const CHURCH_B = "00000000-0000-0000-0000-00000000000b";
const ADMIN_A = "10000000-0000-0000-0000-000000000001";
const MEMBER_A = "10000000-0000-0000-0000-000000000003";
const MEMBER_B = "20000000-0000-0000-0000-000000000002";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH_A}', 'KAMI'), ('${CHURCH_B}', 'Church B');
    insert into auth.users (id) values ('${ADMIN_A}'), ('${MEMBER_A}'), ('${MEMBER_B}');
    insert into app_users (id, church_id, name, email, role) values
      ('${ADMIN_A}',  '${CHURCH_A}', 'Admin A',  'a@a.test', 'church_admin'),
      ('${MEMBER_A}', '${CHURCH_A}', 'Member A', 'm@a.test', 'member'),
      ('${MEMBER_B}', '${CHURCH_B}', 'Member B', 'm@b.test', 'member');
    insert into church_giving_details (church_id, account_name, bank_name, account_number, branch_code, account_type, reference_prefix)
      values ('${CHURCH_A}', 'KAMI', 'First National Bank (FNB)', '62812345678', '250655', 'cheque', 'KAMI');
    -- What the server does (service role) when an admin turns card giving on.
    insert into church_card_giving (church_id, subaccount_code, bank_code, account_ending) values ('${CHURCH_A}', 'ACCT_test123', '250655', '5678');
  `);
}, 120_000);

describe("church_card_giving", () => {
  test("members of the church can see it; other churches can't", async () => {
    expect(await asUser(db, MEMBER_A, () => rows(`select enabled from church_card_giving`))).toEqual([{ enabled: true }]);
    expect(await asUser(db, MEMBER_B, () => rows(`select * from church_card_giving`))).toEqual([]);
  });

  test("nobody can change it from the browser — not even a church admin", async () => {
    const updated = await asUser(db, ADMIN_A, () => rows(`update church_card_giving set subaccount_code = 'ACCT_evil' returning church_id`));
    expect(updated).toEqual([]);
    await expect(
      asUser(db, ADMIN_A, () => rows(`insert into church_card_giving (church_id, subaccount_code, bank_code, account_ending) values ($1, 'ACCT_x', '250655', '1111')`, [CHURCH_B]))
    ).rejects.toThrow();
    expect(await asUser(db, ADMIN_A, () => rows(`delete from church_card_giving returning church_id`))).toEqual([]);
  });

  test("changing the bank account pauses card giving and logs it; other edits don't", async () => {
    await asUser(db, ADMIN_A, () => rows(`update church_giving_details set reference_prefix = 'KAMI2' where church_id = $1`, [CHURCH_A]));
    expect((await rows(`select enabled from church_card_giving where church_id = $1`, [CHURCH_A]))[0].enabled).toBe(true);

    await asUser(db, ADMIN_A, () => rows(`update church_giving_details set account_number = '62899990000' where church_id = $1`, [CHURCH_A]));
    expect((await rows(`select enabled from church_card_giving where church_id = $1`, [CHURCH_A]))[0].enabled).toBe(false);
    const audit = await rows(`select metadata from audit_logs where action = 'card_giving.paused_bank_changed'`);
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata).toEqual({ account_ending: "0000" });
  });
});

describe("givings for card payments", () => {
  test("members still can't create card gifts themselves (only the server records them)", async () => {
    await expect(
      asUser(db, MEMBER_A, () =>
        rows(`insert into givings (church_id, user_id, amount_cents, fund, method, status, provider, provider_reference) values ($1, $2, 1000, 'general', 'card', 'pending', 'paystack', 'gb-x')`, [CHURCH_A, MEMBER_A])
      )
    ).rejects.toThrow();
  });

  test("references are unique, fees can't be negative, providers are known", async () => {
    await rows(`insert into givings (church_id, user_id, amount_cents, fund, status, provider, provider_reference) values ($1, $2, 1000, 'general', 'pending', 'paystack', 'gb-dup')`, [CHURCH_A, MEMBER_A]);
    await expect(rows(`insert into givings (church_id, user_id, amount_cents, fund, status, provider, provider_reference) values ($1, $2, 1000, 'general', 'pending', 'paystack', 'gb-dup')`, [CHURCH_A, MEMBER_A])).rejects.toThrow();
    await expect(rows(`insert into givings (church_id, user_id, amount_cents, fund, status, fee_cents) values ($1, $2, 1000, 'general', 'pending', -1)`, [CHURCH_A, MEMBER_A])).rejects.toThrow();
    await expect(rows(`insert into givings (church_id, user_id, amount_cents, fund, status, provider) values ($1, $2, 1000, 'general', 'pending', 'paypal')`, [CHURCH_A, MEMBER_A])).rejects.toThrow();
  });
});
