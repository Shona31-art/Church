import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// Members' children (member_children.sql, migration #44): seen and changed
// only by the parent and their church's pastors/admins; follow the parent on
// a church move.

const CHURCH_A = "00000000-0000-0000-0000-00000000000a";
const CHURCH_B = "00000000-0000-0000-0000-00000000000b";
const PASTOR_A = "10000000-0000-0000-0000-000000000001";
const PARENT = "10000000-0000-0000-0000-000000000002";
const OTHER_A = "10000000-0000-0000-0000-000000000003";
const PASTOR_B = "20000000-0000-0000-0000-000000000001";
const MEMBER_B = "20000000-0000-0000-0000-000000000002";
const SUPER = "90000000-0000-0000-0000-000000000001";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH_A}', 'Church A'), ('${CHURCH_B}', 'Church B');
    insert into auth.users (id) values ('${PASTOR_A}'), ('${PARENT}'), ('${OTHER_A}'), ('${PASTOR_B}'), ('${MEMBER_B}'), ('${SUPER}');
    insert into app_users (id, church_id, name, email, role) values
      ('${PASTOR_A}', '${CHURCH_A}', 'Pastor A', 'p@a.test',  'pastor'),
      ('${PARENT}',   '${CHURCH_A}', 'Parent',   'pa@a.test', 'member'),
      ('${OTHER_A}',  '${CHURCH_A}', 'Other',    'o@a.test',  'member'),
      ('${PASTOR_B}', '${CHURCH_B}', 'Pastor B', 'p@b.test',  'pastor'),
      ('${MEMBER_B}', '${CHURCH_B}', 'Member B', 'm@b.test',  'member'),
      ('${SUPER}',    null,          'Platform', 'x@x.test',  'super_admin');
  `);
}, 120_000);

const addAs = (who: string, parent: string, church: string, name: string, birth: string | null = null) =>
  asUser(db, who, () =>
    rows(`insert into member_children (user_id, church_id, name, birth_date) values ($1, $2, $3, $4) returning id`, [parent, church, name, birth])
  );

describe("member_children", () => {
  test("a parent can add their own children, with or without a birthday", async () => {
    await addAs(PARENT, PARENT, CHURCH_A, "Thabo", "2018-03-14");
    await addAs(PARENT, PARENT, CHURCH_A, "Lerato");
    const mine = await asUser(db, PARENT, () => rows(`select name from member_children order by name`));
    expect(mine.map((r) => r.name)).toEqual(["Lerato", "Thabo"]);
  });

  test("a pastor of the church can add a child for a member", async () => {
    await addAs(PASTOR_A, PARENT, CHURCH_A, "Naledi", "2020-07-01");
    expect(await asUser(db, PASTOR_A, () => rows(`select id from member_children where user_id = $1`, [PARENT]))).toHaveLength(3);
  });

  test("other members can't see or add someone else's children", async () => {
    expect(await asUser(db, OTHER_A, () => rows(`select id from member_children`))).toEqual([]);
    await expect(addAs(OTHER_A, PARENT, CHURCH_A, "Sneaky")).rejects.toThrow();
  });

  test("another church's pastor sees none and can't file a child into their church", async () => {
    expect(await asUser(db, PASTOR_B, () => rows(`select id from member_children`))).toEqual([]);
    await expect(addAs(PASTOR_B, PARENT, CHURCH_B, "Wrong church")).rejects.toThrow();
  });

  test("a child can't be moved to another parent", async () => {
    await expect(
      asUser(db, PASTOR_A, () => rows(`update member_children set user_id = $1 where user_id = $2`, [OTHER_A, PARENT]))
    ).rejects.toThrow();
  });

  test("names must not be blank", async () => {
    await expect(addAs(PARENT, PARENT, CHURCH_A, "   ")).rejects.toThrow();
  });

  test("children follow their parent to a new church", async () => {
    await asUser(db, SUPER, () => rows(`update app_users set church_id = $1 where id = $2`, [CHURCH_B, PARENT]));
    expect(await asUser(db, PASTOR_A, () => rows(`select id from member_children where user_id = $1`, [PARENT]))).toEqual([]);
    const moved = await asUser(db, PASTOR_B, () => rows(`select name, birth_date::text as d from member_children where user_id = $1 order by name`, [PARENT]));
    expect(moved).toEqual([
      { name: "Lerato", d: null },
      { name: "Naledi", d: "2020-07-01" },
      { name: "Thabo", d: "2018-03-14" },
    ]);
  });
});

describe("mother and father (member_children_v2.sql)", () => {
  test("both parents see and manage the child; other members and other churches can't link or see", async () => {
    const MUM = "10000000-0000-0000-0000-0000000000a1";
    const DAD = "10000000-0000-0000-0000-0000000000a2";
    await db.exec(`
      insert into auth.users (id) values ('${MUM}'), ('${DAD}');
      insert into app_users (id, church_id, name, email, role) values ('${MUM}', '${CHURCH_A}', 'Mum', 'mum@a.test', 'member'), ('${DAD}', '${CHURCH_A}', 'Dad', 'dad@a.test', 'member');
    `);
    const PARENT = MUM;
    const OTHER_A = DAD;
    const [{ id }] = (await asUser(db, PARENT, () =>
      rows(`insert into member_children (user_id, church_id, name, mother_id, father_id, father_name) values ($1, $2, 'Joy', $1, $3, null) returning id`, [PARENT, CHURCH_A, OTHER_A])
    )) as { id: string }[];
    // The father (not the one who added her) sees her and can edit.
    expect(await asUser(db, OTHER_A, () => rows(`select name from member_children where id = $1`, [id]))).toEqual([{ name: "Joy" }]);
    await asUser(db, OTHER_A, () => rows(`update member_children set name = 'Joy Grace' where id = $1`, [id]));
    expect((await rows(`select name from member_children where id = $1`, [id]))[0].name).toBe("Joy Grace");
    // Someone from another church can't be linked as a parent.
    await expect(
      asUser(db, PARENT, () => rows(`insert into member_children (user_id, church_id, name, father_id) values ($1, $2, 'Sam', $3)`, [PARENT, CHURCH_A, MEMBER_B]))
    ).rejects.toThrow(/row-level security/);
    // A parent who isn't in the app: just a name.
    await asUser(db, PASTOR_A, () => rows(`insert into member_children (user_id, church_id, name, mother_id, father_name) values ($1, $2, 'Ben', $1, 'David Moyo')`, [PARENT, CHURCH_A]));
    expect(await asUser(db, MEMBER_B, () => rows(`select name from member_children where name in ('Joy Grace', 'Ben')`))).toEqual([]);
    // Another member of the same church who isn't a parent: can't see them.
    expect(await asUser(db, "10000000-0000-0000-0000-000000000003", () => rows(`select name from member_children where name in ('Joy Grace', 'Ben')`))).toEqual([]);
  });
});
