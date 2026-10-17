-- ============================================================================
-- NOTIFICATIONS — the bell and phone pop-ups
--
-- Run after bible_reader_v2.sql. Safe to re-run.
-- Decision record: docs/adr/0002-notifications.md
--
-- In plain language:
--   1. A `notifications` table holds each person's bell items. Nobody can
--      write to it through the app's API: the database creates them itself,
--      automatically, when something happens (below). People can only read
--      their own, mark them read, and clear them.
--   2. The database tells exactly the people who can see the thing, using
--      the same rules as the rest of the app:
--        - Announcement published / event added → everyone who can see it
--          (church-wide, or that department + pastors/admins), not the author.
--        - Chat message → the others in that chat, except anyone who muted it
--          or blocked the sender. Grouped: one bell item per chat that counts
--          up ("5 new messages") until the chat is opened.
--        - Someone prays for your prayer (anonymous, grouped) or comments on
--          it → you.
--        - Your pastor booking is approved/declined → you. A new booking
--          request → the requested pastor (or all pastors/admins).
--        - A reply on your support ticket → you.
--        - Counseling crisis escalation → each pastor/admin the app alerted.
--        - A new member joins → the church admins.
--      Bell text never includes message, prayer or counseling content.
--   3. `push_subscriptions` remembers which devices someone turned phone
--      pop-ups on for; `notification_preferences` which kinds they want as
--      pop-ups. Both are private to the person.
--   4. Old notifications (90+ days) are deleted nightly by the app's cron job.
--   Deleting a member deletes all of this with them (POPIA).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------
create table if not exists notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references app_users(id) on delete cascade,
  church_id   uuid references churches(id) on delete cascade,
  category    text not null check (category in ('church_news', 'messages', 'prayer_care', 'alerts')),
  type        text not null check (char_length(type) <= 60),
  title       text not null check (char_length(title) between 1 and 120),
  body        text check (char_length(body) <= 300),
  link        text check (link like '/%'),
  -- Chats and prayers: one unread item per thing, counting up.
  group_key   text,
  count       integer not null default 1 check (count >= 1),
  actor_id    uuid references app_users(id) on delete set null,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- At most one UNREAD item per group per person (what the chat upsert targets).
create unique index if not exists notifications_open_group on notifications(user_id, group_key)
  where read_at is null and group_key is not null;
create index if not exists idx_notifications_user_recent on notifications(user_id, updated_at desc);
create index if not exists idx_notifications_user_unread on notifications(user_id) where read_at is null;
create index if not exists idx_notifications_created on notifications(created_at); -- nightly cleanup

drop trigger if exists trg_notifications_updated_at on notifications;
create trigger trg_notifications_updated_at before update on notifications
  for each row execute function set_updated_at();

alter table notifications enable row level security;
-- Read and clear your own. No insert or update policy on purpose: rows come
-- only from the triggers below, and marking read goes through
-- mark_notifications_read(), so nobody can fake or rewrite a notification.
drop policy if exists notifications_select on notifications;
drop policy if exists notifications_delete on notifications;
create policy notifications_select on notifications for select using (user_id = auth.uid());
create policy notifications_delete on notifications for delete using (user_id = auth.uid());

create table if not exists push_subscriptions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references app_users(id) on delete cascade,
  endpoint      text not null unique check (endpoint like 'https://%'),
  p256dh        text not null check (char_length(p256dh) <= 200),
  auth          text not null check (char_length(auth) <= 100),
  user_agent    text check (char_length(user_agent) <= 300),
  last_used_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

drop trigger if exists trg_push_subscriptions_updated_at on push_subscriptions;
create trigger trg_push_subscriptions_updated_at before update on push_subscriptions
  for each row execute function set_updated_at();

alter table push_subscriptions enable row level security;
-- See and remove your own devices. Adding one goes through
-- save_push_subscription(), which also handles a shared device changing hands.
drop policy if exists push_subscriptions_select on push_subscriptions;
drop policy if exists push_subscriptions_delete on push_subscriptions;
create policy push_subscriptions_select on push_subscriptions for select using (user_id = auth.uid());
create policy push_subscriptions_delete on push_subscriptions for delete using (user_id = auth.uid());

