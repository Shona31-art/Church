-- ============================================================================
-- CHURCH OS FEATURE PORT — run AFTER every other file in the README list.
--
-- Plain-language summary of what this migration does:
--   1. member_birthdays  — optional birth dates, visible only to the member
--                          themselves and their church's pastors/admins
--                          (NOT on app_users, which every member can read).
--   2. pastoral_care_logs — confidential visit/counselling notes. Readable
--                          ONLY by pastors/church_admins of that church.
--                          Deliberately no super_admin bypass (same stance
--                          as the journal): platform staff never read these.
--   3. Church prayer wall — members can choose to share an active prayer
--                          request with their church; others can leave an
--                          encouragement comment or tap "I prayed".
--   4. Verse Puzzle game type for the scoreboard.
--   5. ai_usage_events   — per-user AI call log used for rate limiting
--                          (AI calls cost money; one user must not be able
--                          to run up the bill).
--   6. New module keys: pastoral_care, bible_study_ai.
--
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Module registration
-- ----------------------------------------------------------------------------
insert into modules (key, name, description) values
  ('pastoral_care',  'Pastoral Care Log',  'Confidential visit & follow-up log, birthday reach-outs'),
  ('bible_study_ai', 'Bible Study AI',     'AI passage explanations, devotionals, cross-references, reading plans')
on conflict (key) do nothing;

-- Pastoral care is core shepherding work, so every plan gets it.
-- Bible Study AI follows the same tiering as the other AI tools.
insert into plan_modules (plan_key, module_key) values
  ('free_trial', 'pastoral_care'), ('basic', 'pastoral_care'), ('premium', 'pastoral_care'),
  ('enterprise', 'pastoral_care'), ('sponsored', 'pastoral_care'),
  ('free_trial', 'bible_study_ai'), ('premium', 'bible_study_ai'),
  ('enterprise', 'bible_study_ai'), ('sponsored', 'bible_study_ai')
on conflict do nothing;

-- Helper: is the caller a pastor or church_admin of the given church?
create or replace function is_church_shepherd(target_church uuid)
returns boolean as $$
  select exists (
    select 1 from app_users
    where id = auth.uid()
      and church_id = target_church
      and role in ('pastor', 'church_admin')
  );
$$ language sql stable security definer;

-- ----------------------------------------------------------------------------
-- 1. MEMBER BIRTHDAYS
-- ----------------------------------------------------------------------------
create table if not exists member_birthdays (
  user_id     uuid primary key references app_users(id) on delete cascade,
  church_id   uuid not null references churches(id) on delete cascade,
  birth_date  date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users(id) on delete set null
);
create index if not exists idx_member_birthdays_church on member_birthdays(church_id);

alter table member_birthdays enable row level security;

drop policy if exists member_birthdays_select on member_birthdays;
create policy member_birthdays_select on member_birthdays
  for select using (user_id = auth.uid() or is_church_shepherd(church_id));

drop policy if exists member_birthdays_write on member_birthdays;
create policy member_birthdays_write on member_birthdays
  for all using (
    (user_id = auth.uid() and church_id = current_church_id()) or is_church_shepherd(church_id)
  ) with check (
    (user_id = auth.uid() and church_id = current_church_id()) or is_church_shepherd(church_id)
  );

