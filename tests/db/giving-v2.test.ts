import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// giving_v2.sql (#65): PayShap ID and the church's own payment link, and how
// a recorded gift was paid (givings.channel). Queries run as real users (RLS on).

const CHURCH = "00000000-0000-0000-0000-0000000000c1";
const OTHER = "00000000-0000-0000-0000-0000000000c2";
const ADMIN = "10000000-0000-0000-0000-0000000000c1";
const ADMIN2 = "10000000-0000-0000-0000-0000000000c3";
const MEMBER = "10000000-0000-0000-0000-0000000000c2";
const OUTSIDER = "10000000-0000-0000-0000-0000000000c4";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
const as = <T>(who: string, sql: string, params: unknown[] = []) => asUser(db, who, () => rows(sql, params)) as Promise<T[]>;
const save = (who: string, church: string, payshap: string | null, label: string | null, url: string | null) =>
  as(who, `insert into church_payment_options (church_id, payshap_id, link_label, link_url) values ($1, $2, $3, $4)
           on conflict (church_id) do update set payshap_id = excluded.payshap_id, link_label = excluded.link_label, link_url = excluded.link_url`, [church, payshap, label, url]);

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'Church'), ('${OTHER}', 'Other');
    insert into auth.users (id) values ('${ADMIN}'), ('${ADMIN2}'), ('${MEMBER}'), ('${OUTSIDER}');
    insert into app_users (id, church_id, name, email, role, status) values
      ('${ADMIN}', '${CHURCH}', 'Admin', 'a@x.test', 'church_admin', 'active'),
      ('${ADMIN2}', '${CHURCH}', 'Admin Two', 'a2@x.test', 'church_admin', 'active'),
      ('${MEMBER}', '${CHURCH}', 'Member', 'm@x.test', 'member', 'active'),
      ('${OUTSIDER}', '${OTHER}', 'Outsider', 'o@x.test', 'member', 'active');
    insert into church_giving_details (church_id, account_name, bank_name, account_number, branch_code, account_type, reference_prefix)
      values ('${CHURCH}', 'Church', 'FNB', '62812345678', '250655', 'cheque', 'CHRCH');
  `);
}, 120_000);

describe("PayShap and payment links", () => {
  test("only church admins set them; the church's members can see them, other churches can't", async () => {
    await expect(save(MEMBER, CHURCH, "0821234567", null, null)).rejects.toThrow(/row-level security/);
    await save(ADMIN, CHURCH, "0821234567", "SnapScan", "https://pos.snapscan.io/qr/abc123");
    expect(await as(MEMBER, `select payshap_id, link_label from church_payment_options`)).toEqual([{ payshap_id: "0821234567", link_label: "SnapScan" }]);
    expect(await as(OUTSIDER, `select * from church_payment_options`)).toEqual([]);
  });

  test("links must be https; every admin is told when they change", async () => {
    await expect(save(ADMIN, CHURCH, null, "Bad", "http://evil.example/pay")).rejects.toThrow(/check constraint/);
    const told = await rows(`select user_id from notifications where type = 'giving.payment_options_changed' and church_id = $1`, [CHURCH]);
    expect(new Set(told.map((r) => r.user_id))).toEqual(new Set([ADMIN, ADMIN2]));
  });

  test("a recorded gift remembers how it was paid", async () => {
    const [g] = await as<{ channel: string; reference: string }>(MEMBER, `insert into givings (church_id, user_id, amount_cents, fund, paid_on, method, status, channel)
      values ($1, $2, 25000, 'general', current_date, 'eft', 'reported', 'payshap') returning channel, reference`, [CHURCH, MEMBER]);
    expect(g.channel).toBe("payshap");
    expect(g.reference).toMatch(/^CHRCH-/);
    await expect(as(MEMBER, `insert into givings (church_id, user_id, amount_cents, fund, paid_on, method, status, channel)
      values ($1, $2, 25000, 'general', current_date, 'eft', 'reported', 'crypto')`, [CHURCH, MEMBER])).rejects.toThrow(/check constraint/);
  });
});
