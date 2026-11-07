import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// plan_basic_v2.sql — Basic is 50 members and only features that cost
// nothing to run; costly parts are switched off in the database itself.

const BASIC_CHURCH = "00000000-0000-0000-0000-0000000000b1";
const PREMIUM_CHURCH = "00000000-0000-0000-0000-0000000000b2";
const BASIC_MEMBER = "10000000-0000-0000-0000-0000000000b1";
const PREMIUM_MEMBER = "10000000-0000-0000-0000-0000000000b2";
const BASIC_GENERAL = "40000000-0000-0000-0000-0000000000b1";
const PREMIUM_GENERAL = "40000000-0000-0000-0000-0000000000b2";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
async function attempt(user: string, sql: string, params: unknown[] = []) {
  try {
    await asUser(db, user, () => rows(sql, params));
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${BASIC_CHURCH}', 'Basic church'), ('${PREMIUM_CHURCH}', 'Premium church');
    insert into church_subscriptions (church_id, plan_key, status) values
      ('${BASIC_CHURCH}', 'basic', 'active'), ('${PREMIUM_CHURCH}', 'premium', 'active');
    insert into auth.users (id) values ('${BASIC_MEMBER}'), ('${PREMIUM_MEMBER}');
    insert into app_users (id, church_id, name, email, role, status) values
      ('${BASIC_MEMBER}', '${BASIC_CHURCH}', 'Basic Member', 'b@b.test', 'member', 'active'),
      ('${PREMIUM_MEMBER}', '${PREMIUM_CHURCH}', 'Premium Member', 'p@p.test', 'member', 'active');
    insert into chat_channels (id, church_id, name, is_dm) values
      ('${BASIC_GENERAL}', '${BASIC_CHURCH}', 'General', false),
      ('${PREMIUM_GENERAL}', '${PREMIUM_CHURCH}', 'General', false);
  `);
}, 120_000);

describe("Basic plan", () => {
  test("plans_v4: Grace R249 (up to 100 members) and Grace Plus R599 (up to 500); 10 months' price a year", async () => {
    expect(await rows(`select key, name, member_limit, monthly_price::float as m, yearly_price::float as y from plans where key in ('basic', 'premium') order by monthly_price`)).toEqual([
      { key: "basic", name: "Grace", member_limit: 100, m: 249, y: 2490 },
      { key: "premium", name: "Grace Plus", member_limit: 500, m: 599, y: 5990 },
    ]);
  });

  test("Grace Plus has everything the old Unlimited had, plus AI pictures; AI allowances", async () => {
    const mods = async (plan: string) => (await rows(`select module_key from plan_modules where plan_key = '${plan}'`)).map((r) => r.module_key);
    expect(await mods("basic")).toContain("sermon_ai");
    const plus = await mods("premium");
    expect(plus).toEqual(expect.arrayContaining(["chat_photos", "sermon_uploads", "video_calls", "priority_support", "church_colours", "ai_pictures", "ai_counseling"]));
    for (const m of await mods("enterprise")) expect(plus).toContain(m);
    expect(await rows(`select key, ai_monthly_limit as n from plans where key in ('basic', 'premium') order by n`)).toEqual([
      { key: "basic", n: 100 },
      { key: "premium", n: 1000 },
    ]);
  });

  test("payments get invoice numbers from 1001", async () => {
    const [{ d }] = await rows(`select column_default as d from information_schema.columns where table_name = 'billing_payments' and column_name = 'invoice_no'`);
    expect(d).toContain("billing_invoice_no_seq");
  });

  test("Grace: every church feature and AI writing help, none of the costly switches", async () => {
    const basic = (await rows(`select module_key from plan_modules where plan_key = 'basic' order by 1`)).map((r) => r.module_key);
    expect(basic).toEqual(expect.arrayContaining(["bible", "dept_chats", "announcements", "prayer_board", "giving", "bible_games", "service_planner", "pastor_booking", "pastoral_care", "ai_assist", "bible_study_ai"]));
    for (const costly of ["video_calls", "chat_voice", "chat_photos", "sermon_uploads", "ai_counseling", "ai_pictures", "priority_support", "church_colours"]) {
      expect(basic).not.toContain(costly);
    }
  });

  test("plans that had AI writing help and voice notes keep them", async () => {
    const premium = (await rows(`select module_key from plan_modules where plan_key = 'premium'`)).map((r) => r.module_key);
    expect(premium).toEqual(expect.arrayContaining(["ai_assist", "chat_voice"]));
    const trial = (await rows(`select module_key from plan_modules where plan_key = 'free_trial'`)).map((r) => r.module_key);
    expect(trial).toContain("ai_assist");
  });
});

describe("voice notes follow the plan", () => {
  const voice = (church: string, channel: string, user: string) => [channel, user, `${church}/${channel}/${user}/note.webm`];
  const sendVoice = `insert into chat_messages (channel_id, sender_id, content, kind, media_path) values ($1, $2, '', 'voice', $3)`;

  test("a Basic church can chat in text but not send voice notes", async () => {
    expect(await attempt(BASIC_MEMBER, `insert into chat_messages (channel_id, sender_id, content) values ($1, $2, 'hello')`, [BASIC_GENERAL, BASIC_MEMBER])).toBeNull();
    expect(await attempt(BASIC_MEMBER, sendVoice, voice(BASIC_CHURCH, BASIC_GENERAL, BASIC_MEMBER))).toMatch(/row-level security/);
  });

  test("…and can't upload audio files directly either", async () => {
    const error = await attempt(BASIC_MEMBER, `insert into storage.objects (bucket_id, name) values ('chat-media', $1)`, [
      `${BASIC_CHURCH}/${BASIC_GENERAL}/${BASIC_MEMBER}/note.webm`,
    ]);
    expect(error).toMatch(/row-level security/);
  });

  test("a Premium church can", async () => {
    expect(
      await attempt(PREMIUM_MEMBER, `insert into storage.objects (bucket_id, name) values ('chat-media', $1)`, [`${PREMIUM_CHURCH}/${PREMIUM_GENERAL}/${PREMIUM_MEMBER}/note.webm`])
    ).toBeNull();
    expect(await attempt(PREMIUM_MEMBER, sendVoice, voice(PREMIUM_CHURCH, PREMIUM_GENERAL, PREMIUM_MEMBER))).toBeNull();
  });

  test("a Super-admin override can switch voice notes on for one Basic church", async () => {
    await db.query(`insert into church_modules (church_id, module_key, enabled) values ($1, 'chat_voice', true)`, [BASIC_CHURCH]);
    expect(await attempt(BASIC_MEMBER, sendVoice, voice(BASIC_CHURCH, BASIC_GENERAL, BASIC_MEMBER))).toBeNull();
  });
});
