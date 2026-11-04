import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// church_life.sql (#60): testimonies, reading plans, prayer chain, rosters,
// certificates, sermon notes and live services — who sees and changes what.

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const PASTOR = "10000000-0000-0000-0000-000000000001";
const MEM = "10000000-0000-0000-0000-000000000002";
const MEM2 = "10000000-0000-0000-0000-000000000003";
const OUT = "20000000-0000-0000-0000-000000000001";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${A}', 'A'), ('${B}', 'B');
    insert into auth.users (id) values ('${PASTOR}'), ('${MEM}'), ('${MEM2}'), ('${OUT}');
    insert into app_users (id, church_id, name, email, role) values
      ('${PASTOR}', '${A}', 'Pastor', 'p@a.t', 'pastor'),
      ('${MEM}', '${A}', 'Mem', 'm@a.t', 'member'),
      ('${MEM2}', '${A}', 'Mem Two', 'm2@a.t', 'member'),
      ('${OUT}', '${B}', 'Out', 'o@b.t', 'pastor');
  `);
}, 120_000);

describe("testimonies", () => {
  let id: string;
  test("a member shares one; only they and pastors see it until approved; pastors are told", async () => {
    [{ id }] = await asUser(db, MEM, () => rows(`insert into testimonies (church_id, user_id, body) values ($1, $2, 'God healed my mother this week.') returning id`, [A, MEM]));
    expect(await asUser(db, MEM2, () => rows(`select id from testimonies`))).toEqual([]);
    expect(await asUser(db, PASTOR, () => rows(`select id from testimonies`))).toHaveLength(1);
    expect(await rows(`select user_id from notifications where type = 'testimony.submitted'`)).toEqual([{ user_id: PASTOR }]);
  });
  test("a member can't approve their own", async () => {
    await asUser(db, MEM, () => rows(`update testimonies set status = 'approved' where id = $1`, [id])).catch(() => null);
    expect((await rows(`select status from testimonies where id = $1`, [id]))[0].status).toBe("pending");
  });
  test("approved: everyone in the church sees it, the author is told; other churches don't", async () => {
    await asUser(db, PASTOR, () => rows(`update testimonies set status = 'approved', reviewed_by = $2, reviewed_at = now() where id = $1`, [id, PASTOR]));
    expect(await asUser(db, MEM2, () => rows(`select id from testimonies`))).toHaveLength(1);
    expect(await asUser(db, OUT, () => rows(`select id from testimonies`))).toEqual([]);
    expect(await rows(`select user_id from notifications where type = 'testimony.approved'`)).toEqual([{ user_id: MEM }]);
  });
});

describe("reading plans", () => {
  test("only pastors start church-wide plans; personal plans stay private", async () => {
    const days = JSON.stringify([{ readings: [{ book: "John", chapter: 1 }] }, { readings: [{ book: "John", chapter: 2 }] }]);
    await expect(asUser(db, MEM, () => rows(`insert into reading_plans (church_id, created_by, title, start_date, days, church_wide) values ($1, $2, 'X', current_date, $3, true)`, [A, MEM, days]))).rejects.toThrow();
    const [{ id: mine }] = await asUser(db, MEM, () => rows(`insert into reading_plans (church_id, created_by, title, start_date, days) values ($1, $2, 'Mine', current_date, $3) returning id`, [A, MEM, days]));
    const [{ id: church }] = await asUser(db, PASTOR, () => rows(`insert into reading_plans (church_id, created_by, title, start_date, days, church_wide) values ($1, $2, 'John in March', current_date, $3, true) returning id`, [A, PASTOR, days]));
    expect((await asUser(db, MEM2, () => rows(`select id from reading_plans`))).map((r) => r.id)).toEqual([church]);
    expect(await rows(`select count(*)::int as n from notifications where type = 'reading_plan.new'`)).toEqual([{ n: 2 }]);
    // Ticking days: only real days, only your own.
    await asUser(db, MEM2, () => rows(`insert into reading_progress (plan_id, user_id, church_id, day) values ($1, $2, $3, 1)`, [church, MEM2, A]));
    await expect(asUser(db, MEM2, () => rows(`insert into reading_progress (plan_id, user_id, church_id, day) values ($1, $2, $3, 3)`, [church, MEM2, A]))).rejects.toThrow();
    await expect(asUser(db, MEM2, () => rows(`insert into reading_progress (plan_id, user_id, church_id, day) values ($1, $2, $3, 1)`, [mine, MEM2, A]))).rejects.toThrow();
    expect(await asUser(db, MEM, () => rows(`select user_id from reading_progress where plan_id = $1`, [church]))).toEqual([{ user_id: MEM2 }]);
  });
});

describe("prayer chain", () => {
  let chain: string;
  test("pastors create a chain; members book real slots up to the limit", async () => {
    await expect(asUser(db, MEM, () => rows(`insert into prayer_chains (church_id, title, starts_at, ends_at) values ($1, 'X', now(), now() + interval '1 day')`, [A]))).rejects.toThrow();
    [{ id: chain }] = await asUser(db, PASTOR, () =>
      rows(`insert into prayer_chains (church_id, title, starts_at, ends_at, slot_minutes, max_per_slot, created_by) values ($1, 'Fast', date_trunc('hour', now()) + interval '1 hour', date_trunc('hour', now()) + interval '25 hours', 60, 1, $2) returning id`, [A, PASTOR]));
    const slot = (await rows(`select starts_at + interval '2 hours' as s from prayer_chains where id = $1`, [chain]))[0].s;
    await asUser(db, MEM, () => rows(`insert into prayer_chain_slots (chain_id, church_id, slot_start, user_id) values ($1, $2, $3, $4)`, [chain, A, slot, MEM]));
    await expect(asUser(db, MEM2, () => rows(`insert into prayer_chain_slots (chain_id, church_id, slot_start, user_id) values ($1, $2, $3, $4)`, [chain, A, slot, MEM2]))).rejects.toThrow(/full/);
    await expect(asUser(db, MEM2, () => rows(`insert into prayer_chain_slots (chain_id, church_id, slot_start, user_id) values ($1, $2, $3::timestamptz + interval '10 minutes', $4)`, [chain, A, slot, MEM2]))).rejects.toThrow(/not one of/);
    await expect(asUser(db, MEM2, () => rows(`insert into prayer_chain_slots (chain_id, church_id, slot_start, user_id) values ($1, $2, $3, $4)`, [chain, A, slot, MEM]))).rejects.toThrow();
  });
  test("reminders go once, about half an hour before", async () => {
    await db.exec(`update prayer_chain_slots set slot_start = date_trunc('minute', now()) + interval '20 minutes'`).catch(() => null);
    // The slot-time check is on insert only; move the slot to "soon" and run reminders twice.
    expect((await rows(`select run_due_reminders() as n`))[0].n).toBeGreaterThanOrEqual(1);
    expect((await rows(`select run_due_reminders() as n`))[0].n).toBe(0);
    expect(await rows(`select user_id from notifications where type = 'prayer_chain.reminder'`)).toEqual([{ user_id: MEM }]);
  });
  test("members can't run reminders", async () => {
    await expect(asUser(db, MEM, () => rows(`select run_due_reminders()`))).rejects.toThrow();
  });
});

describe("rosters", () => {
  let team: string;
  let duty: string;
  test("pastors make teams and duties; the person on duty is told", async () => {
    [{ id: team }] = await asUser(db, PASTOR, () => rows(`insert into roster_teams (church_id, name) values ($1, 'Ushers') returning id`, [A]));
    await asUser(db, PASTOR, () => rows(`insert into roster_team_members (team_id, user_id, church_id) values ($1, $2, $3), ($1, $4, $3)`, [team, MEM, A, MEM2]));
    [{ id: duty }] = await asUser(db, PASTOR, () => rows(`insert into roster_duties (team_id, church_id, duty_date, role, user_id) values ($1, $2, current_date + 7, 'Door', $3) returning id`, [team, A, MEM]));
    expect(await rows(`select user_id from notifications where type = 'roster.assigned'`)).toEqual([{ user_id: MEM }]);
    await expect(asUser(db, MEM, () => rows(`insert into roster_teams (church_id, name) values ($1, 'Mine')`, [A]))).rejects.toThrow();
    await expect(asUser(db, OUT, () => rows(`insert into roster_duties (team_id, church_id, duty_date) values ($1, $2, current_date)`, [team, B]))).rejects.toThrow();
  });
  test("swaps: only the person on duty asks, a team member takes it", async () => {
    await expect(asUser(db, MEM2, () => rows(`select request_roster_swap($1, 'x')`, [duty]))).rejects.toThrow(/Only the person/);
    await expect(asUser(db, MEM2, () => rows(`select take_roster_swap($1)`, [duty]))).rejects.toThrow(/no longer up/);
    await asUser(db, MEM, () => rows(`select request_roster_swap($1, 'Away that weekend')`, [duty]));
    expect(await rows(`select user_id from notifications where type = 'roster.swap_requested'`)).toEqual([{ user_id: MEM2 }]);
    await asUser(db, MEM2, () => rows(`select take_roster_swap($1)`, [duty]));
    expect(await rows(`select user_id, swap_requested from roster_duties where id = $1`, [duty])).toEqual([{ user_id: MEM2, swap_requested: false }]);
    expect(await rows(`select user_id from notifications where type = 'roster.swapped'`)).toEqual([{ user_id: MEM }]);
  });
});

describe("certificates, sermon notes, live services", () => {
  test("certificates: pastors issue; the member sees their own only", async () => {
    await expect(asUser(db, MEM, () => rows(`insert into certificates (church_id, kind, recipient_name, issued_on) values ($1, 'baptism', 'Me', current_date)`, [A]))).rejects.toThrow();
    const [{ certificate_no }] = await asUser(db, PASTOR, () =>
      rows(`insert into certificates (church_id, kind, recipient_name, member_id, issued_on) values ($1, 'baptism', 'Mem', $2, current_date) returning certificate_no`, [A, MEM]));
    expect(Number(certificate_no)).toBeGreaterThanOrEqual(1001);
    expect(await asUser(db, MEM, () => rows(`select id from certificates`))).toHaveLength(1);
    expect(await asUser(db, MEM2, () => rows(`select id from certificates`))).toEqual([]);
    await expect(asUser(db, PASTOR, () => rows(`insert into certificates (church_id, kind, recipient_name, issued_on) values ($1, 'course', 'X', current_date)`, [A]))).rejects.toThrow();
  });
  test("sermon notes: members see published ones only; live services are pastor-written", async () => {
    await asUser(db, PASTOR, () => rows(`insert into sermon_outlines (church_id, title, sermon_date, body) values ($1, 'Draft', current_date, 'God is [[love]].'), ($1, 'Out', current_date, 'x')`, [A]));
    await asUser(db, PASTOR, () => rows(`update sermon_outlines set published = true where title = 'Out'`));
    expect((await asUser(db, MEM, () => rows(`select title from sermon_outlines`))).map((r) => r.title)).toEqual(["Out"]);
    await expect(asUser(db, MEM, () => rows(`insert into live_services (church_id, title, starts_at) values ($1, 'X', now())`, [A]))).rejects.toThrow();
    await asUser(db, PASTOR, () => rows(`insert into live_services (church_id, title, starts_at, stream_url) values ($1, 'Sunday', now(), 'https://youtu.be/abcdefghijk')`, [A]));
    expect(await asUser(db, MEM, () => rows(`select title from live_services`))).toEqual([{ title: "Sunday" }]);
    await expect(asUser(db, PASTOR, () => rows(`insert into live_services (church_id, title, starts_at, stream_url) values ($1, 'Bad', now(), 'javascript:alert(1)')`, [A]))).rejects.toThrow();
  });
  test("plans: Basic gets the everyday features, Premium gets rosters, certificates and the report", async () => {
    const basic = (await rows(`select module_key from plan_modules where plan_key = 'basic'`)).map((r) => r.module_key);
    expect(basic).toEqual(expect.arrayContaining(["live_sunday", "sermon_notes", "testimonies", "reading_plans", "prayer_chain"]));
    for (const k of ["rosters", "certificates", "weekly_report"]) expect(basic).not.toContain(k);
    const premium = (await rows(`select module_key from plan_modules where plan_key = 'premium'`)).map((r) => r.module_key);
    expect(premium).toEqual(expect.arrayContaining(["rosters", "certificates", "weekly_report"]));
  });
});

describe("priority support", () => {
  test("tickets from Unlimited churches are high priority; others stay normal", async () => {
    await db.exec(`insert into church_subscriptions (church_id, plan_key, status) values ('${A}', 'enterprise', 'active'), ('${B}', 'basic', 'active') on conflict (church_id) do update set plan_key = excluded.plan_key`);
    await db.exec(`insert into support_tickets (church_id, created_by, subject) values ('${A}', '${PASTOR}', 'Help'), ('${B}', '${OUT}', 'Help')`);
    expect(await rows(`select church_id, priority from support_tickets order by priority`)).toEqual([
      { church_id: A, priority: "high" },
      { church_id: B, priority: "normal" },
    ]);
  });
});

describe("certificates v2", () => {
  test("custom certificates need a title; designs and colours are checked", async () => {
    await asUser(db, PASTOR, () =>
      rows(`insert into certificates (church_id, kind, recipient_name, issued_on, custom_title, custom_line, design, colour) values ($1, 'custom', 'Sis Mary', current_date, 'Certificate of Appreciation', 'in grateful recognition of faithful service', 'modern', 'royal')`, [A]));
    await expect(asUser(db, PASTOR, () => rows(`insert into certificates (church_id, kind, recipient_name, issued_on) values ($1, 'custom', 'X', current_date)`, [A]))).rejects.toThrow();
    await expect(asUser(db, PASTOR, () => rows(`insert into certificates (church_id, kind, recipient_name, issued_on, design) values ($1, 'baptism', 'X', current_date, 'elegant')`, [A]))).rejects.toThrow();
    expect(await rows(`select design, colour from certificates where kind = 'baptism' limit 1`)).toEqual([{ design: "modern", colour: "royal" }]);
  });
});

describe("prayer chain v2", () => {
  test("set times only; pastors can put people in; people add their own prayer", async () => {
    const [{ id }] = await asUser(db, PASTOR, () =>
      rows(`insert into prayer_chains (church_id, title, starts_at, ends_at, slot_minutes, max_per_slot, times, created_by)
            values ($1, 'Set times', date_trunc('day', now() at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg' + interval '1 day',
                    date_trunc('day', now() at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg' + interval '4 days', 30, 3, '{05:00,15:00,18:00}', $2) returning id`, [A, PASTOR]));
    const day = (await rows(`select (date_trunc('day', now() at time zone 'Africa/Johannesburg') + interval '2 days')::date::text as d`))[0].d;
    const at = (hm: string) => `${day} ${hm}:00+02`;
    // At a set time: fine. Between set times: refused.
    await asUser(db, MEM, () => rows(`insert into prayer_chain_slots (chain_id, church_id, slot_start, user_id) values ($1, $2, $3, $4)`, [id, A, at("15:00"), MEM]));
    await expect(asUser(db, MEM, () => rows(`insert into prayer_chain_slots (chain_id, church_id, slot_start, user_id) values ($1, $2, $3, $4)`, [id, A, at("16:00"), MEM]))).rejects.toThrow(/not one of/);
    // A member can't put someone else in; a pastor can, and they're told.
    await expect(asUser(db, MEM, () => rows(`insert into prayer_chain_slots (chain_id, church_id, slot_start, user_id) values ($1, $2, $3, $4)`, [id, A, at("05:00"), MEM2]))).rejects.toThrow();
    await asUser(db, PASTOR, () => rows(`insert into prayer_chain_slots (chain_id, church_id, slot_start, user_id) values ($1, $2, $3, $4)`, [id, A, at("05:00"), MEM2]));
    expect(await rows(`select user_id from notifications where type = 'prayer_chain.assigned'`)).toEqual([{ user_id: MEM2 }]);
    // Prayers: your own slot only.
    await asUser(db, MEM, () => rows(`update prayer_chain_slots set prayer_text = 'Lord, heal our land', prayed_at = now() where chain_id = $1 and user_id = $2`, [id, MEM]));
    await asUser(db, MEM, () => rows(`update prayer_chain_slots set prayer_text = 'hijack' where chain_id = $1 and user_id = $2`, [id, MEM2]));
    expect(await rows(`select user_id, prayer_text from prayer_chain_slots where chain_id = $1 order by slot_start`, [id])).toEqual([
      { user_id: MEM2, prayer_text: null },
      { user_id: MEM, prayer_text: "Lord, heal our land" },
    ]);
  });
});
