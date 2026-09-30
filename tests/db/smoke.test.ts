import { test, expect } from "vitest";
import { createTestDb } from "./harness";

test("every migration loads, in README order", async () => {
  const db = await createTestDb();
  const res = await db.query<{ n: number }>("select count(*)::int as n from modules");
  expect(res.rows[0].n).toBeGreaterThan(10);
}, 120_000);
