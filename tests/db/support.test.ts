import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// Support desk + attachment storage RLS (support_security_fix.sql). Each
// query runs as a real end user with RLS on.

const CHURCH_A = "00000000-0000-0000-0000-00000000000a";
const CHURCH_B = "00000000-0000-0000-0000-00000000000b";
const ADMIN_A = "10000000-0000-0000-0000-000000000001";
const MEMBER_A = "10000000-0000-0000-0000-000000000003";
const MEMBER_B = "20000000-0000-0000-0000-000000000002";
const SUPER = "90000000-0000-0000-0000-000000000001";
const TICKET_A = "40000000-0000-0000-0000-000000000001";
const A_FILE = `${MEMBER_A}/screenshot.png`;

let db: PGlite;

async function rows(sql: string, params: unknown[] = []) {
  return (await db.query<any>(sql, params)).rows;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH_A}', 'Church A'), ('${CHURCH_B}', 'Church B');
    insert into auth.users (id) values ('${ADMIN_A}'), ('${MEMBER_A}'), ('${MEMBER_B}'), ('${SUPER}');
    insert into app_users (id, church_id, name, email, role) values
      ('${ADMIN_A}',  '${CHURCH_A}', 'Admin A',  'a@a.test', 'church_admin'),
      ('${MEMBER_A}', '${CHURCH_A}', 'Member A', 'm@a.test', 'member'),
      ('${MEMBER_B}', '${CHURCH_B}', 'Member B', 'm@b.test', 'member'),
      ('${SUPER}',    null,          'Support',  's@x.test', 'super_admin');
  `);
  // Member A opens a ticket with a screenshot, through RLS like the app does.
  await asUser(db, MEMBER_A, async () => {
    await rows(`insert into storage.objects (bucket_id, name, owner) values ('attachments', $1, $2)`, [A_FILE, MEMBER_A]);
    await rows(`insert into support_tickets (id, church_id, created_by, subject) values ($1, $2, $3, 'Help')`, [
      TICKET_A, CHURCH_A, MEMBER_A,
    ]);
    await rows(
      `insert into support_ticket_messages (ticket_id, sender_id, content, attachment_path) values ($1, $2, 'see pic', $3)`,
      [TICKET_A, MEMBER_A, A_FILE]
    );
  });
}, 120_000);

const canSee = (userId: string, name: string) =>
  asUser(db, userId, () => rows(`select name from storage.objects where bucket_id = 'attachments' and name = $1`, [name]));

describe("attachment uploads", () => {
  test("a member can upload into their own folder", async () => {
    const inserted = await asUser(db, MEMBER_B, () =>
      rows(`insert into storage.objects (bucket_id, name, owner) values ('attachments', $1, $2) returning name`, [
        `${MEMBER_B}/mine.png`, MEMBER_B,
      ])
    );
    expect(inserted).toHaveLength(1);
  });

  test("a member cannot upload into someone else's folder", async () => {
    await expect(
      asUser(db, MEMBER_B, () =>
        rows(`insert into storage.objects (bucket_id, name, owner) values ('attachments', $1, $2)`, [
          `${MEMBER_A}/planted.png`, MEMBER_B,
        ])
      )
    ).rejects.toThrow();
  });

  test("a member cannot upload to the bucket root", async () => {
    await expect(
      asUser(db, MEMBER_B, () =>
        rows(`insert into storage.objects (bucket_id, name, owner) values ('attachments', 'root.png', $1)`, [MEMBER_B])
      )
    ).rejects.toThrow();
  });
});

describe("attachment visibility follows the ticket", () => {
  test("the ticket's creator, their church admin and support staff can read it", async () => {
    expect(await canSee(MEMBER_A, A_FILE)).toHaveLength(1);
    expect(await canSee(ADMIN_A, A_FILE)).toHaveLength(1);
    expect(await canSee(SUPER, A_FILE)).toHaveLength(1);
  });

  test("a member of another church cannot read it", async () => {
    expect(await canSee(MEMBER_B, A_FILE)).toHaveLength(0);
  });

  test("a member cannot gain access by attaching someone else's file to their own ticket", async () => {
    const TICKET_B = "40000000-0000-0000-0000-000000000002";
    await asUser(db, MEMBER_B, () =>
      rows(`insert into support_tickets (id, church_id, created_by, subject) values ($1, $2, $3, 'x')`, [TICKET_B, CHURCH_B, MEMBER_B])
    );
    await expect(
      asUser(db, MEMBER_B, () =>
        rows(
          `insert into support_ticket_messages (ticket_id, sender_id, content, attachment_path) values ($1, $2, 'mine now', $3)`,
          [TICKET_B, MEMBER_B, A_FILE]
        )
      )
    ).rejects.toThrow();
    expect(await canSee(MEMBER_B, A_FILE)).toHaveLength(0);
  });
});

describe("bucket limits", () => {
  test("attachments are limited to 5 MB raster images (no SVG — it can carry scripts)", async () => {
    const [bucket] = await rows(`select file_size_limit, allowed_mime_types from storage.buckets where id = 'attachments'`);
    expect(Number(bucket.file_size_limit)).toBe(5 * 1024 * 1024);
    expect(bucket.allowed_mime_types).toEqual(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  });
});
