-- ============================================================================
-- CHAT v4 — more WhatsApp features (migration #49). Run after
-- chat_notifications_v2.sql.
-- ============================================================================
-- In plain language:
--   1. Online & last seen (private chats). The app notes when you were last
--      active. In a private chat you see "online" or "last seen today at
--      14:02" for the other person — only if both of you share it (like
--      WhatsApp: hide yours and you can't see theirs) and neither has blocked
--      the other. Turn it off under My account → Chat privacy.
--   2. Forwarded messages carry a "Forwarded" label. Starred messages: each
--      person's own private list of messages they've starred.
--   3. @mentions in group chats: the person mentioned is notified even if
--      they've muted the group ("Alice mentioned you").
--   4. Polls: a question with 2–12 options in any chat; people tap to vote
--      (one choice, or several if the poll allows) and see results live,
--      including who voted for what (as in WhatsApp).
--   5. Archive: hide a chat from your list without leaving it (for you only).
--   6. Disappearing messages: in a private chat either person, in a group a
--      pastor or church admin, can make new messages disappear after 24
--      hours, 7 days or 90 days. A note in the chat says who changed it.
--      Disappeared messages vanish from the chat at once and are deleted for
--      good (with any voice note or photo) by the nightly clean-up.
-- Message search needs no database change (it uses the existing rules: you
-- can only ever find messages you can already read).
-- Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Online & last seen
-- ----------------------------------------------------------------------------
create table if not exists user_presence (
  user_id         uuid primary key references app_users(id) on delete cascade,
  last_seen_at    timestamptz,
  show_last_seen  boolean not null default true,
  updated_at      timestamptz not null default now()
);
alter table user_presence enable row level security;
-- Your own row only. Changes go through the functions below.
drop policy if exists user_presence_select on user_presence;
create policy user_presence_select on user_presence for select using (user_id = auth.uid());

/** "I'm here": called by the app about once a minute while it's open. */
create or replace function touch_presence()
returns void as $$
begin
  if auth.uid() is null or not exists (select 1 from app_users where id = auth.uid() and status = 'active') then
    return;
  end if;
  insert into user_presence (user_id, last_seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set last_seen_at = now(), updated_at = now();
end;
$$ language plpgsql security definer set search_path = public;

/** Share (or hide) your online status and last seen. Hiding it also clears the stored time. */
create or replace function set_last_seen_visibility(visible boolean)
returns void as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  insert into user_presence (user_id, show_last_seen, last_seen_at) values (auth.uid(), visible, case when visible then now() end)
  on conflict (user_id) do update set show_last_seen = visible, last_seen_at = case when visible then user_presence.last_seen_at end, updated_at = now();
end;
$$ language plpgsql security definer set search_path = public;

/**
 * The other person's last-seen time in a private chat you're in — or null
 * if either of you hides it, either has blocked the other, or it isn't a DM.
 */
create or replace function dm_last_seen(target_channel uuid)
returns timestamptz as $$
declare
  other uuid;
  result timestamptz;
begin
  if not can_access_chat_channel(target_channel) or not exists (select 1 from chat_channels where id = target_channel and is_dm) then
    return null;
  end if;
  select user_id into other from chat_channel_members where channel_id = target_channel and user_id <> auth.uid() limit 1;
  if other is null or is_blocked_between(auth.uid(), other) then
    return null;
  end if;
  if not coalesce((select show_last_seen from user_presence where user_id = auth.uid()), true) then
    return null;
  end if;
  select case when p.show_last_seen then p.last_seen_at end into result from user_presence p where p.user_id = other;
  return result;
end;
$$ language plpgsql stable security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 2–6. Message columns: forwarded, mentions, polls, disappearing
-- ----------------------------------------------------------------------------
alter table chat_messages add column if not exists forwarded boolean not null default false;
alter table chat_messages add column if not exists mentions uuid[] not null default '{}';
alter table chat_messages add column if not exists expires_at timestamptz;

alter table chat_messages drop constraint if exists chat_messages_mentions_count;
alter table chat_messages add constraint chat_messages_mentions_count check (cardinality(mentions) <= 20);

alter table chat_messages drop constraint if exists chat_messages_kind_check;
alter table chat_messages add constraint chat_messages_kind_check check (kind in ('text', 'voice', 'image', 'poll'));

-- Polls: the question is the message text (1–300 characters).
alter table chat_messages drop constraint if exists chat_messages_content_length;
alter table chat_messages add constraint chat_messages_content_length check (
  (deleted_at is not null and content = '')
  or (deleted_at is null and kind = 'text' and char_length(content) between 1 and 4000)
  or (deleted_at is null and kind = 'poll' and char_length(content) between 1 and 300)
  or (deleted_at is null and kind in ('voice', 'image') and char_length(content) <= 1000)
) not valid;

alter table chat_messages drop constraint if exists chat_messages_media_present;
alter table chat_messages add constraint chat_messages_media_present check (
  kind in ('text', 'poll') or deleted_at is not null or media_expired_at is not null or media_path is not null
);

create index if not exists idx_chat_messages_expires on chat_messages(expires_at) where expires_at is not null;

alter table chat_channels add column if not exists disappear_after_seconds integer;
alter table chat_channels drop constraint if exists chat_channels_disappear_after;
alter table chat_channels add constraint chat_channels_disappear_after check (disappear_after_seconds is null or disappear_after_seconds in (86400, 604800, 7776000));

-- Every new message gets its disappearing time from the chat's setting (the
-- app can't choose its own), and mentions are kept to people in the chat.
create or replace function app_private.prepare_chat_message()
returns trigger as $$
declare
  ch chat_channels;
begin
  select * into ch from chat_channels where id = new.channel_id;
  new.expires_at := case when ch.disappear_after_seconds is not null then now() + make_interval(secs => ch.disappear_after_seconds) end;
  if ch.is_dm then
    new.mentions := '{}';
  else
    new.mentions := coalesce(array(select distinct m from unnest(new.mentions) m where m <> new.sender_id and exists (select 1 from app_users u where u.id = m and u.church_id = ch.church_id)), '{}');
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_prepare_chat_message on chat_messages;
create trigger trg_prepare_chat_message before insert on chat_messages
  for each row execute function app_private.prepare_chat_message();

-- Disappeared messages are hidden at once (deleted for good overnight).
drop policy if exists chat_messages_not_expired on chat_messages;
create policy chat_messages_not_expired on chat_messages as restrictive for select using (expires_at is null or expires_at > now());

-- Polls are only made through create_chat_poll() (so a poll always has its options).
drop policy if exists chat_messages_no_direct_polls on chat_messages;
create policy chat_messages_no_direct_polls on chat_messages as restrictive for insert with check (kind <> 'poll');

/** Disappearing messages for a chat: seconds (86400, 604800, 7776000) or null for off. */
create or replace function set_chat_disappearing(target_channel uuid, seconds integer)
returns void as $$
declare
  ch chat_channels;
  label text;
begin
  select * into ch from chat_channels where id = target_channel;
  if not found or not can_access_chat_channel(target_channel) then
    raise exception 'You don''t have access to that conversation.' using errcode = '42501';
  end if;
  if not ch.is_dm and not is_church_shepherd(ch.church_id) then
    raise exception 'In group chats, only pastors and church admins can change disappearing messages.' using errcode = '42501';
  end if;
  if seconds is not null and seconds not in (86400, 604800, 7776000) then
    raise exception 'Choose 24 hours, 7 days or 90 days.' using errcode = '22023';
  end if;
  if ch.disappear_after_seconds is not distinct from seconds then return; end if;

  update chat_channels set disappear_after_seconds = seconds where id = target_channel;
  label := case seconds when 86400 then '24 hours' when 604800 then '7 days' when 7776000 then '90 days' end;
  insert into chat_messages (channel_id, sender_id, content)
  values (target_channel, auth.uid(),
    case when seconds is null then '⏱ Turned off disappearing messages.'
         else '⏱ Turned on disappearing messages. New messages will disappear ' || label || ' after they''re sent.' end);
end;
$$ language plpgsql security definer set search_path = public;

/** Nightly clean-up (server only): deletes disappeared messages; returns their files to remove from storage. */
create or replace function purge_expired_chat_messages(batch integer default 500)
returns table (media_path text) as $$
begin
  -- Server only (the nightly job has no signed-in user).
  if auth.uid() is not null then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return query
    with gone as (
      delete from chat_messages
      where id in (select id from chat_messages where expires_at is not null and expires_at <= now() order by expires_at limit batch)
      returning chat_messages.media_path
    )
    select gone.media_path from gone where gone.media_path is not null;
end;
$$ language plpgsql volatile security definer set search_path = public;
revoke all on function purge_expired_chat_messages(integer) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Starred messages (private to each person)
-- ----------------------------------------------------------------------------
create table if not exists chat_starred_messages (
  user_id     uuid not null references app_users(id) on delete cascade,
  message_id  uuid not null references chat_messages(id) on delete cascade,
  channel_id  uuid not null references chat_channels(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, message_id)
);
create index if not exists idx_chat_starred_user on chat_starred_messages(user_id, created_at desc);
alter table chat_starred_messages enable row level security;

drop policy if exists chat_starred_select on chat_starred_messages;
create policy chat_starred_select on chat_starred_messages for select using (user_id = auth.uid() and can_access_chat_channel(channel_id));
drop policy if exists chat_starred_insert on chat_starred_messages;
create policy chat_starred_insert on chat_starred_messages for insert with check (
  user_id = auth.uid()
  and can_access_chat_channel(channel_id)
  and exists (select 1 from chat_messages m where m.id = message_id and m.channel_id = chat_starred_messages.channel_id and m.deleted_at is null)
);
drop policy if exists chat_starred_delete on chat_starred_messages;
create policy chat_starred_delete on chat_starred_messages for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Polls
-- ----------------------------------------------------------------------------
create table if not exists chat_polls (
  message_id      uuid primary key references chat_messages(id) on delete cascade,
  channel_id      uuid not null references chat_channels(id) on delete cascade,
  options         text[] not null check (cardinality(options) between 2 and 12),
  allow_multiple  boolean not null default false,
  created_at      timestamptz not null default now()
);
alter table chat_polls enable row level security;
drop policy if exists chat_polls_select on chat_polls;
create policy chat_polls_select on chat_polls for select using (can_access_chat_channel(channel_id));

create table if not exists chat_poll_votes (
  message_id    uuid not null references chat_polls(message_id) on delete cascade,
  user_id       uuid not null references app_users(id) on delete cascade,
  option_index  smallint not null check (option_index between 0 and 11),
  channel_id    uuid not null references chat_channels(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (message_id, user_id, option_index)
);
create index if not exists idx_chat_poll_votes_channel on chat_poll_votes(channel_id);
alter table chat_poll_votes enable row level security;
drop policy if exists chat_poll_votes_select on chat_poll_votes;
create policy chat_poll_votes_select on chat_poll_votes for select using (can_access_chat_channel(channel_id));
-- No write policies: voting goes through vote_chat_poll().

/** Posts a poll. Same posting rules as a text message. Returns the message id. */
create or replace function create_chat_poll(target_channel uuid, question text, poll_options text[], multiple boolean default false)
returns uuid as $$
declare
  cleaned text[];
  new_id uuid;
begin
  if not can_post_chat_message(target_channel, 'text') then
    raise exception 'You can''t post in this chat right now.' using errcode = '42501';
  end if;
  question := btrim(coalesce(question, ''));
  if char_length(question) not between 1 and 300 then
    raise exception 'Write a question (up to 300 characters).' using errcode = '22023';
  end if;
  cleaned := array(select btrim(o) from unnest(poll_options) with ordinality as t(o, n) where btrim(o) <> '' order by n);
  if cardinality(cleaned) not between 2 and 12 then
    raise exception 'A poll needs 2 to 12 options.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(cleaned) o where char_length(o) > 100) then
    raise exception 'Keep each option under 100 characters.' using errcode = '22023';
  end if;

  insert into chat_messages (channel_id, sender_id, content, kind) values (target_channel, auth.uid(), question, 'poll') returning id into new_id;
  insert into chat_polls (message_id, channel_id, options, allow_multiple) values (new_id, target_channel, cleaned, coalesce(multiple, false));
  return new_id;
end;
$$ language plpgsql security definer set search_path = public;

/** Your vote(s) on a poll, replacing any earlier ones. An empty list takes your vote back. */
create or replace function vote_chat_poll(target_message uuid, choices smallint[])
returns void as $$
declare
  p chat_polls;
begin
  select * into p from chat_polls where message_id = target_message;
  if not found or not can_access_chat_channel(p.channel_id) then
    raise exception 'That poll couldn''t be found.' using errcode = '42501';
  end if;
  if exists (select 1 from chat_messages where id = target_message and (deleted_at is not null or (expires_at is not null and expires_at <= now()))) then
    raise exception 'That poll has been removed.' using errcode = '22023';
  end if;
  choices := coalesce(array(select distinct c from unnest(choices) c), '{}');
  if exists (select 1 from unnest(choices) c where c < 0 or c >= cardinality(p.options)) then
    raise exception 'That option isn''t in the poll.' using errcode = '22023';
  end if;
  if not p.allow_multiple and cardinality(choices) > 1 then
    raise exception 'Choose one option.' using errcode = '22023';
  end if;
  delete from chat_poll_votes where message_id = target_message and user_id = auth.uid();
  insert into chat_poll_votes (message_id, user_id, option_index, channel_id)
  select target_message, auth.uid(), c, p.channel_id from unnest(choices) c;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- Archive (per person)
-- ----------------------------------------------------------------------------
alter table chat_member_settings add column if not exists archived_at timestamptz;

-- ----------------------------------------------------------------------------
-- Notifications: polls, @mentions (even when muted), disappeared messages
-- ----------------------------------------------------------------------------
create or replace function app_private.chat_preview(kind text, content text)
returns text as $$
  select case
    when kind = 'voice' then '🎤 Voice message'
    when kind = 'image' then '📷 Photo'
    when kind = 'poll' then '📊 Poll: ' || left(regexp_replace(coalesce(content, ''), '\s+', ' ', 'g'), 120)
    when char_length(regexp_replace(coalesce(content, ''), '\s+', ' ', 'g')) > 140
      then left(regexp_replace(content, '\s+', ' ', 'g'), 139) || '…'
    else regexp_replace(coalesce(content, ''), '\s+', ' ', 'g')
  end;
$$ language sql immutable;

create or replace function app_private.on_chat_message()
returns trigger as $$
declare
  ch record;
  sender_name text;
  preview text;
  body text;
  recipient uuid;
  mentioned boolean;
  previews boolean;
begin
  if new.deleted_at is not null then return null; end if;
  select * into ch from chat_channels where id = new.channel_id;
  select name into sender_name from app_users where id = new.sender_id;
  preview := app_private.chat_preview(coalesce(new.kind, 'text'), new.content);

  for recipient in
    select u.id from app_users u
    where u.church_id = ch.church_id
      and u.status = 'active'
      and u.id <> new.sender_id
      and (
        ((ch.is_dm or ch.members_only) and exists (select 1 from chat_channel_members m where m.channel_id = ch.id and m.user_id = u.id))
        or (not ch.is_dm and ch.members_only and u.role in ('pastor', 'church_admin'))
        or (not ch.is_dm and not ch.members_only and (ch.department_id is null or u.department_id = ch.department_id or u.role in ('pastor', 'church_admin')))
      )
      -- Muted chats stay quiet — unless you're @mentioned. Blocking always wins.
      and (u.id = any(new.mentions) or not exists (select 1 from chat_member_settings s where s.channel_id = ch.id and s.user_id = u.id and s.muted_until > now()))
      and not exists (select 1 from chat_blocks b where b.blocker_id = u.id and b.blocked_id = new.sender_id)
  loop
    mentioned := recipient = any(new.mentions);
    previews := coalesce((select p.show_previews from notification_preferences p where p.user_id = recipient), true);
    if mentioned then
      -- Its own item (not grouped), so a mention stands out from the chat's other messages.
      perform app_private.notify(
        array[recipient], ch.church_id, 'messages', 'chat.mention',
        sender_name || ' mentioned you in ' || ch.name,
        case when previews then preview else 'Tap to see the message' end,
        '/dashboard/chat/' || ch.id, new.sender_id);
    elsif previews then
      body := case when ch.is_dm then preview else sender_name || ': ' || preview end;
      perform app_private.notify_grouped(
        recipient, ch.church_id, 'messages', 'chat.message', 'chat:' || ch.id,
        case when ch.is_dm then sender_name else ch.name end,
        body, body, '/dashboard/chat/' || ch.id, new.sender_id);
    else
      perform app_private.notify_grouped(
        recipient, ch.church_id, 'messages', 'chat.message', 'chat:' || ch.id,
        case when ch.is_dm then sender_name else ch.name end,
        case when ch.is_dm then 'Sent you a message' else 'New message from ' || sender_name end,
        '{n} new messages', '/dashboard/chat/' || ch.id, new.sender_id);
    end if;
  end loop;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

-- Deleted, edited or disappeared before being read: replace its preview.
create or replace function app_private.on_chat_message_changed()
returns trigger as $$
declare
  ch record;
  sender_name text;
  old_preview text;
  replacement text;
begin
  if old.deleted_at is not null then return null; end if;
  if tg_op = 'UPDATE' and new.deleted_at is null and new.content is not distinct from old.content then return null; end if;
  select * into ch from chat_channels where id = old.channel_id;
  if not found then return null; end if;
  select name into sender_name from app_users where id = old.sender_id;
  old_preview := app_private.chat_preview(coalesce(old.kind, 'text'), old.content);
  replacement := case
    when tg_op = 'DELETE' then '🕒 This message disappeared'
    when new.deleted_at is not null then '🚫 This message was deleted'
    else app_private.chat_preview(coalesce(new.kind, 'text'), new.content)
  end;

  update notifications n
     set body = case when ch.is_dm or n.type = 'chat.mention' then replacement else sender_name || ': ' || replacement end
   where n.church_id = ch.church_id
     and n.link = '/dashboard/chat/' || ch.id
     and n.read_at is null
     and n.body in (old_preview, sender_name || ': ' || old_preview);
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_chat_message_changed on chat_messages;
create trigger trg_notify_chat_message_changed after update of content, deleted_at or delete on chat_messages
  for each row execute function app_private.on_chat_message_changed();

revoke all on all functions in schema app_private from public;

-- ----------------------------------------------------------------------------
-- Live updates: poll votes and channel settings (disappearing timer)
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['chat_poll_votes'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
