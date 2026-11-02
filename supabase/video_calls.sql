-- ============================================================================
-- Video calls (migration #47). Run after sermon_video.sql.
-- ============================================================================
-- In plain language:
--   * People can start a video call — or a voice call (cameras off) — from a private chat, a group chat, or an
--     approved pastor appointment. Calls run on Daily.co (a paid calling
--     service, billed per minute after its free allowance), so they're a plan
--     feature: on the free trial, Premium, Unlimited and Sponsored — not Basic,
--     which only has features with no running cost.
--   * video_calls records each call: which chat or appointment it belongs to,
--     who started it, and when it ends (calls end on their own after 3 hours).
--   * Who can see a call (and so join it): exactly the people who can see that
--     chat, or that appointment (the member who booked it and the church's
--     pastors and admins). Nobody can create or change calls from the browser:
--     the server does that after checking who's asking.
--   * Daily rooms are private: a call can only be joined with a one-time pass
--     the server hands to people allowed in.
--   * Ringing: a call in a private chat rings the other person; an
--     appointment's call rings the other side (the member, or the pastor it was
--     booked with — all pastors and admins if it was booked with "any pastor").
--     Ringing is a notification ("Ada is calling you"): it pops up on their
--     phone like a message (if they've turned pop-ups on) and rings in the app
--     if it's open. Group chats don't ring — the chat gets a message instead.
--   * Calls update live in the app (the "Join call" button appears and
--     disappears without refreshing).
-- Safe to run more than once.
-- ============================================================================

insert into modules (key, name, description) values
  ('video_calls', 'Video calls', 'Video calls in chats and for pastor appointments (uses a paid calling service)')
on conflict (key) do nothing;

insert into plan_modules (plan_key, module_key) values
  ('free_trial', 'video_calls'), ('premium', 'video_calls'), ('enterprise', 'video_calls'), ('sponsored', 'video_calls')
on conflict do nothing;

create table if not exists video_calls (
  id          uuid primary key default uuid_generate_v4(),
  church_id   uuid not null references churches(id) on delete cascade,
  channel_id  uuid references chat_channels(id) on delete cascade,
  booking_id  uuid references pastor_bookings(id) on delete cascade,
  room_name   text not null unique,
  room_url    text not null,
  started_by  uuid references app_users(id) on delete set null,
  started_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  ended_at    timestamptz,
  -- Who this call rings (set by the server when it starts the call).
  ring_user_ids uuid[] not null default '{}',
  -- A voice call: cameras start off (people can still turn theirs on).
  audio_only  boolean not null default false,
  -- Every call belongs to exactly one chat or one appointment.
  constraint video_calls_one_place check ((channel_id is null) <> (booking_id is null))
);

-- At most one open call per chat / appointment (a second "start" joins it).
create unique index if not exists idx_video_calls_open_channel on video_calls(channel_id) where ended_at is null and channel_id is not null;
create unique index if not exists idx_video_calls_open_booking on video_calls(booking_id) where ended_at is null and booking_id is not null;
create index if not exists idx_video_calls_church on video_calls(church_id, started_at desc);

alter table video_calls enable row level security;

-- Visible to whoever can see the chat or the appointment (those tables' own
-- rules decide), within the person's own church.
drop policy if exists video_calls_select on video_calls;
create policy video_calls_select on video_calls
  for select using (
    church_id = current_church_id()
    and (
      (channel_id is not null and exists (select 1 from chat_channels c where c.id = video_calls.channel_id))
      or (booking_id is not null and exists (select 1 from pastor_bookings b where b.id = video_calls.booking_id))
    )
  );
-- No insert/update/delete policies: only the server (service role) writes.

alter table video_calls add column if not exists ring_user_ids uuid[] not null default '{}';
alter table video_calls add column if not exists audio_only boolean not null default false;

-- Ringing: a notification for each person the call rings (notifications.sql
-- turns it into a phone pop-up; the open app rings when it sees it). Only
-- people who can see the call are ever rung, never the caller, never anyone
-- deactivated (app_private.notify checks those last two).
create or replace function app_private.on_video_call_started()
returns trigger as $$
declare
  caller text;
begin
  if coalesce(array_length(new.ring_user_ids, 1), 0) = 0 then
    return null;
  end if;
  select name into caller from app_users where id = new.started_by;
  perform app_private.notify(
    array(select u.id from app_users u where u.id = any(new.ring_user_ids) and u.church_id = new.church_id),
    new.church_id, 'messages', 'video_call',
    coalesce(caller, 'Someone') || ' is calling you',
    case when new.audio_only then 'Voice call — tap to join' else 'Video call — tap to join' end,
    '/dashboard/calls/' || new.id,
    new.started_by
  );
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_video_call_started on video_calls;
create trigger trg_video_call_started after insert on video_calls
  for each row execute function app_private.on_video_call_started();

revoke all on all functions in schema app_private from public;

-- Live updates for the "Join call" button and the ringing screen (Supabase
-- Realtime, which applies the select rule above to each listener).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'video_calls') then
    alter publication supabase_realtime add table public.video_calls;
  end if;
end $$;

select freeze_church_id_on('video_calls');
-- Starting and ending calls is recorded in the audit log by the app (the
-- server writes these rows, so the per-row audit trigger wouldn't see who).
