-- ============================================================================
-- Record-only members (migration #63). Run after church_life_v2.sql. Safe to re-run.
-- ============================================================================
-- In plain language:
--   * Older members who won't use the app can be kept on the member list for
--     the church's records: name, phone, birthday, children, certificates.
--   * They have no way to sign in, aren't in chats or calls, get no
--     notifications, and don't count towards the plan's member limit.
--   * "Give app access" later turns them into an ordinary member.
-- PRAYER CHAIN
--   * Everyone who books a prayer slot is told the time and date.
--   * Only pastors and church admins can remove or move a prayer time.
-- VERSE OF THE DAY
--   * A morning notification with the verse of the day; each person can switch it off.
-- BIRTHDAYS
--   * On someone's birthday the church is told and a birthday poster goes in General,
--     unless they (or a pastor for them) switch it off.
-- ============================================================================

alter table app_users add column if not exists record_only boolean not null default false;
create index if not exists idx_app_users_record_only on app_users(church_id) where record_only;

-- No notifications for people who don't use the app.
create or replace function app_private.notify(
  recipients uuid[], target_church uuid, p_category text, p_type text,
  p_title text, p_body text, p_link text, p_actor uuid
) returns void as $$
  insert into notifications (user_id, church_id, category, type, title, body, link, actor_id)
  select u.id, target_church, p_category, p_type, left(p_title, 120), left(p_body, 300), p_link, p_actor
  from app_users u
  where u.id = any(recipients)
    and u.status <> 'disabled'
    and not u.record_only
    and u.id is distinct from p_actor;
$$ language sql volatile security definer set search_path = public;

-- "New member joined" alerts are for people joining the app, not records being added.
create or replace function app_private.on_member_joined() returns trigger as $$
begin
  if new.role <> 'super_admin' and new.church_id is not null and new.status = 'active' and not new.record_only
     and (tg_op = 'INSERT' or old.status = 'invited' or (old.record_only and not new.record_only)) then
    perform app_private.notify(
      array(select id from app_users where church_id = new.church_id and role = 'church_admin' and status = 'active' and id <> new.id),
      new.church_id, 'alerts', 'member.joined',
      'New member', new.name || ' joined your church.', '/dashboard/members/' || new.id, null);
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_notify_member_joined on app_users;
create trigger trg_notify_member_joined after insert or update of status, record_only on app_users
  for each row execute function app_private.on_member_joined();

-- ---------------------------------------------------------------------------
-- Prayer chain: everyone is told their prayer time and date when they book
-- (before, only people a pastor added were told).
-- ---------------------------------------------------------------------------
create or replace function app_private.on_prayer_slot_added() returns trigger as $$
declare
  c prayer_chains;
  self boolean := new.user_id is not distinct from auth.uid();
begin
  if auth.uid() is null then return new; end if;
  select * into c from prayer_chains where id = new.chain_id;
  perform app_private.notify(array[new.user_id], new.church_id, 'prayer_care',
    case when self then 'prayer_chain.booked' else 'prayer_chain.assigned' end,
    case when self then 'You''re praying at ' else 'You''re on the prayer chain at ' end || to_char(new.slot_start at time zone 'Africa/Johannesburg', 'HH24:MI'),
    c.title || ' · ' || to_char(new.slot_start at time zone 'Africa/Johannesburg', 'FMDay FMDD FMMonth YYYY') || '. We''ll remind you before it starts.',
    '/dashboard/prayer-chain/' || c.id,
    case when self then null else auth.uid() end);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Only pastors and church admins remove or move people's prayer times
-- (members ask a pastor if they can't make it).
drop policy if exists prayer_chain_slots_delete on prayer_chain_slots;
create policy prayer_chain_slots_delete on prayer_chain_slots for delete
  using (church_id = current_church_id() and is_church_shepherd(church_id));

-- ---------------------------------------------------------------------------
-- Verse of the day as a morning notification (on unless switched off).
-- ---------------------------------------------------------------------------
alter table notification_preferences add column if not exists daily_verse boolean not null default true;

-- ---------------------------------------------------------------------------
-- Birthdays: the church is told on the day (and a poster goes in General),
-- unless the person — or a pastor for them — switches it off. Day and month
-- only; never the age.
-- ---------------------------------------------------------------------------
alter table member_birthdays add column if not exists announce boolean not null default true;

-- Birthday posters are PNG pictures posted in the General chat by the morning job.
update storage.buckets
   set allowed_mime_types = array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'image/webp', 'image/jpeg', 'image/png'],
       file_size_limit = greatest(coalesce(file_size_limit, 0), 2097152)
 where id = 'chat-media';

-- Birthday posters are posted by the church itself: the chat shows the
-- church's name and logo, not the admin whose account carries the message.
alter table chat_messages add column if not exists from_church boolean not null default false;

-- Only the server's morning job (no signed-in user) can post as the church.
create or replace function app_private.guard_from_church()
returns trigger as $$
begin
  if auth.uid() is not null then
    new.from_church := case when tg_op = 'UPDATE' then old.from_church else false end;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;
drop trigger if exists trg_guard_from_church on chat_messages;
create trigger trg_guard_from_church before insert or update on chat_messages
  for each row execute function app_private.guard_from_church();

-- The church already gets a birthday notification, so a church post doesn't
-- also send the usual "new message in General" one.
drop trigger if exists trg_notify_chat_message on chat_messages;
create trigger trg_notify_chat_message after insert on chat_messages
  for each row when (not new.from_church) execute function app_private.on_chat_message();

-- Children's birthdays too: a photo for their poster (stored privately in the
-- avatars bucket, uploaded by the app's server for a parent or pastor) and the
-- same "celebrate with the church" switch.
alter table member_children add column if not exists photo_path text;
alter table member_children add column if not exists announce boolean not null default true;
