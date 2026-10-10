import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// bible_games_v3.sql — answers stay on the server and only the server records scores.

const CHURCH = "00000000-0000-0000-0000-0000000000c1";
const OTHER_CHURCH = "00000000-0000-0000-0000-0000000000c2";
const ALICE = "10000000-0000-0000-0000-0000000000c1";
const BOB = "10000000-0000-0000-0000-0000000000c2";
const OUTSIDER = "10000000-0000-0000-0000-0000000000c3";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
async function attempt(user: string | null, sql: string, params: unknown[] = []) {
  try {
    await asUser(db, user, () => rows(sql, params));
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

let sessionId: string;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH}', 'Church'), ('${OTHER_CHURCH}', 'Other');
    insert into auth.users (id) values ('${ALICE}'), ('${BOB}'), ('${OUTSIDER}');
    insert into app_users (id, church_id, name, email, role, status) values
      ('${ALICE}', '${CHURCH}', 'Alice', 'a@c.test', 'member', 'active'),
      ('${BOB}', '${CHURCH}', 'Bob', 'b@c.test', 'member', 'active'),
      ('${OUTSIDER}', '${OTHER_CHURCH}', 'Out', 'o@c.test', 'member', 'active');
  `);
  // The server (service role: no signed-in user) starts a game for Alice.
  const [row] = await asUser(db, null, () =>
    rows(`insert into game_sessions (church_id, user_id, game_type, level, seed, puzzle, max_correct)
          values ($1, $2, 'quiz', 'easy', 1, '{"ids":["q1"],"correct":[2]}', 1) returning id`, [CHURCH, ALICE])
  );
  sessionId = row.id;
}, 120_000);

describe("game sessions hold the answers, so members can't touch them", () => {
  test("not even the player can read their own session", async () => {
    expect(await asUser(db, ALICE, () => rows(`select puzzle from game_sessions`))).toHaveLength(0);
  });

  test("members can't create, change or finish sessions", async () => {
    expect(await attempt(ALICE, `insert into game_sessions (church_id, user_id, game_type, level, seed, puzzle) values ($1, $2, 'quiz', 'easy', 1, '{}')`, [CHURCH, ALICE])).toMatch(/row-level security/);
    await asUser(db, ALICE, () => rows(`update game_sessions set correct = 99, finished_at = now() where id = $1`, [sessionId]));
    expect(await rows(`select correct, finished_at from game_sessions where id = $1`, [sessionId])).toEqual([{ correct: null, finished_at: null }]);
  });
});

describe("the scoreboard", () => {
  test("members can no longer post their own scores", async () => {
    const error = await attempt(ALICE, `insert into bible_quiz_attempts (church_id, user_id, score, total_questions, game_type, points) values ($1, $2, 10, 10, 'quiz', 999)`, [CHURCH, ALICE]);
    expect(error).toMatch(/row-level security/);
  });

  test("the server records a score linked to its session, once", async () => {
    const insert = `insert into bible_quiz_attempts (church_id, user_id, score, total_questions, game_type, points, level, session_id) values ($1, $2, 1, 1, 'quiz', 1, 'easy', $3)`;
    expect(await attempt(null, insert, [CHURCH, ALICE, sessionId])).toBeNull();
    expect(await attempt(null, insert, [CHURCH, ALICE, sessionId])).toMatch(/duplicate key/);
  });

  test("the church sees it; another church doesn't", async () => {
    expect(await asUser(db, BOB, () => rows(`select points from bible_quiz_attempts`))).toEqual([{ points: 1 }]);
    expect(await asUser(db, OUTSIDER, () => rows(`select points from bible_quiz_attempts`))).toHaveLength(0);
  });

  test("new game types are accepted", async () => {
    expect(await attempt(null, `insert into bible_quiz_attempts (church_id, user_id, score, total_questions, game_type) values ($1, $2, 3, 5, 'crossword')`, [CHURCH, BOB])).toBeNull();
  });
});
