-- ============================================================================
-- MIGRATION #44 — Members' children (names and birthdays). Run after
-- pastor_alerts.sql (#43).
--
-- In plain language:
--   * A member can list their children on My account: a first name (or full
--     name) and, if they like, a birthday. Up to 20 children per member.
--   * Who can see them: the parent, and their church's pastors and church
--     admins — exactly the same people who can see the parent's own birthday.
--     Other members can't.
--   * Pastors and church admins can also add, change or remove children on a
--     member's profile (e.g. for families who don't use the app much).
--   * Children's birthdays appear in the pastors' "Birthdays this week" list.
--   * If the platform admin moves the parent to another church, the children
--     move with them. Removing the parent removes their children's entries.
--   * Every add/change/remove is recorded in the audit log (no names stored).
-- Safe to re-run.
-- ============================================================================

create table if not exists member_children (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references app_users(id) on delete cascade, -- the parent
  church_id   uuid not null references churches(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  birth_date  date check (birth_date >= date '1900-01-01'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users(id) on delete set null
);
create index if not exists idx_member_children_user on member_children(user_id, birth_date);
create index if not exists idx_member_children_church on member_children(church_id);

alter table member_children enable row level security;

-- Same audience as member_birthdays: the parent and their church's shepherds.
drop policy if exists member_children_select on member_children;
create policy member_children_select on member_children
  for select using (user_id = auth.uid() or is_church_shepherd(church_id));

-- Writes: the parent (in their own church) or a shepherd of that church — and
-- the parent must actually belong to the church the row is filed under.
drop policy if exists member_children_write on member_children;
create policy member_children_write on member_children
  for all using (
    (user_id = auth.uid() and church_id = current_church_id()) or is_church_shepherd(church_id)
  ) with check (
    ((user_id = auth.uid() and church_id = current_church_id()) or is_church_shepherd(church_id))
    and exists (select 1 from app_users u where u.id = member_children.user_id and u.church_id = member_children.church_id)
  );

drop trigger if exists trg_member_children_updated_at on member_children;
create trigger trg_member_children_updated_at before update on member_children
  for each row execute function set_updated_at();

-- A child can't be re-assigned to a different parent; church_id is frozen too.
create or replace function app_private.member_children_guard()
returns trigger as $$
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'A child entry cannot be moved to another member.';
  end if;
  if tg_op = 'INSERT' and (select count(*) from member_children where user_id = new.user_id) >= 20 then
    raise exception 'A member can list at most 20 children.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_member_children_guard on member_children;
create trigger trg_member_children_guard before insert or update on member_children
  for each row execute function app_private.member_children_guard();

select freeze_church_id_on('member_children');

-- Keep the shared list in sync for future re-runs of the hardening scripts.
create or replace function freeze_church_id_everywhere()
returns void as $$
begin
  perform freeze_church_id_on(t) from unnest(array[
    'announcements', 'bible_quiz_attempts', 'bible_quiz_questions', 'chat_channels',
    'counseling_conversations', 'counseling_settings', 'departments', 'events', 'givings',
    'journal_emergency_access_requests', 'journal_entries', 'pastor_availability_blocks',
    'pastor_bookings', 'posters', 'prayer_board_items', 'service_plans', 'sermons',
    'support_tickets', 'member_birthdays', 'pastoral_care_logs', 'prayer_comments',
    'prayer_intercessions', 'ai_usage_events', 'member_children'
  ]) as t;
end;
$$ language plpgsql;

-- Audit log (activity_log.sql): field names only, never the child's name.
drop trigger if exists trg_audit_member_children on member_children;
create trigger trg_audit_member_children after insert or update or delete on member_children
  for each row execute function public.audit_row_change('child');

-- Children follow the parent when the platform admin moves them to another
-- church (church_id is frozen, so remove + re-add with the same ids).
create or replace function app_private.move_member_children()
returns trigger as $$
begin
  if old.church_id is null or new.church_id is not distinct from old.church_id then
    return null;
  end if;
  if new.church_id is null then
    delete from member_children where user_id = new.id;
    return null;
  end if;
  with moved as (
    delete from member_children where user_id = new.id and church_id = old.church_id
    returning id, user_id, name, birth_date, created_at
  )
  insert into member_children (id, user_id, church_id, name, birth_date, created_at, updated_by)
  select id, user_id, new.church_id, name, birth_date, created_at, auth.uid() from moved;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_member_children_follow_move on app_users;
create trigger trg_member_children_follow_move after update of church_id on app_users
  for each row execute function app_private.move_member_children();

revoke all on all functions in schema app_private from public;
