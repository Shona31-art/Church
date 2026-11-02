import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Runs the real migration files against real Postgres (PGlite = Postgres
// compiled to WASM, in-process — no Docker/Supabase needed), with just enough
// of Supabase stubbed to make them load:
//   * auth.users + auth.uid()   (uid comes from a session setting we control)
//   * the `authenticated` role  (non-superuser, so RLS actually applies)
//   * storage.objects           (for storage_policies.sql)

// Same order as the README setup list. Keep these in sync.
export const MIGRATION_ORDER = [
  "schema.sql",
  "security_fix_app_users.sql",
  "counseling_schema.sql",
  "personal_growth_schema.sql",
  "announcements_schema.sql",
  "events_schema.sql",
  "sermons_schema.sql",
  "departments_policies.sql",
  "service_booking_schema.sql",
  "poster_bible_support_schema.sql",
  "chat_schema.sql",
  "dm_schema.sql",
  "billing_schema.sql",
  "storage_policies.sql",
  "bible_games_schema.sql",
  "bible_games_v2_schema.sql",
  "giving_schema.sql",
  "church_os_features_schema.sql",
  "booking_security_fix.sql",
  "support_security_fix.sql",
  "platform_hardening.sql",
  "chat_v2.sql",
  "plan_basic_v2.sql",
  "bible_games_v3.sql",
  "bible_games_content.sql",
  "chat_v3.sql",
  "bible_reader_v2.sql",
  "notifications.sql",
  "poster_editor.sql",
  "eft_giving.sql",
  "paystack_card_giving.sql",
  "church_move.sql",
  "email_sync.sql",
  "paystack_billing.sql",
  "church_logo.sql",
  "songs.sql",
  "counseling_delete.sql",
  "games_jigsaw.sql",
  "jigsaw_pictures.sql",
  "sermon_audio.sql",
  "plans_v3.sql",
  "activity_log.sql",
  "pastor_alerts.sql",
  "member_children.sql",
  "games_differences.sql",
  "sermon_video.sql",
  "video_calls.sql",
  "chat_notifications_v2.sql",
  "chat_v4.sql",
  "calls_v2.sql",
  "calls_v3.sql",
];

const SUPABASE_STUBS = `
  create schema if not exists auth;
  create table auth.users (id uuid primary key, email text);
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid
  $$;
  create or replace function auth.role() returns text language sql stable as $$ select 'authenticated' $$;
  create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;

  create schema if not exists storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
    select string_to_array(name, '/')
  $$;
  alter table storage.objects enable row level security;

  -- Supabase Realtime's authorization table (private channels). The topic of
  -- the channel being joined comes from a session setting we control.
  create schema if not exists realtime;
  create table realtime.messages (id bigserial primary key, topic text not null, extension text not null default 'broadcast', payload jsonb);
  create or replace function realtime.topic() returns text language sql stable as $$
    select current_setting('test.topic', true)
  $$;
  alter table realtime.messages enable row level security;

  do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
  do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
`;

const GRANTS = `
  grant usage on schema public, auth, storage to authenticated, anon;
  grant all on all tables in schema public to authenticated;
  grant all on all sequences in schema public to authenticated;
  grant execute on all functions in schema public to authenticated;
  grant execute on all functions in schema auth to authenticated;
  grant all on storage.objects to authenticated;
  grant usage on schema realtime to authenticated;
  grant all on realtime.messages to authenticated;
  grant all on sequence realtime.messages_id_seq to authenticated;
  grant execute on function realtime.topic() to authenticated;
`;

export async function createTestDb() {
  const db = await PGlite.create({ extensions: { uuid_ossp, pgcrypto } });
  await db.exec(SUPABASE_STUBS);

  const dir = join(__dirname, "..", "..", "supabase");
  for (const file of MIGRATION_ORDER) {
    const sql = readFileSync(join(dir, file), "utf8");
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  await db.exec(GRANTS);
  return db;
}

/**
 * Runs `fn` as a signed-in end user: role `authenticated` (RLS enforced) with
 * auth.uid() = userId. Pass null for "no user session" (service role).
 */
export async function asUser<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set test.uid = '${userId ?? ""}'`);
  if (userId) await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.exec("set test.uid = ''");
  }
}
