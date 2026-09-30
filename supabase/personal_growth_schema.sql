-- ============================================================================
-- PERSONAL SPIRITUAL GROWTH MODULE — Prayer Board + Private Journal
-- Run after schema.sql (and counseling_schema.sql if used).
-- ============================================================================

insert into modules (key, name, description) values
  ('prayer_board', 'AI Prayer Board', 'Personal visual prayer board with AI-suggested scripture'),
  ('journal', 'Private Spiritual Journal', 'Encrypted personal journal, private by default');

insert into plan_modules (plan_key, module_key) values
  ('free_trial', 'prayer_board'),
  ('free_trial', 'journal'),
  ('basic', 'prayer_board'),
  ('basic', 'journal'),
  ('premium', 'prayer_board'),
  ('premium', 'journal'),
  ('enterprise', 'prayer_board'),
  ('enterprise', 'journal'),
  ('sponsored', 'prayer_board'),
  ('sponsored', 'journal');
  -- Deliberately included even in free_trial/basic: this is the daily-habit
  -- feature that makes the app sticky. Gating it behind Premium would work
  -- against the "open the app every day, not just Sundays" goal.

-- ----------------------------------------------------------------------------
-- PRAYER BOARD
-- Personal, but not secret in the same way as the journal — members may
-- choose to share answered prayers as testimonies later, so this is
-- "private by default, shareable by choice" rather than "never visible".
-- ----------------------------------------------------------------------------
create table prayer_board_items (
  id              uuid primary key default uuid_generate_v4(),
  church_id       uuid not null references churches(id) on delete cascade,
  user_id         uuid not null references app_users(id) on delete cascade,

  image_url       text,
  prayer_text     text not null,
  scripture_refs  text[],           -- e.g. {'Jeremiah 29:11', 'Proverbs 16:3'}
  category        text,             -- 'family' | 'career' | 'health' | 'ministry' | etc.
  reflection      text,

  status          text not null default 'active' check (status in ('active', 'answered')),
  answered_at     timestamptz,
  answered_reflection text,

  is_testimony_shared boolean not null default false, -- member's explicit choice to publish as testimony
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_prayer_board_user on prayer_board_items(user_id);

alter table prayer_board_items enable row level security;

create policy prayer_board_select on prayer_board_items
  for select using (
    is_super_admin()
    or user_id = auth.uid()
    or (is_testimony_shared = true and church_id = current_church_id())
  );

create policy prayer_board_insert on prayer_board_items
  for insert with check (user_id = auth.uid() and church_id = current_church_id());

create policy prayer_board_update on prayer_board_items
  for update using (user_id = auth.uid());

create policy prayer_board_delete on prayer_board_items
  for delete using (user_id = auth.uid());

create trigger trg_prayer_board_updated_at before update on prayer_board_items
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- JOURNAL — private by default, encrypted at rest, no admin path to read it.
--
-- MVP encryption model (Option A — app-managed key):
--   Content is encrypted server-side with AES-256-GCM before it ever reaches
--   Postgres. Postgres stores only ciphertext + iv + auth tag. No SELECT
--   policy grants anyone but the author read access, AND the plaintext
--   never exists in the database even if RLS were somehow bypassed.
--   The encryption key lives in server environment config, not in the DB —
--   so a raw DB dump/leak alone does not expose journal contents.
-- ----------------------------------------------------------------------------
create table journal_entries (
  id              uuid primary key default uuid_generate_v4(),
  church_id       uuid not null references churches(id) on delete cascade,
  user_id         uuid not null references app_users(id) on delete cascade,

  encrypted_content  bytea not null,   -- AES-256-GCM ciphertext, encrypted/decrypted in app layer only
  iv                 bytea not null,   -- initialization vector, unique per entry
  auth_tag           bytea not null,   -- GCM auth tag

  has_scripture_ref  boolean not null default false,  -- metadata only, never the verse text itself
  has_voice_note     boolean not null default false,
  entry_date         date not null default current_date,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_journal_user on journal_entries(user_id);

alter table journal_entries enable row level security;

-- No is_super_admin() bypass here on purpose — see counseling_conversations
-- for the pattern used everywhere else in this schema; journal intentionally
-- breaks that pattern because the SOW requires true privacy, not "privacy
-- unless an admin needs to see it".
create policy journal_select on journal_entries
  for select using (user_id = auth.uid());

create policy journal_insert on journal_entries
  for insert with check (user_id = auth.uid() and church_id = current_church_id());

create policy journal_update on journal_entries
  for update using (user_id = auth.uid());

create policy journal_delete on journal_entries
  for delete using (user_id = auth.uid());

create trigger trg_journal_updated_at before update on journal_entries
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- EMERGENCY ACCESS PROTOCOL — never silent, always logged, requires a
-- deliberate two-step process. This does NOT bypass RLS automatically;
-- it is a manual, audited process the app enforces at the application layer,
-- not a backdoor query anyone can run.
-- ----------------------------------------------------------------------------
create table journal_emergency_access_requests (
  id                uuid primary key default uuid_generate_v4(),
  journal_entry_id  uuid references journal_entries(id) on delete set null,
  user_id           uuid not null references app_users(id),  -- whose journal
  church_id         uuid not null references churches(id),

  requested_by      uuid not null references app_users(id),  -- pastor/church_admin who initiated
  reason            text not null,                             -- required, freeform justification
  crisis_signal_source text,                                    -- e.g. 'counseling_escalation:<id>', 'manual_welfare_check'

  -- two-person rule: a second authorised person must approve before decryption happens
  approved_by       uuid references app_users(id),
  approved_at       timestamptz,

  member_notified_at timestamptz,     -- required before or immediately after access — never silent
  accessed_at        timestamptz,
  outcome_notes      text,

  created_at        timestamptz not null default now()
);

alter table journal_emergency_access_requests enable row level security;

-- Only super_admin and the church's pastor/church_admin can even see that a
-- request exists. The member is notified through the app's notification
-- system separately (application layer), not by granting them SELECT here,
-- since the notification is a one-way announcement, not ongoing visibility
-- into pastoral deliberation.
create policy journal_emergency_select on journal_emergency_access_requests
  for select using (
    is_super_admin()
    or (church_id = current_church_id() and exists (
      select 1 from app_users where id = auth.uid() and role in ('pastor', 'church_admin')
    ))
  );

create policy journal_emergency_insert on journal_emergency_access_requests
  for insert with check (
    church_id = current_church_id() and exists (
      select 1 from app_users where id = auth.uid() and role in ('pastor', 'church_admin')
    )
  );

-- ============================================================================
-- APPLICATION-LAYER RULE (enforce in code, not just DB):
-- Decrypting a journal_entries row for anyone other than user_id = auth.uid()
-- must ONLY happen via a code path that:
--   1. Requires an approved journal_emergency_access_requests row
--      (approved_by IS NOT NULL, requested_by != approved_by — two different people)
--   2. Sets member_notified_at before returning any decrypted content
--   3. Logs the access into audit_logs
-- There should be no "admin view journal" button anywhere in the UI.
-- The only path is the emergency protocol above.
-- ============================================================================
