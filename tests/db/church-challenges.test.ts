import { beforeAll, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// church_challenges.sql (migration #57): whole-church Bible challenges.

const CHURCH = "00000000-0000-0000-0000-0000000000a1";
const OTHER = "00000000-0000-0000-0000-0000000000a9";
const PASTOR = "10000000-0000-0000-0000-0000000000a2";
const ALICE = "10000000-0000-0000-0000-0000000000a3";
const BOB = "10000000-0000-0000-0000-0000000000a4";
const OUTSIDER = "10000000-0000-0000-0000-0000000000a5";
const CH = "70000000-0000-0000-0000-0000000000a1";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
const as = (who: string, sql: string) => asUser(db, who, () => rows(sql));

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'Church'), ('${OTHER}', 'Other');
    insert into auth.users (id) values ('${PASTOR}'), ('${ALICE}'), ('${BOB}'), ('${OUTSIDER}');
    insert into app_users (id, church_id, name, email, role, status) values
      ('${PASTOR}', '${CHURCH}', 'Pastor John', 'p@x.test', 'pastor', 'active'),
      ('${ALICE}', '${CHURCH}', 'Alice', 'a@x.test', 'member', 'active'),
      ('${BOB}', '${CHURCH}', 'Bob', 'b@x.test', 'member', 'active'),
      ('${OUTSIDER}', '${OTHER}', 'Outsider', 'o@x.test', 'member', 'active');
    insert into church_challenges (id, church_id, created_by, title, level, questions, ends_at)
      values ('${CH}', '${CHURCH}', '${PASTOR}', 'Sunday showdown', 'easy', '[{"question":"Q","choices":["a","b","c","d"]}]', now() + interval '1 day');
    insert into church_challenge_keys (challenge_id, correct) values ('${CH}', '{2}');
    insert into church_challenge_entries (challenge_id, user_id, church_id, done, score, ms) values ('${CH}', '${ALICE}', '${CHURCH}', 1, 1, 5000);
    insert into church_challenge_answers (challenge_id, user_id, idx, choice, correct, ms) values ('${CH}', '${ALICE}', 0, 2, true, 5000);
  `);
}, 120_000);

test("everyone in the church is told — not the host, not other churches", async () => {
  expect(await rows(`select user_id, title from notifications where type = 'game.challenge' order by user_id`)).toEqual([
    { user_id: ALICE, title: "⛪ Church challenge: Sunday showdown" },
    { user_id: BOB, title: "⛪ Church challenge: Sunday showdown" },
  ]);
});

test("the church sees the challenge and leaderboard; nobody sees the answers", async () => {
  expect(await as(BOB, `select title from church_challenges`)).toEqual([{ title: "Sunday showdown" }]);
  expect(await as(BOB, `select user_id, score from church_challenge_entries`)).toEqual([{ user_id: ALICE, score: 1 }]);
  expect(await as(OUTSIDER, `select id from church_challenges`)).toEqual([]);
  expect(await as(OUTSIDER, `select * from church_challenge_entries`)).toEqual([]);
  expect(await as(ALICE, `select * from church_challenge_keys`)).toEqual([]);
  expect(await as(ALICE, `select * from church_challenge_answers`)).toEqual([]);
  await expect(as(ALICE, `insert into church_challenge_entries (challenge_id, user_id, church_id, score) values ('${CH}', '${BOB}', '${CHURCH}', 99)`)).rejects.toThrow(/row-level security/);
});
