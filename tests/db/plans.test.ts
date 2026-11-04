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
  test("allows 50 members; prices are R250 / R500 / R1,000 a month, 10 months' price a year", async () => {
    expect(await rows(`select member_limit from plans where key = 'basic'`)).toEqual([{ member_limit: 50 }]);
    expect(await rows(`select key, monthly_price::float as m, yearly_price::float as y from plans where key in ('basic', 'premium', 'enterprise') order by monthly_price`)).toEqual([
      { key: "basic", m: 250, y: 2500 },
      { key: "premium", m: 500, y: 5000 },
      { key: "enterprise", m: 1000, y: 10000 },
    ]);
  });

  test("plans (Nov 2026): Basic has Sermons as links; Premium adds uploads and photos; Unlimited adds priority support and colours; AI allowances", async () => {
    const mods = async (plan: string) => (await rows(`select module_key from plan_modules where plan_key = '${plan}'`)).map((r) => r.module_key);
    expect(await mods("basic")).toContain("sermon_ai");
    expect(await mods("premium")).toEqual(expect.arrayContaining(["chat_photos", "sermon_uploads", "video_calls"]));
    expect(await mods("premium")).not.toContain("priority_support");
    expect(await mods("enterprise")).toEqual(expect.arrayContaining(["priority_support", "church_colours", "sermon_uploads"]));
    expect(await rows(`select key, ai_monthly_limit as n from plans where key in ('basic', 'premium', 'enterprise') order by n`)).toEqual([
      { key: "basic", n: 0 },
      { key: "premium", n: 300 },
      { key: "enterprise", n: 1000 },
    ]);
  });

  test("payments get invoice numbers from 1001", async () => {
    const [{ d }] = await rows(`select column_default as d from information_schema.columns where table_name = 'billing_payments' and column_name = 'invoice_no'`);
    expect(d).toContain("billing_invoice_no_seq");
  });

  test("includes the free-to-run features and none of the costly switches", async () => {
    const basic = (await rows(`select module_key from plan_modules where plan_key = 'basic' order by 1`)).map((r) => r.module_key);
    expect(basic).toEqual(expect.arrayContaining(["bible", "dept_chats", "announcements", "prayer_board", "giving", "bible_games"]));
    // billing_v4.sql: the leadership tools are Premium and up.
    for (const premiumOnly of ["service_planner", "pastor_booking", "pastoral_care", "video_calls"]) expect(basic).not.toContain(premiumOnly);
    for (const costly of ["ai_assist", "chat_voice", "chat_photos", "sermon_uploads", "ai_counseling", "ai_poster", "bible_study_ai"]) {
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
