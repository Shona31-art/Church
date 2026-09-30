-- ============================================================================
-- SECURITY FIX — app_users privilege escalation.  RUN THIS ON ANY EXISTING
-- DATABASE IMMEDIATELY (safe to re-run). New setups: run right after schema.sql.
--
-- The problem (in schema.sql): policy app_users_update_self allowed any
-- signed-in user to UPDATE *every column* of their own app_users row. Using
-- only the public anon key from a browser console, a member could:
--   * set role = 'church_admin'           → take over their church
--   * change church_id to another church  → read another church's data
--   * set role = 'super_admin', church_id = null → become PLATFORM admin
-- Separately, pastors/admins could never update OTHER members (the policy
-- only matched their own row), so role/status edits silently did nothing.
--
-- The fix:
--   1. A BEFORE UPDATE trigger that blocks changes to privileged columns
--      (role, church_id, status, department_id, email, id) unless the caller
--      is allowed. RLS can't compare old vs new values; a trigger can.
--   2. A policy letting pastors/church_admins update members of their own
--      church (the trigger still decides WHICH columns they may change).
-- ============================================================================

create or replace function is_church_shepherd(target_church uuid)
returns boolean as $$
  select exists (
    select 1 from app_users
    where id = auth.uid()
      and church_id = target_church
      and role in ('pastor', 'church_admin')
  );
$$ language sql stable security definer;

create or replace function protect_app_users_privileged_columns()
returns trigger as $$
declare
  caller_role   user_role;
  caller_church uuid;
begin
  -- No end-user session: service-role key (trusted server code, e.g. the
  -- invite flow or registration) or the SQL editor. Allowed.
  if auth.uid() is null then
    return new;
  end if;

  select role, church_id into caller_role, caller_church
  from app_users where id = auth.uid();

  if caller_role = 'super_admin' then
    return new;
  end if;

  if new.id is distinct from old.id or new.church_id is distinct from old.church_id then
    raise exception 'Not allowed to move an account to another church.' using errcode = '42501';
  end if;

  if new.email is distinct from old.email then
    raise exception 'Email changes must go through account settings.' using errcode = '42501';
  end if;

  if new.role = 'super_admin' then
    raise exception 'Not allowed to grant super_admin.' using errcode = '42501';
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.department_id is distinct from old.department_id then

    if caller_church is distinct from old.church_id
       or caller_role not in ('pastor', 'church_admin') then
      raise exception 'Only pastors and church admins can change roles, status or departments.' using errcode = '42501';
    end if;

    if old.id = auth.uid() and (new.role is distinct from old.role or new.status is distinct from old.status) then
      raise exception 'You can''t change your own role or status.' using errcode = '42501';
    end if;

    -- Only a church_admin may grant, remove or modify a church_admin.
    if (old.role = 'church_admin' or new.role = 'church_admin') and caller_role <> 'church_admin' then
      raise exception 'Only a church admin can change another church admin.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_protect_app_users on app_users;
create trigger trg_protect_app_users before update on app_users
  for each row execute function protect_app_users_privileged_columns();

-- Self-updates stay allowed (name, phone) — the trigger polices the rest.
drop policy if exists app_users_update_self on app_users;
create policy app_users_update_self on app_users
  for update using (id = auth.uid() or is_super_admin())
  with check (id = auth.uid() or is_super_admin());

drop policy if exists app_users_update_by_shepherd on app_users;
create policy app_users_update_by_shepherd on app_users
  for update using (is_church_shepherd(church_id))
  with check (is_church_shepherd(church_id));

-- ============================================================================
-- Part 2 — freeze church_id on every church-scoped table.
--
-- Postgres reuses an UPDATE policy's USING clause as its WITH CHECK when none
-- is given, so ownership-only policies like `user_id = auth.uid()` let an
-- owner rewrite church_id and push their row (prayer, announcement, event,
-- sermon...) into ANOTHER church's tenant. Rather than patch ~15 policies,
-- one trigger makes church_id immutable for end users on every table.
-- Only the service role (auth.uid() is null) or a super_admin may move rows.
-- ============================================================================

create or replace function prevent_church_id_change()
returns trigger as $$
begin
  if new.church_id is distinct from old.church_id
     and auth.uid() is not null
     and not is_super_admin() then
    raise exception 'church_id cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Attaches the trigger to a table if it exists (so this file can run before
-- or after the optional module schemas).
create or replace function freeze_church_id_on(tbl text)
returns void as $$
begin
  if to_regclass('public.' || tbl) is null then
    return;
  end if;
  execute format('drop trigger if exists trg_freeze_church_id on %I', tbl);
  execute format(
    'create trigger trg_freeze_church_id before update on %I for each row execute function prevent_church_id_change()',
    tbl
  );
end;
$$ language plpgsql;

-- One list, one function: called here AND again at the end of
-- church_os_features_schema.sql, because on a fresh install several of these
-- tables don't exist yet when this file runs (they're skipped, then attached
-- on the second call). Add new church-scoped tables to this list.
create or replace function freeze_church_id_everywhere()
returns void as $$
begin
  perform freeze_church_id_on(t) from unnest(array[
    'announcements', 'bible_quiz_attempts', 'bible_quiz_questions', 'chat_channels',
    'counseling_conversations', 'counseling_settings', 'departments', 'events', 'givings',
    'journal_emergency_access_requests', 'journal_entries', 'pastor_availability_blocks',
    'pastor_bookings', 'posters', 'prayer_board_items', 'service_plans', 'sermons',
    'support_tickets', 'member_birthdays', 'pastoral_care_logs', 'prayer_comments',
    'prayer_intercessions', 'ai_usage_events'
  ]) as t;
end;
$$ language plpgsql;

select freeze_church_id_everywhere();
-- (app_users is covered by trg_protect_app_users above; church_subscriptions,
-- church_modules and audit_logs are already super_admin-only for writes.)