drop trigger if exists trg_member_birthdays_updated_at on member_birthdays;
create trigger trg_member_birthdays_updated_at before update on member_birthdays
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. PASTORAL CARE LOGS (sensitive)
-- ----------------------------------------------------------------------------
create table if not exists pastoral_care_logs (
  id               uuid primary key default uuid_generate_v4(),
  church_id        uuid not null references churches(id) on delete cascade,
  member_id        uuid references app_users(id) on delete set null,
  member_name      text not null,          -- kept even if the person isn't an app user (e.g. a visitor in hospital)
  log_type         text not null check (log_type in (
                     'counseling', 'hospital_visit', 'home_visit', 'follow_up',
                     'crisis_session', 'bereavement', 'birthday_reachout', 'other')),
  notes            text not null,
  location         text,
  follow_up_date   date,
  follow_up_done   boolean not null default false,
  created_by       uuid references app_users(id) on delete set null,
  updated_by       uuid references app_users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_pastoral_logs_church on pastoral_care_logs(church_id, created_at desc);
create index if not exists idx_pastoral_logs_member on pastoral_care_logs(member_id);
create index if not exists idx_pastoral_logs_followup on pastoral_care_logs(church_id, follow_up_date)
  where follow_up_done = false;

alter table pastoral_care_logs enable row level security;

drop policy if exists pastoral_logs_all on pastoral_care_logs;
create policy pastoral_logs_all on pastoral_care_logs
  for all using (is_church_shepherd(church_id))
  with check (is_church_shepherd(church_id));

drop trigger if exists trg_pastoral_logs_updated_at on pastoral_care_logs;
create trigger trg_pastoral_logs_updated_at before update on pastoral_care_logs
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. CHURCH PRAYER WALL
-- ----------------------------------------------------------------------------
alter table prayer_board_items add column if not exists is_shared_request boolean not null default false;
create index if not exists idx_prayer_board_shared on prayer_board_items(church_id, created_at desc)
  where is_shared_request = true;

-- Replace the select policy so shared *requests* (not only answered
-- testimonies) are visible to the member's own church.
drop policy if exists prayer_board_select on prayer_board_items;
create policy prayer_board_select on prayer_board_items
  for select using (
    is_super_admin()
    or user_id = auth.uid()
    or ((is_testimony_shared = true or is_shared_request = true) and church_id = current_church_id())
  );

-- Moderation: pastors/church_admins can take a prayer OFF the wall (never
-- edit it, never read private ones). Done through a narrow function rather
-- than an UPDATE policy: once un-shared, the row is no longer visible to the
-- pastor, and Postgres rejects an UPDATE whose resulting row the caller
-- can't see — so a plain policy could never work here.
drop policy if exists prayer_board_moderate on prayer_board_items;

create or replace function unshare_prayer(target_prayer uuid)
returns boolean as $$
declare
  target_church uuid;
begin
  select church_id into target_church from prayer_board_items
  where id = target_prayer and (is_shared_request or is_testimony_shared);
  if target_church is null or not is_church_shepherd(target_church) then
    return false;
  end if;
  update prayer_board_items
    set is_shared_request = false, is_testimony_shared = false
    where id = target_prayer;
  return true;
end;
$$ language plpgsql security definer set search_path = public;

-- Defence in depth: no one but the owner may change anything except turning
-- sharing off, however an update arrives.
create or replace function restrict_prayer_moderation()
returns trigger as $$
begin
  if auth.uid() is not null and auth.uid() <> old.user_id and not is_super_admin() then
    if (to_jsonb(new) - 'is_shared_request' - 'is_testimony_shared' - 'updated_at')
       is distinct from (to_jsonb(old) - 'is_shared_request' - 'is_testimony_shared' - 'updated_at')
       or (new.is_shared_request and not old.is_shared_request)
       or (new.is_testimony_shared and not old.is_testimony_shared) then
      raise exception 'Moderators can only remove a prayer from the wall.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_restrict_prayer_moderation on prayer_board_items;
create trigger trg_restrict_prayer_moderation before update on prayer_board_items
  for each row execute function restrict_prayer_moderation();

create table if not exists prayer_comments (
  id          uuid primary key default uuid_generate_v4(),
  prayer_id   uuid not null references prayer_board_items(id) on delete cascade,
  church_id   uuid not null references churches(id) on delete cascade,
  user_id     uuid not null references app_users(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_prayer_comments_prayer on prayer_comments(prayer_id, created_at);

alter table prayer_comments enable row level security;

-- Visible when the parent prayer is visible to the caller (RLS on the
-- subquery applies, so a private prayer's comments stay private).
drop policy if exists prayer_comments_select on prayer_comments;
create policy prayer_comments_select on prayer_comments
  for select using (
    church_id = current_church_id()
    and exists (select 1 from prayer_board_items p where p.id = prayer_id)
  );

drop policy if exists prayer_comments_insert on prayer_comments;
create policy prayer_comments_insert on prayer_comments
  for insert with check (
    user_id = auth.uid() and church_id = current_church_id()
    and exists (
      select 1 from prayer_board_items p
      where p.id = prayer_id and p.church_id = current_church_id()
        and (p.is_shared_request or p.is_testimony_shared or p.user_id = auth.uid())
    )
  );

drop policy if exists prayer_comments_delete on prayer_comments;
create policy prayer_comments_delete on prayer_comments
  for delete using (user_id = auth.uid() or is_church_shepherd(church_id));

drop trigger if exists trg_prayer_comments_updated_at on prayer_comments;
create trigger trg_prayer_comments_updated_at before update on prayer_comments
  for each row execute function set_updated_at();

-- "I prayed for this" — one row per person per prayer, so the count is honest.
create table if not exists prayer_intercessions (
  prayer_id   uuid not null references prayer_board_items(id) on delete cascade,
  user_id     uuid not null references app_users(id) on delete cascade,
  church_id   uuid not null references churches(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (prayer_id, user_id)
);

alter table prayer_intercessions enable row level security;

drop policy if exists prayer_intercessions_select on prayer_intercessions;
create policy prayer_intercessions_select on prayer_intercessions
  for select using (church_id = current_church_id());

drop policy if exists prayer_intercessions_insert on prayer_intercessions;
create policy prayer_intercessions_insert on prayer_intercessions
  for insert with check (
    user_id = auth.uid() and church_id = current_church_id()
    and exists (select 1 from prayer_board_items p where p.id = prayer_id and p.church_id = current_church_id())
  );

drop policy if exists prayer_intercessions_delete on prayer_intercessions;
create policy prayer_intercessions_delete on prayer_intercessions
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. Verse Puzzle game type
-- ----------------------------------------------------------------------------
alter table bible_quiz_attempts drop constraint if exists bible_quiz_attempts_game_type_check;
alter table bible_quiz_attempts add constraint bible_quiz_attempts_game_type_check
  check (game_type in ('quiz', 'word_search', 'verse_puzzle'));

-- ----------------------------------------------------------------------------
-- 5. AI usage log (rate limiting)
-- ----------------------------------------------------------------------------
create table if not exists ai_usage_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references app_users(id) on delete cascade,
  church_id   uuid references churches(id) on delete cascade,
  feature     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ai_usage_user_time on ai_usage_events(user_id, created_at desc);

alter table ai_usage_events enable row level security;

drop policy if exists ai_usage_select on ai_usage_events;
create policy ai_usage_select on ai_usage_events
  for select using (user_id = auth.uid() or is_super_admin());

drop policy if exists ai_usage_insert on ai_usage_events;
create policy ai_usage_insert on ai_usage_events
  for insert with check (user_id = auth.uid());

-- ============================================================================
-- POPIA note: member_birthdays, pastoral_care_logs, prayer_comments and
-- prayer_intercessions all cascade-delete with the member's app_users row.
-- pastoral_care_logs.member_id is only set null (the typed member_name is
-- still there), so a POPIA erasure request must also delete that person's
-- care logs — the "Delete member data" action on /dashboard/members/[id]
-- does this. /api/members/[id]/export returns everything we hold on them.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 7. Make member deletion (and POPIA erasure) actually possible.
--
-- 22 foreign keys pointed at app_users with no ON DELETE rule, so deleting
-- anyone who had ever posted, given, chatted or booked failed with an FK
-- error (the old UI ignored it — the button appeared to do nothing).
-- Each is now explicit:
--   CASCADE  — the person's own data (their messages, tickets, bookings)
--   SET NULL — church records that must outlive the author (announcements,
--              events, sermons, care logs) and giving records, which are kept
--              for financial/tax retention but de-identified.
-- ----------------------------------------------------------------------------
create or replace function set_app_user_fk(tbl text, col text, action text)
returns void as $$
declare
  con text;
begin
  if to_regclass('public.' || tbl) is null then
    return;
  end if;
  for con in
    select c.conname from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = ('public.' || tbl)::regclass and c.contype = 'f'
      and c.confrelid = 'public.app_users'::regclass and a.attname = col
  loop
    execute format('alter table %I drop constraint %I', tbl, con);
  end loop;
  if action = 'set null' then
    execute format('alter table %I alter column %I drop not null', tbl, col);
  end if;
  execute format(
    'alter table %I add constraint %I foreign key (%I) references app_users(id) on delete %s',
    tbl, tbl || '_' || col || '_fkey', col, action
  );
end;
$$ language plpgsql;

select set_app_user_fk(tbl, col, action) from (values
  ('chat_messages', 'sender_id', 'cascade'),
  ('support_tickets', 'created_by', 'cascade'),
  ('support_ticket_messages', 'sender_id', 'cascade'),
  ('pastor_bookings', 'requested_by', 'cascade'),
  ('journal_emergency_access_requests', 'user_id', 'cascade'),
  ('givings', 'user_id', 'set null'),
  ('announcements', 'author_id', 'set null'),
  ('events', 'created_by', 'set null'),
  ('sermons', 'created_by', 'set null'),
  ('posters', 'created_by', 'set null'),
  ('service_plans', 'created_by', 'set null'),
  ('service_plan_items', 'assigned_to', 'set null'),
  ('pastor_bookings', 'pastor_id', 'set null'),
  ('pastor_availability_blocks', 'pastor_id', 'cascade'),
  ('bible_quiz_questions', 'created_by', 'set null'),
  ('counseling_settings', 'escalation_pastor_id', 'set null'),
  ('counseling_escalations', 'notified_user_id', 'set null'),
  ('journal_emergency_access_requests', 'requested_by', 'set null'),
  ('journal_emergency_access_requests', 'approved_by', 'set null'),
  ('church_modules', 'set_by', 'set null'),
  ('pastoral_care_logs', 'created_by', 'set null'),
  ('pastoral_care_logs', 'updated_by', 'set null')
) as fks(tbl, col, action);

-- Attach the church_id freeze (security_fix_app_users.sql) to every
-- church-scoped table now that they all exist. Required — if this raises
-- "function does not exist", run security_fix_app_users.sql first.
select freeze_church_id_everywhere();