create table if not exists notification_preferences (
  user_id            uuid primary key references app_users(id) on delete cascade,
  -- Which kinds become phone pop-ups. The bell always shows everything.
  push_church_news   boolean not null default true,
  push_messages      boolean not null default true,
  push_prayer_care   boolean not null default true,
  push_alerts        boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists trg_notification_preferences_updated_at on notification_preferences;
create trigger trg_notification_preferences_updated_at before update on notification_preferences
  for each row execute function set_updated_at();

alter table notification_preferences enable row level security;
drop policy if exists notification_preferences_select on notification_preferences;
drop policy if exists notification_preferences_insert on notification_preferences;
drop policy if exists notification_preferences_update on notification_preferences;
create policy notification_preferences_select on notification_preferences for select using (user_id = auth.uid());
create policy notification_preferences_insert on notification_preferences for insert with check (user_id = auth.uid());
create policy notification_preferences_update on notification_preferences for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. Helpers — in a private schema the API doesn't expose, so they can only
--    be used by the triggers, never called by a member directly.
-- ----------------------------------------------------------------------------
create schema if not exists app_private;
revoke all on schema app_private from public;

-- Active people in a church who can see something for `department`
-- (null = church-wide): church-wide → everyone; a department → its members
-- plus pastors and church admins. Mirrors announcements_select/events_select.
create or replace function app_private.church_audience(target_church uuid, department uuid)
returns setof uuid as $$
  select u.id from app_users u
  where u.church_id = target_church
    and u.status = 'active'
    and (department is null or u.department_id = department or u.role in ('pastor', 'church_admin'));
$$ language sql stable security definer set search_path = public;

-- One notification for each recipient, skipping the person who caused it and
-- anyone deactivated.
create or replace function app_private.notify(
  recipients uuid[], target_church uuid, p_category text, p_type text,
  p_title text, p_body text, p_link text, p_actor uuid
) returns void as $$
  insert into notifications (user_id, church_id, category, type, title, body, link, actor_id)
  select u.id, target_church, p_category, p_type, left(p_title, 120), left(p_body, 300), p_link, p_actor
  from app_users u
  where u.id = any(recipients)
    and u.status <> 'disabled'
    and u.id is distinct from p_actor;
$$ language sql volatile security definer set search_path = public;

-- Grouped version (chats, prayers): adds to the person's unread item for
-- `p_group` if there is one ("3 new messages"), otherwise creates it.
create or replace function app_private.notify_grouped(
  recipient uuid, target_church uuid, p_category text, p_type text, p_group text,
  p_title text, p_body text, p_body_many text, p_link text, p_actor uuid
) returns void as $$
  insert into notifications (user_id, church_id, category, type, title, body, link, group_key, actor_id)
  values (recipient, target_church, p_category, p_type, left(p_title, 120), left(p_body, 300), p_link, p_group, p_actor)
  on conflict (user_id, group_key) where read_at is null and group_key is not null
  do update set
    count = notifications.count + 1,
    title = excluded.title,
    -- p_body_many uses {n} for the new total, e.g. "{n} new messages".
    body = left(replace(p_body_many, '{n}', (notifications.count + 1)::text), 300),
    actor_id = excluded.actor_id;
$$ language sql volatile security definer set search_path = public;

revoke all on all functions in schema app_private from public;

-- ----------------------------------------------------------------------------
-- 3. Church news: announcements and events
-- ----------------------------------------------------------------------------
create or replace function app_private.on_announcement_published()
returns trigger as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform app_private.notify(
      array(select app_private.church_audience(new.church_id, new.department_id)),
      new.church_id, 'church_news', 'announcement.published',
      'New announcement', new.title, '/dashboard/announcements/' || new.id, new.author_id);
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_announcement on announcements;
create trigger trg_notify_announcement after insert or update of status on announcements
  for each row execute function app_private.on_announcement_published();

create or replace function app_private.on_event_created()
returns trigger as $$
begin
  if new.cancelled_at is null then
    perform app_private.notify(
      array(select app_private.church_audience(new.church_id, new.department_id)),
      new.church_id, 'church_news', 'event.created',
      'New event', new.title, '/dashboard/calendar/' || new.id, new.created_by);
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_event on events;
create trigger trg_notify_event after insert on events
  for each row execute function app_private.on_event_created();

-- ----------------------------------------------------------------------------
-- 4. Messages
-- ----------------------------------------------------------------------------
create or replace function app_private.on_chat_message()
returns trigger as $$
declare
  ch record;
  sender_name text;
  recipient uuid;
begin
  if new.deleted_at is not null then return null; end if;
  select * into ch from chat_channels where id = new.channel_id;
  select name into sender_name from app_users where id = new.sender_id;

  for recipient in
    select u.id from app_users u
    where u.church_id = ch.church_id
      and u.status = 'active'
      and u.id <> new.sender_id
      -- Who can access the chat (mirrors can_access_chat_channel, for user u).
      and (
        ((ch.is_dm or ch.members_only) and exists (select 1 from chat_channel_members m where m.channel_id = ch.id and m.user_id = u.id))
        or (not ch.is_dm and ch.members_only and u.role in ('pastor', 'church_admin'))
        or (not ch.is_dm and not ch.members_only and (ch.department_id is null or u.department_id = ch.department_id or u.role in ('pastor', 'church_admin')))
      )
      -- Not muted, and hasn't blocked the sender.
      and not exists (select 1 from chat_member_settings s where s.channel_id = ch.id and s.user_id = u.id and s.muted_until > now())
      and not exists (select 1 from chat_blocks b where b.blocker_id = u.id and b.blocked_id = new.sender_id)
  loop
    perform app_private.notify_grouped(
      recipient, ch.church_id, 'messages', 'chat.message', 'chat:' || ch.id,
      case when ch.is_dm then sender_name else ch.name end,
      case when ch.is_dm then 'Sent you a message' else 'New message from ' || sender_name end,
      '{n} new messages',
      '/dashboard/chat/' || ch.id, new.sender_id);
  end loop;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_chat_message on chat_messages;
create trigger trg_notify_chat_message after insert on chat_messages
  for each row execute function app_private.on_chat_message();

-- Opening a chat (which records last_read_at) clears its bell item.
create or replace function app_private.on_chat_read()
returns trigger as $$
begin
  if new.last_read_at is not null and (tg_op = 'INSERT' or new.last_read_at is distinct from old.last_read_at) then
    update notifications set read_at = now()
    where user_id = new.user_id and group_key = 'chat:' || new.channel_id and read_at is null;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_chat_read on chat_member_settings;
create trigger trg_notify_chat_read after insert or update of last_read_at on chat_member_settings
  for each row execute function app_private.on_chat_read();

-- ----------------------------------------------------------------------------
-- 5. Prayer & care
-- ----------------------------------------------------------------------------
-- "Prayed for you" is anonymous, like the prayer wall's counts.
create or replace function app_private.on_prayer_intercession()
returns trigger as $$
declare
  owner uuid;
begin
  select user_id into owner from prayer_board_items where id = new.prayer_id;
  if owner is not null and owner <> new.user_id then
    perform app_private.notify_grouped(
      owner, new.church_id, 'prayer_care', 'prayer.prayed', 'prayed:' || new.prayer_id,
      'Someone prayed for you', 'Someone from your church prayed for your prayer request.',
      '{n} people prayed for your prayer request.', '/dashboard/prayer-board', null);
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_prayer_intercession on prayer_intercessions;
create trigger trg_notify_prayer_intercession after insert on prayer_intercessions
  for each row execute function app_private.on_prayer_intercession();

create or replace function app_private.on_prayer_comment()
returns trigger as $$
declare
  owner uuid;
  commenter text;
begin
  select user_id into owner from prayer_board_items where id = new.prayer_id;
  select name into commenter from app_users where id = new.user_id;
  if owner is not null and owner <> new.user_id then
    perform app_private.notify(
      array[owner], new.church_id, 'prayer_care', 'prayer.commented',
      'New comment on your prayer', commenter || ' left an encouragement on your prayer request.',
      '/dashboard/prayer-board/wall', new.user_id);
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_prayer_comment on prayer_comments;
create trigger trg_notify_prayer_comment after insert on prayer_comments
  for each row execute function app_private.on_prayer_comment();

create or replace function app_private.on_pastor_booking()
returns trigger as $$
declare
  requester text;
  kind text := initcap(new.booking_type);
  pastors uuid[];
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select name into requester from app_users where id = new.requested_by;
    -- The requested pastor if they're still active; otherwise every pastor/admin.
    select array_agg(id) into pastors from app_users
      where church_id = new.church_id and status = 'active' and role in ('pastor', 'church_admin')
        and (new.pastor_id is null or id = new.pastor_id);
    if pastors is null then
      select array_agg(id) into pastors from app_users
        where church_id = new.church_id and status = 'active' and role in ('pastor', 'church_admin');
    end if;
    perform app_private.notify(
      coalesce(pastors, '{}'), new.church_id, 'alerts', 'booking.requested',
      'New booking request', requester || ' · ' || kind || ' · ' || to_char(new.preferred_date, 'DD Mon YYYY'),
      '/dashboard/booking/' || new.id, new.requested_by);
  elsif tg_op = 'UPDATE' and new.status in ('approved', 'declined') and old.status is distinct from new.status then
    perform app_private.notify(
      array[new.requested_by], new.church_id, 'prayer_care', 'booking.decided',
      case when new.status = 'approved' then 'Booking approved' else 'Booking declined' end,
      kind || ' on ' || to_char(new.preferred_date, 'DD Mon YYYY'),
      '/dashboard/booking/' || new.id, null);
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_pastor_booking on pastor_bookings;
create trigger trg_notify_pastor_booking after insert or update of status on pastor_bookings
  for each row execute function app_private.on_pastor_booking();

create or replace function app_private.on_support_reply()
returns trigger as $$
declare
  t record;
begin
  select id, church_id, created_by, subject into t from support_tickets where id = new.ticket_id;
  if t.created_by is not null and t.created_by <> new.sender_id then
    perform app_private.notify(
      array[t.created_by], t.church_id, 'prayer_care', 'support.reply',
      'Reply on your support ticket', t.subject, '/dashboard/support/' || t.id, new.sender_id);
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_support_reply on support_ticket_messages;
create trigger trg_notify_support_reply after insert on support_ticket_messages
  for each row execute function app_private.on_support_reply();

-- ----------------------------------------------------------------------------
-- 6. Pastor / admin alerts
-- ----------------------------------------------------------------------------
-- The app decides which pastors to alert (app/dashboard/counseling/actions.ts)
-- and records one escalation per person; this tells each of them. No details.
create or replace function app_private.on_counseling_escalation()
returns trigger as $$
declare
  target_church uuid;
begin
  select church_id into target_church from counseling_conversations where id = new.conversation_id;
  if new.notified_user_id is not null then
    perform app_private.notify(
      array[new.notified_user_id], target_church, 'alerts', 'counseling.crisis',
      'A pastor is needed in counseling', 'A conversation was flagged for urgent pastoral care. Please check it now.',
      '/dashboard/counseling/' || new.conversation_id, null);
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_counseling_escalation on counseling_escalations;
create trigger trg_notify_counseling_escalation after insert on counseling_escalations
  for each row execute function app_private.on_counseling_escalation();

-- A member "joins" when they're added as active, or accept an invite.
create or replace function app_private.on_member_joined()
returns trigger as $$
begin
  if new.role <> 'super_admin' and new.church_id is not null and new.status = 'active'
     and (tg_op = 'INSERT' or old.status = 'invited') then
    perform app_private.notify(
      array(select id from app_users where church_id = new.church_id and role = 'church_admin' and status = 'active' and id <> new.id),
      new.church_id, 'alerts', 'member.joined',
      'New member', new.name || ' joined your church.', '/dashboard/members/' || new.id, null);
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_member_joined on app_users;
create trigger trg_notify_member_joined after insert or update of status on app_users
  for each row execute function app_private.on_member_joined();

revoke all on all functions in schema app_private from public;

-- ----------------------------------------------------------------------------
-- 7. What members can call
-- ----------------------------------------------------------------------------
-- Mark some (ids) or all (null) of your own notifications as read. Returns how many.
create or replace function mark_notifications_read(target_ids uuid[] default null)
returns integer as $$
declare
  changed integer;
begin
  update notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (target_ids is null or id = any(target_ids));
  get diagnostics changed = row_count;
  return changed;
end;
$$ language plpgsql security definer set search_path = public;

-- Register this device for pop-ups. If the same browser was registered by
-- someone else (a shared phone), it moves to whoever is signed in now.
create or replace function save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from push_subscriptions where endpoint = p_endpoint and user_id <> auth.uid();
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 8. Live updates for the bell (Supabase Realtime). Skipped where Realtime
--    doesn't exist (e.g. the test database).
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
