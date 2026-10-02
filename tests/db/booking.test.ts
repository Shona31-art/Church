import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// Pastor booking + availability RLS (booking_security_fix.sql). Each query
// runs as a real end user with RLS on — i.e. what someone could do straight
// from the browser console with the public anon key.

const CHURCH_A = "00000000-0000-0000-0000-00000000000a";
const CHURCH_B = "00000000-0000-0000-0000-00000000000b";
const ADMIN_A = "10000000-0000-0000-0000-000000000001";
const PASTOR_A = "10000000-0000-0000-0000-000000000002";
const MEMBER_A = "10000000-0000-0000-0000-000000000003";
const PASTOR_B = "20000000-0000-0000-0000-000000000001";
const MEMBER_B = "20000000-0000-0000-0000-000000000002";

let db: PGlite;

async function rows(sql: string, params: unknown[] = []) {
  return (await db.query<any>(sql, params)).rows;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH_A}', 'Church A'), ('${CHURCH_B}', 'Church B');
    insert into auth.users (id) values ('${ADMIN_A}'), ('${PASTOR_A}'), ('${MEMBER_A}'), ('${PASTOR_B}'), ('${MEMBER_B}');
    insert into app_users (id, church_id, name, email, role) values
      ('${ADMIN_A}',  '${CHURCH_A}', 'Admin A',  'a@a.test', 'church_admin'),
      ('${PASTOR_A}', '${CHURCH_A}', 'Pastor A', 'p@a.test', 'pastor'),
      ('${MEMBER_A}', '${CHURCH_A}', 'Member A', 'm@a.test', 'member'),
      ('${PASTOR_B}', '${CHURCH_B}', 'Pastor B', 'p@b.test', 'pastor'),
      ('${MEMBER_B}', '${CHURCH_B}', 'Member B', 'm@b.test', 'member');
  `);
}, 120_000);

const insertBooking = (status = "pending", pastorId: string | null = PASTOR_A) =>
  rows(
    `insert into pastor_bookings (church_id, requested_by, pastor_id, booking_type, preferred_date, status)
     values ($1, $2, $3, 'wedding', '2030-01-01', $4) returning id`,
    [CHURCH_A, MEMBER_A, pastorId, status]
  );

describe("pastor_bookings — requests can't skip approval", () => {
  test("a member can submit a pending request", async () => {
    expect(await asUser(db, MEMBER_A, () => insertBooking())).toHaveLength(1);
  });

  test("a member cannot submit a request that is already approved", async () => {
    await expect(asUser(db, MEMBER_A, () => insertBooking("approved"))).rejects.toThrow();
  });

  test("a member cannot address a request to a pastor in another church", async () => {
    await expect(asUser(db, MEMBER_A, () => insertBooking("pending", PASTOR_B))).rejects.toThrow();
  });

  test("a member cannot approve their own request", async () => {
    const [{ id }] = await asUser(db, MEMBER_A, () => insertBooking());
    const updated = await asUser(db, MEMBER_A, () =>
      rows(`update pastor_bookings set status = 'approved' where id = $1 returning id`, [id])
    );
    expect(updated).toHaveLength(0);
  });

  test("a pastor in the same church can approve; a pastor elsewhere can't see it", async () => {
    const [{ id }] = await asUser(db, MEMBER_A, () => insertBooking());
    expect(
      await asUser(db, PASTOR_B, () => rows(`update pastor_bookings set status = 'approved' where id = $1 returning id`, [id]))
    ).toHaveLength(0);
    expect(
      await asUser(db, PASTOR_A, () => rows(`update pastor_bookings set status = 'approved' where id = $1 returning status`, [id]))
    ).toEqual([{ status: "approved" }]);
  });
});

describe("pastor_availability_blocks — own church, pastors only", () => {
  const block = (churchId: string, pastorId: string) =>
    rows(
      `insert into pastor_availability_blocks (church_id, pastor_id, blocked_date) values ($1, $2, '2030-01-01') returning id`,
      [churchId, pastorId]
    );

  test("a pastor can block their own date", async () => {
    expect(await asUser(db, PASTOR_A, () => block(CHURCH_A, PASTOR_A))).toHaveLength(1);
  });

  test("a church admin can block a date for a pastor in their church", async () => {
    expect(await asUser(db, ADMIN_A, () => block(CHURCH_A, PASTOR_A))).toHaveLength(1);
  });

  test("nobody can write a block into another church", async () => {
    await expect(asUser(db, PASTOR_A, () => block(CHURCH_B, PASTOR_A))).rejects.toThrow();
  });

  test("a church admin cannot block a date for another church's pastor", async () => {
    await expect(asUser(db, ADMIN_A, () => block(CHURCH_A, PASTOR_B))).rejects.toThrow();
  });

  test("a plain member cannot create availability blocks", async () => {
    await expect(asUser(db, MEMBER_A, () => block(CHURCH_A, MEMBER_A))).rejects.toThrow();
  });
});
