import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// Giving by bank transfer (eft_giving.sql, migration #30). Every query runs as
// a real end user with RLS on, exactly as the app's server actions do.

const CHURCH_A = "00000000-0000-0000-0000-00000000000a";
const CHURCH_B = "00000000-0000-0000-0000-00000000000b";
const ADMIN_A = "10000000-0000-0000-0000-000000000001";
const ADMIN_A2 = "10000000-0000-0000-0000-000000000004";
const PASTOR_A = "10000000-0000-0000-0000-000000000002";
const MEMBER_A = "3f9a2c00-0000-0000-0000-000000000003";
const ADMIN_B = "20000000-0000-0000-0000-000000000001";
const MEMBER_B = "20000000-0000-0000-0000-000000000002";
const SUPER = "90000000-0000-0000-0000-000000000001";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
const today = () => new Date().toISOString().slice(0, 10);

const DETAILS = {
  account_name: "KAMI Church",
  bank_name: "FNB",
  account_number: "62812345678",
  branch_code: "250655",
  account_type: "cheque",
  reference_prefix: "KAMI",
};
const saveDetails = (churchId: string, d = DETAILS) =>
  rows(
    `insert into church_giving_details (church_id, account_name, bank_name, account_number, branch_code, account_type, reference_prefix)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (church_id) do update set account_name = excluded.account_name, bank_name = excluded.bank_name,
       account_number = excluded.account_number, branch_code = excluded.branch_code, account_type = excluded.account_type,
       reference_prefix = excluded.reference_prefix
     returning church_id`,
    [churchId, d.account_name, d.bank_name, d.account_number, d.branch_code, d.account_type, d.reference_prefix]
  );
