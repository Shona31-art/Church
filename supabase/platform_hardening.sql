-- ============================================================================
-- PLATFORM HARDENING — run after support_security_fix.sql. Safe to re-run.
--
-- Plain-language summary:
--   1. Disabled accounts lose access. Before, "Deactivate member" only changed
--      a label — the person could still sign in and read everything.
--   2. Direct messages: anyone signed in could add themselves to any DM and
--      read it (the membership insert policy was always true), and the
--      membership read policy referred to itself, which Postgres rejects.
--      DMs are now created only through start_direct_message().
--   3. AI counseling: crisis flags and pastor escalations silently failed
--      (no policy allowed them). Members can now share a conversation with a
--      pastor; flags are written by trusted server code only; pastors can
--      acknowledge escalations.
--   4. RSVPs only for events you can actually see; you can remove your RSVP.
--   5. Department leaders can no longer turn their department announcement or
--      event into a church-wide one by editing it.
--   6. New lifecycle columns: announcement drafts/archive, event
--      cancellation, booking cancellation by the requester, poster edits.
--   7. Stripe webhook idempotency table (each Stripe event handled once).
--   8. Data-integrity checks and indexes for common filters.
--
-- Nothing here deletes or rewrites existing data. New CHECK constraints are
-- added NOT VALID, so old rows that don't fit are left alone (new writes are
-- still checked).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Disabled accounts lose access
-- ----------------------------------------------------------------------------
-- Every church-scoped policy compares against current_church_id(), so making
-- it return null for a disabled account cuts off all church data in one place.
-- The person can still read their own app_users row (id = auth.uid()), which
-- the app uses to show "your account has been deactivated".
create or replace function current_church_id()
returns uuid as $$
  select church_id from app_users where id = auth.uid() and status <> 'disabled';
$$ language sql stable security definer set search_path = public;

create or replace function is_super_admin()
returns boolean as $$
  select exists (
    select 1 from app_users
    where id = auth.uid() and role = 'super_admin' and status <> 'disabled'
  );
$$ language sql stable security definer set search_path = public;

create or replace function is_church_shepherd(target_church uuid)
returns boolean as $$
  select exists (
    select 1 from app_users
    where id = auth.uid()
      and church_id = target_church
      and role in ('pastor', 'church_admin')
      and status <> 'disabled'
  );
$$ language sql stable security definer set search_path = public;

create or replace function is_shepherd_of(uid uuid, church uuid)
returns boolean as $$
  select exists (
    select 1 from app_users
    where id = uid and church_id = church and role in ('pastor', 'church_admin') and status <> 'disabled'
  );
$$ language sql stable security definer set search_path = public;

-- The app only ever writes these three values.
alter table app_users drop constraint if exists app_users_status_check;
alter table app_users add constraint app_users_status_check
  check (status in ('active', 'invited', 'disabled')) not valid;

create index if not exists idx_app_users_church_status on app_users(church_id, status);

-- ----------------------------------------------------------------------------
-- 2. Direct messages
-- ----------------------------------------------------------------------------
create or replace function is_chat_member(target_channel uuid)
returns boolean as $$
  select exists (
    select 1 from chat_channel_members
    where channel_id = target_channel and user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

drop policy if exists chat_channel_members_select on chat_channel_members;
create policy chat_channel_members_select on chat_channel_members
  for select using (user_id = auth.uid() or is_chat_member(channel_id));

-- No insert policy at all: membership rows are only created inside
-- start_direct_message(), which checks both people are in the same church.
drop policy if exists chat_channel_members_insert on chat_channel_members;

create index if not exists idx_chat_channel_members_user on chat_channel_members(user_id);

/**
 * Returns the DM channel between the caller and `other_user`, creating it if
 * needed. Both must be active members of the same church.
 */
create or replace function start_direct_message(other_user uuid)
returns uuid as $$
declare
  my_church uuid := current_church_id();
  existing  uuid;
  created   uuid;
begin
  if my_church is null or other_user is null or other_user = auth.uid() then
    raise exception 'Choose someone else in your church.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from app_users
    where id = other_user and church_id = my_church and status <> 'disabled'
  ) then
    raise exception 'That person is not in your church.' using errcode = '42501';
  end if;

  select c.id into existing
  from chat_channels c
  join chat_channel_members a on a.channel_id = c.id and a.user_id = auth.uid()
  join chat_channel_members b on b.channel_id = c.id and b.user_id = other_user
  where c.is_dm and c.church_id = my_church
  limit 1;
  if existing is not null then
    return existing;
  end if;

  insert into chat_channels (church_id, is_dm, name)
  values (my_church, true, 'Direct message')
  returning id into created;

  insert into chat_channel_members (channel_id, user_id)
  values (created, auth.uid()), (created, other_user);

  return created;
end;
$$ language plpgsql security definer set search_path = public;

