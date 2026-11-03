-- ============================================================================
-- Add people to a call (migration #54). Run after android_devices.sql.
-- ============================================================================
-- In plain language: during a call, anyone in it can tap "Add" and ring more
-- people from the church, like WhatsApp. Someone added gets into that one
-- call only — never the private chat or appointment it came from — and their
-- phone rings like any call. A two-person call becomes a group call (up to
-- six people). Blocked people can't be added either way.
-- Safe to run more than once.
-- ============================================================================

alter table video_calls add column if not exists invited_user_ids uuid[] not null default '{}';
alter table video_calls add column if not exists invited_by uuid references app_users(id) on delete set null;

-- Who can see a call: whoever can see its chat or appointment (as before),
-- plus the people added to it — still only within their own church.
drop policy if exists video_calls_select on video_calls;
create policy video_calls_select on video_calls
  for select using (
    church_id = current_church_id()
    and (
      (channel_id is not null and exists (select 1 from chat_channels c where c.id = video_calls.channel_id))
      or (booking_id is not null and exists (select 1 from pastor_bookings b where b.id = video_calls.booking_id))
      or (select auth.uid()) = any(invited_user_ids)
    )
  );

-- Ring the people just added (not those added earlier).
create or replace function app_private.on_video_call_invited()
returns trigger as $$
declare
  inviter text;
  added uuid[];
begin
  added := array(select x from unnest(new.invited_user_ids) x where not (x = any(coalesce(old.invited_user_ids, '{}'))));
  if coalesce(array_length(added, 1), 0) = 0 or new.ended_at is not null then
    return null;
  end if;
  select name into inviter from app_users where id = new.invited_by;
  perform app_private.notify(
    array(select u.id from app_users u where u.id = any(added) and u.church_id = new.church_id),
    new.church_id, 'messages', 'video_call',
    coalesce(inviter, 'Someone') || ' is calling you',
    case when new.audio_only then 'Voice call — tap to join' else 'Video call — tap to join' end,
    '/dashboard/calls/' || new.id,
    new.invited_by
  );
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_video_call_invited on video_calls;
create trigger trg_video_call_invited after update of invited_user_ids on video_calls
  for each row execute function app_private.on_video_call_invited();

revoke all on all functions in schema app_private from public;
