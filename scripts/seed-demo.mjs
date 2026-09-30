// Demo/test data: one church, one login per role, and sample content.
//
//   SEED_CONFIRM=yes node --env-file=.env.local scripts/seed-demo.mjs
//
// SAFETY: this creates real auth users in whatever Supabase project your env
// points at. Only run it against a DEV/TEST project — never production.
// It refuses to run without SEED_CONFIRM=yes, and is idempotent: re-running
// reuses the existing demo church and users instead of duplicating them.

import { createClient } from "@supabase/supabase-js";

if (process.env.SEED_CONFIRM !== "yes") {
  console.error("Refusing to seed. Re-run with SEED_CONFIRM=yes against a DEV/TEST project only.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. via --env-file=.env.local).");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const PASSWORD = process.env.SEED_PASSWORD || "DemoPassword!2026";
const CHURCH_NAME = "Demo Community Church";

const USERS = [
  { email: "admin@demo.church.test", name: "Ada Admin", role: "church_admin", birth: "1980-10-03" },
  { email: "pastor@demo.church.test", name: "Paul Pastor", role: "pastor", birth: "1975-10-01" },
  { email: "leader@demo.church.test", name: "Lydia Leader", role: "department_leader", birth: "1992-03-14" },
  { email: "member@demo.church.test", name: "Matthew Member", role: "member", birth: "2001-10-05" },
];

function must(result, what) {
  if (result.error) {
    console.error(`✗ ${what}: ${result.error.message}`);
    process.exit(1);
  }
  return result.data;
}

async function ensureUser(email) {
  // listUsers is paginated; the demo project is small, so one page is enough.
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const existing = data?.users?.find((u) => u.email === email);
  if (existing) return existing.id;
  const created = must(
    await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true }),
    `create ${email}`
  );
  return created.user.id;
}

async function main() {
  let church = must(await db.from("churches").select("id").eq("name", CHURCH_NAME).maybeSingle(), "find church");
  if (!church) {
    church = must(await db.from("churches").insert({ name: CHURCH_NAME, email: "hello@demo.church.test" }).select("id").single(), "create church");
    must(
      await db.from("church_subscriptions").insert({
        church_id: church.id,
        plan_key: "sponsored", // every module unlocked for testing
        status: "active",
        is_lifetime: true,
        notes: "Demo seed data",
      }),
      "create subscription"
    );
  }

  const worship = must(
    await db.from("departments").upsert({ church_id: church.id, name: "Worship" }, { onConflict: "church_id,name" }).select("id").single(),
    "department"
  );

  const ids = {};
  for (const u of USERS) {
    const id = await ensureUser(u.email);
    ids[u.role] = id;
    must(
      await db.from("app_users").upsert({
        id,
        church_id: church.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: "active",
        department_id: u.role === "department_leader" ? worship.id : null,
      }),
      `profile ${u.email}`
    );
    must(await db.from("member_birthdays").upsert({ user_id: id, church_id: church.id, birth_date: u.birth }), `birthday ${u.email}`);
  }

  // Sample content (only if the church has none yet, so re-runs don't pile up).
  const { count } = await db.from("announcements").select("id", { count: "exact", head: true }).eq("church_id", church.id);
  if (!count) {
    const inAWeek = new Date(Date.now() + 7 * 86_400_000);
    must(
      await db.from("announcements").insert({
        church_id: church.id,
        author_id: ids.pastor,
        title: "Welcome to the demo church",
        body: "This is sample data created by scripts/seed-demo.mjs.",
        pinned: true,
      }),
      "announcement"
    );
    must(
      await db.from("events").insert({
        church_id: church.id,
        created_by: ids.pastor,
        title: "Sunday Service",
        location: "Main hall",
        start_time: inAWeek.toISOString(),
      }),
      "event"
    );
    must(
      await db.from("prayer_board_items").insert({
        church_id: church.id,
        user_id: ids.member,
        prayer_text: "Please pray for my exams next week.",
        category: "personal",
        scripture_refs: ["Philippians 4:6-7"],
        is_shared_request: true,
      }),
      "prayer"
    );
    must(
      await db.from("pastoral_care_logs").insert({
        church_id: church.id,
        member_id: ids.member,
        member_name: "Matthew Member",
        log_type: "follow_up",
        notes: "Sample confidential note — visible to pastor & admin only.",
        follow_up_date: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
        created_by: ids.pastor,
      }),
      "care log"
    );
  }

  console.log(`✓ Seeded "${CHURCH_NAME}". Sign in with any of these (password: ${PASSWORD}):`);
  for (const u of USERS) console.log(`   ${u.role.padEnd(18)} ${u.email}`);
}

main().catch((error) => {
  console.error("✗ Seed failed:", error);
  process.exit(1);
});