-- Chat messages: keep content to a sane size.
alter table chat_messages drop constraint if exists chat_messages_content_length;
alter table chat_messages add constraint chat_messages_content_length
  check (char_length(content) between 1 and 4000) not valid;

-- ----------------------------------------------------------------------------
-- 3. AI counseling
-- ----------------------------------------------------------------------------
-- Members may update their own conversation (share with pastor, last message
-- time). The trigger below stops them clearing a crisis flag.
drop policy if exists counseling_conversations_update_own on counseling_conversations;
create policy counseling_conversations_update_own on counseling_conversations
  for update using (member_id = auth.uid())
  with check (member_id = auth.uid());

create or replace function protect_counseling_flags()
returns trigger as $$
begin
  -- auth.uid() is null for trusted server code (service role), which is the
  -- only writer allowed to set or clear a crisis flag.
  if auth.uid() is not null and (
       new.flagged is distinct from old.flagged
    or new.flagged_at is distinct from old.flagged_at
    or new.flagged_reason is distinct from old.flagged_reason
    or new.member_id is distinct from old.member_id
    or new.church_id is distinct from old.church_id
  ) then
    raise exception 'Crisis flags can only be changed by the system.' using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_protect_counseling_flags on counseling_conversations;
create trigger trg_protect_counseling_flags before update on counseling_conversations
  for each row execute function protect_counseling_flags();

-- Members write their own messages only; the assistant's replies are written
-- by server code, so a member can't fabricate "the assistant said…".
drop policy if exists counseling_messages_insert on counseling_messages;
create policy counseling_messages_insert on counseling_messages
  for insert with check (
    sender = 'member'
    and exists (
      select 1 from counseling_conversations c
      where c.id = conversation_id and c.member_id = auth.uid()
    )
  );

-- Pastors acknowledge escalations and keep private outcome notes.
drop policy if exists counseling_escalations_update on counseling_escalations;
create policy counseling_escalations_update on counseling_escalations
  for update using (
    exists (
      select 1 from counseling_conversations c
      where c.id = conversation_id and is_church_shepherd(c.church_id)
    )
  )
  with check (
    exists (
      select 1 from counseling_conversations c
      where c.id = conversation_id and is_church_shepherd(c.church_id)
    )
  );

create index if not exists idx_counseling_escalations_conv on counseling_escalations(conversation_id);

-- ----------------------------------------------------------------------------
-- 4. Events: cancellation + RSVPs
-- ----------------------------------------------------------------------------
alter table events add column if not exists cancelled_at timestamptz;
alter table events add column if not exists cancelled_by uuid references app_users(id) on delete set null;

-- Editing can't widen an event's audience beyond what creating it allowed.
drop policy if exists events_update on events;
create policy events_update on events
  for update using (
    created_by = auth.uid() or is_church_shepherd(church_id)
  )
  with check (
    church_id = current_church_id()
    and (
      is_church_shepherd(church_id)
      or (
        created_by = auth.uid()
        and department_id is not null
        and department_id = (select department_id from app_users where id = auth.uid())
      )
    )
  );

drop policy if exists event_rsvps_upsert on event_rsvps;
drop policy if exists event_rsvps_insert on event_rsvps;
create policy event_rsvps_insert on event_rsvps
  for insert with check (
    user_id = auth.uid()
    -- The subquery runs under events' own RLS, so department-only events
    -- stay invisible (and un-RSVP-able) to other departments.
    and exists (
      select 1 from events e
      where e.id = event_id and e.church_id = current_church_id() and e.cancelled_at is null
    )
  );

drop policy if exists event_rsvps_update on event_rsvps;
create policy event_rsvps_update on event_rsvps
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from events e
      where e.id = event_id and e.church_id = current_church_id() and e.cancelled_at is null
    )
  );

drop policy if exists event_rsvps_delete on event_rsvps;
create policy event_rsvps_delete on event_rsvps
  for delete using (user_id = auth.uid());

create index if not exists idx_event_rsvps_user on event_rsvps(user_id);

alter table events drop constraint if exists events_end_after_start;
alter table events add constraint events_end_after_start
  check (end_time is null or end_time >= start_time) not valid;

-- ----------------------------------------------------------------------------
-- 5. Announcements: drafts, archive, safe edits
-- ----------------------------------------------------------------------------
alter table announcements add column if not exists status text not null default 'published';
alter table announcements add column if not exists published_at timestamptz;
update announcements set published_at = created_at where published_at is null and status = 'published';

alter table announcements drop constraint if exists announcements_status_check;
alter table announcements add constraint announcements_status_check
  check (status in ('draft', 'published', 'archived'));

-- Members see published announcements for their audience; drafts and
-- archived posts are visible only to their author and to pastors/admins.
drop policy if exists announcements_select on announcements;
create policy announcements_select on announcements
  for select using (
    is_super_admin()
    or (
      church_id = current_church_id()
      and (
        is_church_shepherd(church_id)
        or author_id = auth.uid()
        or (
          status = 'published'
          and (
            department_id is null
            or department_id = (select department_id from app_users where id = auth.uid())
          )
        )
      )
    )
  );