const report = (userId: string, churchId: string, extra: Record<string, unknown> = {}) => {
  const g = { amount_cents: 25000, fund: "general", paid_on: today(), method: "eft", status: "reported", ...extra };
  return rows(
    `insert into givings (church_id, user_id, amount_cents, fund, paid_on, method, status, confirmed_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id, reference, updated_at, status`,
    [churchId, userId, g.amount_cents, g.fund, g.paid_on, g.method, g.status, (g as any).confirmed_by ?? null]
  );
};
const confirm = (gift: string, outcome: string, cents: number | null, expected: string) =>
  rows(`select confirm_eft_gift($1, $2, $3, $4) as result`, [gift, outcome, cents, expected]).then((r) => r[0].result);

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH_A}', 'KAMI'), ('${CHURCH_B}', 'Church B');
    insert into auth.users (id) values ('${ADMIN_A}'), ('${ADMIN_A2}'), ('${PASTOR_A}'), ('${MEMBER_A}'), ('${ADMIN_B}'), ('${MEMBER_B}'), ('${SUPER}');
    insert into app_users (id, church_id, name, email, role) values
      ('${ADMIN_A}',  '${CHURCH_A}', 'Admin A',  'a@a.test',  'church_admin'),
      ('${ADMIN_A2}', '${CHURCH_A}', 'Admin A2', 'a2@a.test', 'church_admin'),
      ('${PASTOR_A}', '${CHURCH_A}', 'Pastor A', 'p@a.test',  'pastor'),
      ('${MEMBER_A}', '${CHURCH_A}', 'Member A', 'm@a.test',  'member'),
      ('${ADMIN_B}',  '${CHURCH_B}', 'Admin B',  'a@b.test',  'church_admin'),
      ('${MEMBER_B}', '${CHURCH_B}', 'Member B', 'm@b.test',  'member'),
      ('${SUPER}',    null,          'Support',  's@x.test',  'super_admin');
  `);
}, 120_000);

describe("bank details", () => {
  test("only a church admin can save them, and only for their own church", async () => {
    await expect(asUser(db, MEMBER_A, () => saveDetails(CHURCH_A))).rejects.toThrow();
    await expect(asUser(db, PASTOR_A, () => saveDetails(CHURCH_A))).rejects.toThrow();
    await expect(asUser(db, ADMIN_B, () => saveDetails(CHURCH_A))).rejects.toThrow();
    expect(await asUser(db, ADMIN_A, () => saveDetails(CHURCH_A))).toHaveLength(1);
  });

  test("members of the church can read them; other churches and platform staff can't", async () => {
    expect(await asUser(db, MEMBER_A, () => rows(`select account_number from church_giving_details`))).toEqual([{ account_number: "62812345678" }]);
    expect(await asUser(db, MEMBER_B, () => rows(`select * from church_giving_details`))).toEqual([]);
    expect(await asUser(db, SUPER, () => rows(`select * from church_giving_details`))).toEqual([]);
  });

  test("bad account numbers and branch codes are refused by the database", async () => {
    await expect(asUser(db, ADMIN_A, () => saveDetails(CHURCH_A, { ...DETAILS, account_number: "12ab" }))).rejects.toThrow();
    await expect(asUser(db, ADMIN_A, () => saveDetails(CHURCH_A, { ...DETAILS, branch_code: "25065" }))).rejects.toThrow();
  });

  test("a change is stamped with who made it, audit-logged, and in every admin's bell", async () => {
    await asUser(db, ADMIN_A2, () => saveDetails(CHURCH_A, { ...DETAILS, account_number: "62899990000" }));
    const [stamp] = await rows(`select updated_by from church_giving_details where church_id = $1`, [CHURCH_A]);
    expect(stamp.updated_by).toBe(ADMIN_A2);
    const audit = await rows(`select metadata from audit_logs where action = 'giving_details.update' order by created_at desc limit 1`);
    expect(audit[0].metadata).toMatchObject({ account_ending: "0000", previous_account_ending: "5678" });
    const bells = await rows(`select user_id from notifications where type = 'giving.bank_details_changed' and title is not null and body like '%0000%'`);
    expect(bells.map((b) => b.user_id).sort()).toEqual([ADMIN_A, ADMIN_A2].sort()); // both admins, including the one who changed it
    expect(bells.map((b) => b.user_id)).not.toContain(MEMBER_A);
  });
});

describe("recording a transfer", () => {
  test("a member records their own transfer; the reference comes from the database", async () => {
    const [gift] = await asUser(db, MEMBER_A, () => report(MEMBER_A, CHURCH_A));
    expect(gift.status).toBe("reported");
    expect(gift.reference).toBe("KAMI-3F9A2C"); // prefix + first 6 of the member's id — matches lib/giving.ts eftReference
  });

  test("a member can't record a gift as already received, or for someone else, or in another church", async () => {
    await expect(asUser(db, MEMBER_A, () => report(MEMBER_A, CHURCH_A, { status: "succeeded" }))).rejects.toThrow();
    await expect(asUser(db, MEMBER_A, () => report(MEMBER_A, CHURCH_A, { confirmed_by: MEMBER_A }))).rejects.toThrow();
    await expect(asUser(db, MEMBER_A, () => report(ADMIN_A, CHURCH_A))).rejects.toThrow();
    await expect(asUser(db, MEMBER_A, () => report(MEMBER_A, CHURCH_B))).rejects.toThrow();
    await expect(asUser(db, MEMBER_A, () => report(MEMBER_A, CHURCH_A, { method: "card", status: "succeeded" }))).rejects.toThrow();
  });

  test("future dates and silly amounts are refused", async () => {
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    await expect(asUser(db, MEMBER_A, () => report(MEMBER_A, CHURCH_A, { paid_on: tomorrow }))).rejects.toThrow();
    await expect(asUser(db, MEMBER_A, () => report(MEMBER_A, CHURCH_A, { amount_cents: 50 }))).rejects.toThrow();
    await expect(asUser(db, MEMBER_A, () => report(MEMBER_A, CHURCH_A, { amount_cents: 10_000_001 }))).rejects.toThrow();
  });

  test("a church without bank details can't take transfers", async () => {
    await expect(asUser(db, MEMBER_B, () => report(MEMBER_B, CHURCH_B))).rejects.toThrow();
  });

  test("members can't edit a gift, only delete their own while it's waiting", async () => {
    const [gift] = await asUser(db, MEMBER_A, () => report(MEMBER_A, CHURCH_A, { amount_cents: 1000 }));
    const updated = await asUser(db, MEMBER_A, () => rows(`update givings set status = 'succeeded' where id = $1 returning id`, [gift.id]));
    expect(updated).toEqual([]);
    const deleted = await asUser(db, MEMBER_A, () => rows(`delete from givings where id = $1 returning id`, [gift.id]));
    expect(deleted).toHaveLength(1);
  });
});

describe("confirming a transfer", () => {
  test("a church admin marks it received, with the amount that arrived; it's audit-logged", async () => {
    const [gift] = await asUser(db, MEMBER_A, () => report(MEMBER_A, CHURCH_A, { amount_cents: 25000 }));
    expect(await asUser(db, ADMIN_A, () => confirm(gift.id, "received", 24000, gift.updated_at))).toBe("ok");
    const [after] = await rows(`select status, amount_cents, confirmed_by from givings where id = $1`, [gift.id]);
    expect(after).toEqual({ status: "succeeded", amount_cents: 24000, confirmed_by: ADMIN_A });
    const [audit] = await rows(`select metadata from audit_logs where target_id = $1 and metadata->>'auto' is null`, [gift.id]);
    expect(audit.metadata).toMatchObject({ reported_cents: 25000, received_cents: 24000 });
    // ...and once confirmed, the member can no longer delete it.
    expect(await asUser(db, MEMBER_A, () => rows(`delete from givings where id = $1 returning id`, [gift.id]))).toEqual([]);
  });

  test("two admins on the same gift: the second gets 'changed', nothing is overwritten", async () => {
    const [gift] = await asUser(db, MEMBER_A, () => report(MEMBER_A, CHURCH_A));
    expect(await asUser(db, ADMIN_A, () => confirm(gift.id, "not_received", null, gift.updated_at))).toBe("ok");
    expect(await asUser(db, ADMIN_A2, () => confirm(gift.id, "received", 25000, gift.updated_at))).toBe("changed");
    const [after] = await rows(`select status from givings where id = $1`, [gift.id]);
    expect(after.status).toBe("not_received");
  });

  test("members, pastors and other churches' admins can't confirm (it looks 'not found')", async () => {
    const [gift] = await asUser(db, MEMBER_A, () => report(MEMBER_A, CHURCH_A));
    for (const who of [MEMBER_A, PASTOR_A, ADMIN_B, SUPER]) {
      expect(await asUser(db, who, () => confirm(gift.id, "received", 25000, gift.updated_at))).toBe("not_found");
    }
    const [after] = await rows(`select status from givings where id = $1`, [gift.id]);
    expect(after.status).toBe("reported");
  });

  test("bad outcomes and amounts are refused", async () => {
    const [gift] = await asUser(db, MEMBER_A, () => report(MEMBER_A, CHURCH_A));
    expect(await asUser(db, ADMIN_A, () => confirm(gift.id, "approve", 25000, gift.updated_at))).toBe("invalid");
    expect(await asUser(db, ADMIN_A, () => confirm(gift.id, "received", 0, gift.updated_at))).toBe("invalid");
  });

  test("existing card gifts are untouched by the new rules", async () => {
    const [card] = await rows(
      `insert into givings (church_id, user_id, amount_cents, fund, status) values ($1, $2, 5000, 'general', 'succeeded') returning method, reference`,
      [CHURCH_A, MEMBER_A]
    );
    expect(card).toEqual({ method: "card", reference: null });
  });
});
