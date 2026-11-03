import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// game_duels.sql (migration #56): Bible quiz duels.

const CHURCH = "00000000-0000-0000-0000-0000000000b1";
const ALICE = "10000000-0000-0000-0000-0000000000b2";
const BOB = "10000000-0000-0000-0000-0000000000b3";
const CAROL = "10000000-0000-0000-0000-0000000000b4";
const DUEL = "60000000-0000-0000-0000-0000000000b1";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
const as = (who: string, sql: string) => asUser(db, who, () => rows(sql));

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'Church');
    insert into auth.users (id) values ('${ALICE}'), ('${BOB}'), ('${CAROL}');
    insert into app_users (id, church_id, name, email, role) values
      ('${ALICE}', '${CHURCH}', 'Alice', 'a@x.test', 'member'),
      ('${BOB}', '${CHURCH}', 'Bob', 'b@x.test', 'member'),
      ('${CAROL}', '${CHURCH}', 'Carol', 'c@x.test', 'member');
    insert into game_duels (id, church_id, challenger_id, opponent_id, level, questions)
      values ('${DUEL}', '${CHURCH}', '${ALICE}', '${BOB}', 'easy', '[{"question":"Q","choices":["a","b","c","d"]},{"question":"Q2","choices":["a","b","c","d"]}]');
    insert into game_duel_keys (duel_id, correct) values ('${DUEL}', '{1,2}');
    insert into game_duel_answers (duel_id, user_id, idx, choice, correct, ms) values ('${DUEL}', '${ALICE}', 0, 1, true, 4000);
  `);
}, 120_000);

describe("Bible duels", () => {
  test("only the two players see the duel; nobody can read the answers", async () => {
    expect(await as(ALICE, `select id from game_duels`)).toEqual([{ id: DUEL }]);
    expect(await as(BOB, `select id from game_duels`)).toEqual([{ id: DUEL }]);
    expect(await as(CAROL, `select id from game_duels`)).toEqual([]);
    expect(await as(BOB, `select * from game_duel_keys`)).toEqual([]);
    expect(await as(BOB, `select * from game_duel_answers`)).toEqual([]);
    expect(await as(ALICE, `select * from game_duel_answers`)).toEqual([]);
    await expect(as(ALICE, `update game_duels set winner_id = '${ALICE}'`)).resolves.toEqual([]); // no update rule: changes nothing
    expect((await rows(`select winner_id from game_duels`))[0].winner_id).toBeNull();
  });

  test("the challenge, the accept and the result are notified", async () => {
    expect(await rows(`select user_id, title, body from notifications where type = 'game.duel'`)).toEqual([
      { user_id: BOB, title: "Alice challenged you to a Bible duel ⚔️", body: "Easy quiz, 2 questions. Tap to accept." },
    ]);
    await db.exec(`update game_duels set status = 'active' where id = '${DUEL}'`);
    await db.exec(`update game_duels set status = 'finished', winner_id = '${BOB}', challenger_score = 1, opponent_score = 2 where id = '${DUEL}'`);
    const notes = await rows(`select user_id, title, body from notifications where type = 'game.duel' order by created_at, user_id`);
    expect(notes.slice(1)).toEqual([
      { user_id: ALICE, title: "Bob accepted your Bible duel", body: "Tap to see how they're doing." },
      { user_id: ALICE, title: "Bob won the Bible duel 🏆", body: "Alice 1 – 2 Bob" },
      { user_id: BOB, title: "Bob won the Bible duel 🏆", body: "Alice 1 – 2 Bob" },
    ]);
  });
});
