-- ============================================================================
-- #43  pastor_alerts.sql — more pastor alerts, and WhatsApp delivery
--
-- 1. New alerts for pastors and church admins (bell + phone pop-up, and
--    WhatsApp when the platform has it switched on):
--      * a member shares a counseling conversation with the pastors
--      * a member shares a prayer request on the prayer wall
--    (Booking requests, counseling crisis flags and new members already alert.)
-- 2. Each person can choose whether their alerts also come by WhatsApp
--    (My account → Notifications). On by default.
-- Safe to run more than once. Needs notifications.sql (#28).
-- ============================================================================

alter table public.notification_preferences add column if not exists whatsapp_alerts boolean not null default true;

-- Pastors and church admins of a church (active), as an array.
create or replace function app_private.church_shepherds(p_church uuid)
returns uuid[] as $$
  select coalesce(array_agg(id), '{}') from public.app_users
  where church_id = p_church and status = 'active' and role in ('pastor', 'church_admin');
$$ language sql stable security definer set search_path = public;

-- A member shares a counseling conversation with the pastors.
create or replace function app_private.on_counseling_shared()
returns trigger as $$
declare
  member_name text;
begin
  if new.shared_with_pastor and not coalesce(old.shared_with_pastor, false) then
    select name into member_name from app_users where id = new.member_id;
    perform app_private.notify(
      app_private.church_shepherds(new.church_id), new.church_id, 'alerts', 'counseling.shared',
      'Counseling conversation shared with you',
      coalesce(member_name, 'A member') || ' would like a pastor to read their conversation and follow up.',
      '/dashboard/counseling/' || new.id, new.member_id);
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_counseling_shared on public.counseling_conversations;
create trigger trg_notify_counseling_shared after update of shared_with_pastor on public.counseling_conversations
  for each row execute function app_private.on_counseling_shared();

-- A prayer request is shared on the prayer wall (private prayers stay private).
create or replace function app_private.on_prayer_shared()
returns trigger as $$
declare
  member_name text;
begin
  if new.is_shared_request and (tg_op = 'INSERT' or not old.is_shared_request) then
    select name into member_name from app_users where id = new.user_id;
    perform app_private.notify(
      app_private.church_shepherds(new.church_id), new.church_id, 'alerts', 'prayer.requested',
      'New prayer request',
      coalesce(member_name, 'A member') || coalesce(' · ' || nullif(initcap(new.category), ''), '') || ': ' || left(new.prayer_text, 160),
      '/dashboard/prayer-board/wall', new.user_id);
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_prayer_shared on public.prayer_board_items;
create trigger trg_notify_prayer_shared after insert or update of is_shared_request on public.prayer_board_items
  for each row execute function app_private.on_prayer_shared();

revoke all on all functions in schema app_private from public;