drop policy if exists announcements_update on announcements;
create policy announcements_update on announcements
  for update using (
    author_id = auth.uid() or is_church_shepherd(church_id)
  )
  with check (
    church_id = current_church_id()
    and (
      is_church_shepherd(church_id)
      or (
        author_id = auth.uid()
        and department_id is not null
        and department_id = (select department_id from app_users where id = auth.uid())
        and pinned = false
      )
    )
  );

drop policy if exists announcements_delete on announcements;
create policy announcements_delete on announcements
  for delete using (author_id = auth.uid() or is_church_shepherd(church_id));

create index if not exists idx_announcements_church_status on announcements(church_id, status, created_at desc);

-- ----------------------------------------------------------------------------
-- 6. Pastor bookings: requester can cancel
-- ----------------------------------------------------------------------------
alter table pastor_bookings drop constraint if exists pastor_bookings_status_check;
alter table pastor_bookings add constraint pastor_bookings_status_check
  check (status in ('pending', 'approved', 'declined', 'completed', 'cancelled'));

/**
 * The person who asked can withdraw a pending or approved request. A narrow
 * function rather than an UPDATE policy, so requesters can't edit anything
 * else (e.g. approve their own request).
 */
create or replace function cancel_booking_request(target_booking uuid)
returns boolean as $$
declare
  changed int;
begin
  update pastor_bookings
     set status = 'cancelled'
   where id = target_booking
     and requested_by = auth.uid()
     and church_id = current_church_id()
     and status in ('pending', 'approved');
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$ language plpgsql security definer set search_path = public;

create index if not exists idx_pastor_bookings_church_status on pastor_bookings(church_id, status);

-- ----------------------------------------------------------------------------
-- 7. Posters and departments: edits
-- ----------------------------------------------------------------------------
alter table posters add column if not exists updated_at timestamptz not null default now();
drop trigger if exists trg_posters_updated_at on posters;
create trigger trg_posters_updated_at before update on posters
  for each row execute function set_updated_at();

drop policy if exists posters_update on posters;
create policy posters_update on posters
  for update using (created_by = auth.uid() or is_church_shepherd(church_id))
  with check (church_id = current_church_id());

alter table departments add column if not exists updated_at timestamptz not null default now();
drop trigger if exists trg_departments_updated_at on departments;
create trigger trg_departments_updated_at before update on departments
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. Stripe webhook idempotency
-- ----------------------------------------------------------------------------
-- Stripe retries webhooks and can deliver the same event twice. The handler
-- records each event id here first and skips ids it has already processed.
-- RLS on with no policies: only the service role (the webhook) touches it.
create table if not exists stripe_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now()
);
alter table stripe_events enable row level security;

-- ----------------------------------------------------------------------------
-- 9. Plan catalogue: read-only for everyone except super admins
-- ----------------------------------------------------------------------------
-- schema.sql never enabled RLS on these, and Supabase lets signed-in users
-- write to any public table without RLS — so any member could add rows to
-- plan_modules and unlock paid features for every church.
alter table modules enable row level security;
alter table plans enable row level security;
alter table plan_modules enable row level security;

drop policy if exists modules_read on modules;
create policy modules_read on modules for select using (true);
drop policy if exists modules_write on modules;
create policy modules_write on modules for all using (is_super_admin()) with check (is_super_admin());

drop policy if exists plans_read on plans;
create policy plans_read on plans for select using (true);
drop policy if exists plans_write on plans;
create policy plans_write on plans for all using (is_super_admin()) with check (is_super_admin());

drop policy if exists plan_modules_read on plan_modules;
create policy plan_modules_read on plan_modules for select using (true);
drop policy if exists plan_modules_write on plan_modules;
create policy plan_modules_write on plan_modules for all using (is_super_admin()) with check (is_super_admin());

-- ----------------------------------------------------------------------------
-- 10. Integrity checks
-- ----------------------------------------------------------------------------
alter table givings drop constraint if exists givings_amount_positive;
alter table givings add constraint givings_amount_positive check (amount_cents > 0) not valid;

alter table bible_quiz_attempts drop constraint if exists bible_quiz_attempts_score_range;
alter table bible_quiz_attempts add constraint bible_quiz_attempts_score_range
  check (total_questions between 1 and 1000 and score between 0 and total_questions) not valid;

create index if not exists idx_support_tickets_creator on support_tickets(created_by);
create index if not exists idx_service_plan_items_assigned on service_plan_items(assigned_to);

-- Support screenshots are shown through short-lived signed links, so the
-- bucket never needs to be public (support_security_fix.sql left that switch
-- for later). Harmless if the bucket doesn't exist.
update storage.buckets set public = false where id = 'attachments';
