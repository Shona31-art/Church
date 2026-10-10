-- ============================================================================
-- CHAT V2 — WhatsApp-style chat: profile photos, edit/delete, replies,
-- reactions, voice notes, read receipts, per-chat settings, privacy & blocking,
-- admin restrictions, and (switched off by default) photo sharing.
--
-- Run after platform_hardening.sql. Safe to re-run: every statement is
-- "if not exists" / "or replace" / "drop … if exists". Nothing is deleted.
--
-- In plain language:
--   1. Members get a profile photo, a short "About" line, a "who can DM me"
--      setting and a read-receipts switch. Pastors/admins can remove someone's
--      photo but can't change anyone else's privacy settings.
--   2. Two private file buckets: `avatars` (any signed-in member of the same
--      church can view) and `chat-media` (only people in that chat can open).
--   3. Messages gain a type (text / voice / image), replies, "edited" and
--      "deleted" markers. Editing and deleting go through two database
--      functions that enforce the rules (own message, 15-minute edit window,
--      moderators only in group channels — never DMs). Deleted messages stay
--      as "This message was deleted"; their text is wiped.
--   4. New tables: reactions, per-person chat settings (mute / pin / clear /
--      last read), shared read receipts, blocks, and admin restrictions.
--   5. Starting a DM now respects the other person's privacy setting and
--      blocks. Pastors and church admins may always start a DM (pastoral
--      care), but a block applies to everyone.
--   6. A new feature switch, `chat_photos`, is in no plan. A Super admin turns
--      it on per church; until then nobody can send photos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Small helpers
-- ----------------------------------------------------------------------------

-- Turns text into a uuid, or null if it isn't one — storage paths are
-- client-chosen text, and a bad cast must deny access, not throw.
create or replace function safe_uuid(value text)
returns uuid as $$
  select case
    when value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then value::uuid
  end;
$$ language sql immutable;

/**
 * Is a feature (module) on for this church? A church_modules override wins;
 * otherwise the church's plan decides. Mirrors lib/paywall.ts.
 */
create or replace function church_module_enabled(target_church uuid, target_module text)
returns boolean as $$
  select coalesce(
    (select enabled from church_modules where church_id = target_church and module_key = target_module),
    exists (
      select 1
      from church_subscriptions s
      join plan_modules pm on pm.plan_key = s.plan_key
      where s.church_id = target_church and pm.module_key = target_module
    )
  );
$$ language sql stable security definer set search_path = public;

insert into modules (key, name, description) values
  ('chat_photos', 'Chat photo sharing', 'Send photos in chats. Off by default because of storage cost; enable per church.')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 1. Profile & privacy columns on app_users
-- ----------------------------------------------------------------------------
alter table app_users add column if not exists avatar_path text;
alter table app_users add column if not exists about text;
alter table app_users add column if not exists dm_privacy text not null default 'everyone';
alter table app_users add column if not exists share_read_receipts boolean not null default true;

alter table app_users drop constraint if exists app_users_about_length;
alter table app_users add constraint app_users_about_length check (about is null or char_length(about) <= 140);
alter table app_users drop constraint if exists app_users_dm_privacy_check;
alter table app_users add constraint app_users_dm_privacy_check check (dm_privacy in ('everyone', 'leaders', 'nobody'));

/**
 * Profile preferences belong to the person. Pastors/admins can update member
 * rows (app_users_update_by_shepherd) — this stops them changing someone
 * else's About, DM privacy or read receipts, and lets them only *remove* a
 * photo, never set one. A photo must live in the person's own folder.
 * Turning read receipts off also withdraws the receipts already shared.
 */
create or replace function protect_member_chat_profile()
returns trigger as $$
begin
  if auth.uid() is not null and auth.uid() <> old.id and not is_super_admin() then
    if new.about is distinct from old.about
       or new.dm_privacy is distinct from old.dm_privacy
       or new.share_read_receipts is distinct from old.share_read_receipts then
      raise exception 'Only the member can change their own profile settings.' using errcode = '42501';
    end if;
    if new.avatar_path is distinct from old.avatar_path and new.avatar_path is not null then
      raise exception 'Only the member can set their profile photo.' using errcode = '42501';
    end if;
  end if;

  if new.avatar_path is not null
     and new.avatar_path is distinct from old.avatar_path
     and new.avatar_path not like old.church_id::text || '/' || old.id::text || '/%' then
    raise exception 'Profile photos must be stored in the member''s own folder.' using errcode = '42501';
  end if;

  if old.share_read_receipts and not new.share_read_receipts then
    delete from chat_read_receipts where user_id = old.id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 2. Who can see / post in a channel (one definition, reused everywhere)
-- ----------------------------------------------------------------------------

/**
 * Can the signed-in person read this channel? DMs: they're a participant.
 * Group channels: church-wide, their own department's, or any channel in
 * their church if they're a pastor/admin. Deactivated accounts get nothing
 * (current_church_id() is null for them).
 */
create or replace function can_access_chat_channel(target_channel uuid)
returns boolean as $$
  select exists (
    select 1 from chat_channels c
    where c.id = target_channel
      and c.church_id = current_church_id()
      and (
        (c.is_dm and exists (
          select 1 from chat_channel_members m where m.channel_id = c.id and m.user_id = auth.uid()
        ))
        or (
          not c.is_dm
          and (
            c.department_id is null
            or c.department_id = (select department_id from app_users where id = auth.uid())
            or is_church_shepherd(c.church_id)
          )
        )
      )
  );
$$ language sql stable security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 3. Blocks and admin restrictions
-- ----------------------------------------------------------------------------
create table if not exists chat_blocks (
  blocker_id  uuid not null references app_users(id) on delete cascade,
  blocked_id  uuid not null references app_users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists idx_chat_blocks_blocked on chat_blocks(blocked_id);
alter table chat_blocks enable row level security;

-- Only the person who blocked can see the block — the blocked person is never told.
drop policy if exists chat_blocks_select on chat_blocks;
create policy chat_blocks_select on chat_blocks for select using (blocker_id = auth.uid());

drop policy if exists chat_blocks_insert on chat_blocks;
create policy chat_blocks_insert on chat_blocks for insert with check (
  blocker_id = auth.uid()
  and exists (select 1 from app_users u where u.id = blocked_id and u.church_id = current_church_id())
);

drop policy if exists chat_blocks_delete on chat_blocks;
create policy chat_blocks_delete on chat_blocks for delete using (blocker_id = auth.uid());

create or replace function is_blocked_between(a uuid, b uuid)
returns boolean as $$
  select exists (
    select 1 from chat_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$ language sql stable security definer set search_path = public;

create table if not exists member_chat_restrictions (
  id          uuid primary key default uuid_generate_v4(),
  church_id   uuid not null references churches(id) on delete cascade,
  user_id     uuid not null references app_users(id) on delete cascade,
  kind        text not null check (kind in ('group_mute', 'no_voice')),
  until       timestamptz,               -- null = until lifted
  reason      text not null check (char_length(reason) between 3 and 500),
  created_by  uuid references app_users(id) on delete set null,
  lifted_at   timestamptz,
  lifted_by   uuid references app_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_member_chat_restrictions_user on member_chat_restrictions(user_id, kind);
alter table member_chat_restrictions enable row level security;

drop trigger if exists trg_member_chat_restrictions_updated_at on member_chat_restrictions;
create trigger trg_member_chat_restrictions_updated_at before update on member_chat_restrictions
  for each row execute function set_updated_at();
select freeze_church_id_on('member_chat_restrictions');

/**
 * May the signed-in pastor/admin restrict this member? Same church, not
 * themselves, and only a church admin may restrict another church admin
 * (mirrors canEditMemberRole in lib/permissions.ts).
 */
create or replace function can_restrict_member(target_user uuid)
returns boolean as $$
  select exists (
    select 1
    from app_users actor
    join app_users target on target.id = target_user
    where actor.id = auth.uid()
      and actor.status <> 'disabled'
      and actor.role in ('pastor', 'church_admin')
      and target.church_id = actor.church_id
      and target.id <> actor.id
      and (target.role <> 'church_admin' or actor.role = 'church_admin')
  );
$$ language sql stable security definer set search_path = public;

-- The member can see their own restrictions (so the app can explain why they
-- can't post); pastors/admins see their church's.
drop policy if exists member_chat_restrictions_select on member_chat_restrictions;
create policy member_chat_restrictions_select on member_chat_restrictions for select using (
  user_id = auth.uid() or is_church_shepherd(church_id)
);

drop policy if exists member_chat_restrictions_insert on member_chat_restrictions;
create policy member_chat_restrictions_insert on member_chat_restrictions for insert with check (
  church_id = current_church_id()
  and created_by = auth.uid()
  and lifted_at is null
  and can_restrict_member(user_id)
);

-- Updates are for lifting or changing the end date; history is never deleted.
drop policy if exists member_chat_restrictions_update on member_chat_restrictions;
create policy member_chat_restrictions_update on member_chat_restrictions
  for update using (is_church_shepherd(church_id) and can_restrict_member(user_id))
  with check (church_id = current_church_id() and can_restrict_member(user_id));

create or replace function has_chat_restriction(target_user uuid, restriction text)
returns boolean as $$
  select exists (
    select 1 from member_chat_restrictions
    where user_id = target_user
      and kind = restriction
      and lifted_at is null
      and (until is null or until > now())
  );
$$ language sql stable security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 4. Messages: types, media, replies, edit/delete markers
-- ----------------------------------------------------------------------------
alter table chat_messages add column if not exists kind text not null default 'text';
alter table chat_messages add column if not exists media_path text;
alter table chat_messages add column if not exists media_duration_ms integer;
alter table chat_messages add column if not exists media_expired_at timestamptz;
alter table chat_messages add column if not exists reply_to_id uuid references chat_messages(id) on delete set null;
alter table chat_messages add column if not exists edited_at timestamptz;
alter table chat_messages add column if not exists deleted_at timestamptz;
alter table chat_messages add column if not exists deleted_by uuid references app_users(id) on delete set null;
alter table chat_messages add column if not exists updated_at timestamptz not null default now();

alter table chat_messages drop constraint if exists chat_messages_kind_check;
alter table chat_messages add constraint chat_messages_kind_check check (kind in ('text', 'voice', 'image'));

-- Text messages: 1–4000 characters. Voice/photo: an optional caption.
-- Deleted messages: text wiped. (Replaces platform_hardening's length check.)
alter table chat_messages drop constraint if exists chat_messages_content_length;
alter table chat_messages add constraint chat_messages_content_length check (
  (deleted_at is not null and content = '')
  or (deleted_at is null and kind = 'text' and char_length(content) between 1 and 4000)
  or (deleted_at is null and kind in ('voice', 'image') and char_length(content) <= 1000)
) not valid;

-- A voice note or photo needs its file until it's deleted or expires.
alter table chat_messages drop constraint if exists chat_messages_media_present;
alter table chat_messages add constraint chat_messages_media_present check (
  kind = 'text' or deleted_at is not null or media_expired_at is not null or media_path is not null
);

-- 2-minute voice notes (plus a little slack for recorder rounding).
alter table chat_messages drop constraint if exists chat_messages_duration_range;
alter table chat_messages add constraint chat_messages_duration_range check (
  media_duration_ms is null or media_duration_ms between 0 and 125000
);

create index if not exists idx_chat_messages_media_created on chat_messages(created_at)
  where media_path is not null and media_expired_at is null;

drop trigger if exists trg_chat_messages_updated_at on chat_messages;
create trigger trg_chat_messages_updated_at before update on chat_messages
  for each row execute function set_updated_at();

/**
 * Checks on every new message that RLS can't express on its own: a file must
 * sit in this church/channel/sender's folder, and a reply must quote a
 * message from the same conversation.
 */
create or replace function check_chat_message_insert()
returns trigger as $$
declare
  channel_church uuid;
begin
  select church_id into channel_church from chat_channels where id = new.channel_id;

  if new.media_path is not null
     and new.media_path not like channel_church::text || '/' || new.channel_id::text || '/' || new.sender_id::text || '/%' then
    raise exception 'Chat files must be stored in this conversation''s folder.' using errcode = '42501';
  end if;

  if new.reply_to_id is not null
     and not exists (select 1 from chat_messages where id = new.reply_to_id and channel_id = new.channel_id) then
    raise exception 'You can only reply to a message in the same conversation.' using errcode = '22023';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_check_chat_message_insert on chat_messages;
create trigger trg_check_chat_message_insert before insert on chat_messages
  for each row execute function check_chat_message_insert();

/**
 * May the signed-in person post this kind of message here? Covers access,
 * admin restrictions (group mute applies to group channels only; voice-off
 * applies everywhere), blocks in DMs, and the photo feature switch.
 */
create or replace function can_post_chat_message(target_channel uuid, message_kind text)
returns boolean as $$
declare
  c chat_channels;
begin
  select * into c from chat_channels where id = target_channel;
  if not found or not can_access_chat_channel(target_channel) then
    return false;
  end if;
  if not c.is_dm and has_chat_restriction(auth.uid(), 'group_mute') then
    return false;
  end if;
  if message_kind = 'voice' and has_chat_restriction(auth.uid(), 'no_voice') then
    return false;
  end if;
  if message_kind = 'image' and not church_module_enabled(c.church_id, 'chat_photos') then
    return false;
  end if;
  if c.is_dm and exists (
    select 1 from chat_channel_members m
    where m.channel_id = target_channel and m.user_id <> auth.uid() and is_blocked_between(auth.uid(), m.user_id)
  ) then
    return false;
  end if;
  return true;
end;
$$ language plpgsql stable security definer set search_path = public;

drop policy if exists chat_messages_insert on chat_messages;
create policy chat_messages_insert on chat_messages for insert with check (
  sender_id = auth.uid()
  and can_post_chat_message(channel_id, kind)
  -- New messages can't arrive pre-edited, pre-deleted or pre-expired.
  and edited_at is null
  and deleted_at is null
  and deleted_by is null
  and media_expired_at is null
);

-- No more hard deletes from the browser: deleting is a soft delete through
-- delete_chat_message() below, so "This message was deleted" can be shown.
-- (Erasing a member still removes their messages — ON DELETE CASCADE.)
drop policy if exists chat_messages_delete on chat_messages;
-- No UPDATE policy either: edits go through edit_chat_message().

/** Edit your own text message within 15 minutes (keep in sync with lib/chat.ts). */
create or replace function edit_chat_message(target_message uuid, new_content text)
returns void as $$
declare
  m chat_messages;
begin
  select * into m from chat_messages where id = target_message;
  if not found or m.sender_id <> auth.uid() or not can_access_chat_channel(m.channel_id) then
    raise exception 'You can only edit your own messages.' using errcode = '42501';
  end if;
  if m.kind <> 'text' or m.deleted_at is not null then
    raise exception 'This message can''t be edited.' using errcode = '22023';
  end if;
  if m.created_at < now() - interval '15 minutes' then
    raise exception 'Messages can only be edited for 15 minutes after sending.' using errcode = '22023';
  end if;
  if new_content is null or char_length(btrim(new_content)) not between 1 and 4000 then
    raise exception 'Messages must be between 1 and 4000 characters.' using errcode = '22023';
  end if;

  update chat_messages set content = btrim(new_content), edited_at = now() where id = target_message;
end;
$$ language plpgsql security definer set search_path = public;

/**
 * Delete for everyone. Allowed for the sender, or a pastor/admin in a group
 * channel — never in a DM. The text is wiped and the message stays as a
 * placeholder. Returns the file path (if any) so the server can remove the
 * file from storage; returns null if there was no file.
 */
create or replace function delete_chat_message(target_message uuid)
returns text as $$
declare
  m chat_messages;
  c chat_channels;
  old_path text;
begin
  select * into m from chat_messages where id = target_message;
  if not found then
    raise exception 'That message no longer exists.' using errcode = 'P0002';
  end if;
  select * into c from chat_channels where id = m.channel_id;

  if not can_access_chat_channel(m.channel_id) or not (
    m.sender_id = auth.uid()
    or (not c.is_dm and is_church_shepherd(c.church_id))
  ) then
    raise exception 'You can only delete your own messages.' using errcode = '42501';
  end if;
  if m.deleted_at is not null then
    return null;
  end if;

  old_path := m.media_path;
  update chat_messages
     set content = '', media_path = null, deleted_at = now(), deleted_by = auth.uid()
   where id = target_message;
  return old_path;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 5. Reactions — one per person per message, from a fixed set
-- ----------------------------------------------------------------------------
create table if not exists chat_message_reactions (
  message_id  uuid not null references chat_messages(id) on delete cascade,
  user_id     uuid not null references app_users(id) on delete cascade,
  -- Copied from the message so live updates can be filtered per chat
  -- (Realtime filters on one column); a trigger keeps it truthful.
  channel_id  uuid not null references chat_channels(id) on delete cascade,
  emoji       text not null check (emoji in ('👍', '❤️', '🙏', '😂', '😮', '😢')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists idx_chat_message_reactions_channel on chat_message_reactions(channel_id);
alter table chat_message_reactions enable row level security;

drop trigger if exists trg_chat_message_reactions_updated_at on chat_message_reactions;
create trigger trg_chat_message_reactions_updated_at before update on chat_message_reactions
  for each row execute function set_updated_at();

create or replace function check_chat_reaction()
returns trigger as $$
begin
  if not exists (
    select 1 from chat_messages
    where id = new.message_id and channel_id = new.channel_id and deleted_at is null
  ) then
    raise exception 'You can''t react to that message.' using errcode = '22023';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_check_chat_reaction on chat_message_reactions;
create trigger trg_check_chat_reaction before insert or update on chat_message_reactions
  for each row execute function check_chat_reaction();

drop policy if exists chat_message_reactions_select on chat_message_reactions;
create policy chat_message_reactions_select on chat_message_reactions
  for select using (can_access_chat_channel(channel_id));

drop policy if exists chat_message_reactions_insert on chat_message_reactions;
create policy chat_message_reactions_insert on chat_message_reactions
  for insert with check (user_id = auth.uid() and can_access_chat_channel(channel_id));

drop policy if exists chat_message_reactions_update on chat_message_reactions;
create policy chat_message_reactions_update on chat_message_reactions
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and can_access_chat_channel(channel_id));

drop policy if exists chat_message_reactions_delete on chat_message_reactions;
create policy chat_message_reactions_delete on chat_message_reactions
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 6. Per-person chat settings (private) and read receipts (shared)
-- ----------------------------------------------------------------------------

-- Group channels have no membership rows, so settings live here, keyed by
-- person + channel. Only the person can see or change their own.
create table if not exists chat_member_settings (
  channel_id    uuid not null references chat_channels(id) on delete cascade,
  user_id       uuid not null references app_users(id) on delete cascade,
  muted_until   timestamptz,     -- far future = muted "always"
  pinned_at     timestamptz,
  cleared_at    timestamptz,     -- hide messages before this, for me only
  last_read_at  timestamptz,     -- private: drives my unread counts
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists idx_chat_member_settings_user on chat_member_settings(user_id);
alter table chat_member_settings enable row level security;

drop trigger if exists trg_chat_member_settings_updated_at on chat_member_settings;
create trigger trg_chat_member_settings_updated_at before update on chat_member_settings
  for each row execute function set_updated_at();

drop policy if exists chat_member_settings_select on chat_member_settings;
create policy chat_member_settings_select on chat_member_settings for select using (user_id = auth.uid());

drop policy if exists chat_member_settings_insert on chat_member_settings;
create policy chat_member_settings_insert on chat_member_settings
  for insert with check (user_id = auth.uid() and can_access_chat_channel(channel_id));

drop policy if exists chat_member_settings_update on chat_member_settings;
create policy chat_member_settings_update on chat_member_settings
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and can_access_chat_channel(channel_id));

drop policy if exists chat_member_settings_delete on chat_member_settings;
create policy chat_member_settings_delete on chat_member_settings for delete using (user_id = auth.uid());

-- Shared "read up to" times. Written only by mark_chat_read(), and only for
-- people who share read receipts. Like WhatsApp, someone who has turned
-- receipts off can't see other people's either.
create table if not exists chat_read_receipts (
  channel_id  uuid not null references chat_channels(id) on delete cascade,
  user_id     uuid not null references app_users(id) on delete cascade,
  read_at     timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (channel_id, user_id)
);
alter table chat_read_receipts enable row level security;

drop trigger if exists trg_chat_read_receipts_updated_at on chat_read_receipts;
create trigger trg_chat_read_receipts_updated_at before update on chat_read_receipts
  for each row execute function set_updated_at();

drop policy if exists chat_read_receipts_select on chat_read_receipts;
create policy chat_read_receipts_select on chat_read_receipts for select using (
  can_access_chat_channel(channel_id)
  and coalesce((select share_read_receipts from app_users where id = auth.uid()), false)
);

/** Marks a chat as read now: always privately, and publicly if receipts are on. */
create or replace function mark_chat_read(target_channel uuid)
returns void as $$
begin
  if not can_access_chat_channel(target_channel) then
    raise exception 'You don''t have access to that conversation.' using errcode = '42501';
  end if;

  insert into chat_member_settings (channel_id, user_id, last_read_at)
  values (target_channel, auth.uid(), now())
  on conflict (channel_id, user_id) do update set last_read_at = excluded.last_read_at;

  if (select share_read_receipts from app_users where id = auth.uid()) then
    insert into chat_read_receipts (channel_id, user_id, read_at)
    values (target_channel, auth.uid(), now())
    on conflict (channel_id, user_id) do update set read_at = excluded.read_at;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- The profile trigger (section 1) deletes from chat_read_receipts, so it's
-- attached only now that the table exists.
drop trigger if exists trg_protect_member_chat_profile on app_users;
create trigger trg_protect_member_chat_profile before update on app_users
  for each row execute function protect_member_chat_profile();

-- ----------------------------------------------------------------------------
-- 7. Starting a DM: privacy settings and blocks
-- ----------------------------------------------------------------------------

/**
 * Same as platform_hardening.sql, plus: the other person's "who can DM me"
 * setting (pastors and church admins are exempt, for pastoral care) and
 * blocks (which apply to everyone, pastors included). An existing
 * conversation is still returned — privacy settings control *starting* new
 * DMs; blocking is what stops messages.
 */
create or replace function start_direct_message(other_user uuid)
returns uuid as $$
declare
  my_church uuid := current_church_id();
  my_role   text := (select role from app_users where id = auth.uid());
  other     app_users;
  existing  uuid;
  created   uuid;
begin
  if my_church is null or other_user is null or other_user = auth.uid() then
    raise exception 'Choose someone else in your church.' using errcode = '22023';
  end if;

  select * into other from app_users
  where id = other_user and church_id = my_church and status <> 'disabled';
  if not found then
    raise exception 'That person is not in your church.' using errcode = '42501';
  end if;

  if is_blocked_between(auth.uid(), other_user) then
    raise exception 'You can''t message this person.' using errcode = '42501';
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

  if my_role not in ('pastor', 'church_admin') and (
    other.dm_privacy = 'nobody'
    or (other.dm_privacy = 'leaders' and my_role <> 'department_leader')
  ) then
    raise exception 'This person isn''t accepting new direct messages.' using errcode = '42501';
  end if;

  insert into chat_channels (church_id, is_dm, name)
  values (my_church, true, 'Direct message')
  returning id into created;

  insert into chat_channel_members (channel_id, user_id)
  values (created, auth.uid()), (created, other_user);

  return created;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 8. Storage: profile photos and chat media (both private)
-- ----------------------------------------------------------------------------
-- Paths:  avatars/<church_id>/<user_id>/<random>.webp
--         chat-media/<church_id>/<channel_id>/<sender_id>/<random>.<ext>
-- Uploads always use a new random name (no overwrites), so there's no
-- UPDATE policy. Moderation and expiry deletes use the service role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 1 MB comfortably holds 2 minutes of compressed speech; photos are
-- compressed in the browser before upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 1048576,
        array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_select on storage.objects;
create policy avatars_select on storage.objects for select to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = current_church_id()::text
);

drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = current_church_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists chat_media_select on storage.objects;
create policy chat_media_select on storage.objects for select to authenticated using (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[1] = current_church_id()::text
  and can_access_chat_channel(safe_uuid((storage.foldername(name))[2]))
);

drop policy if exists chat_media_insert on storage.objects;
create policy chat_media_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[1] = current_church_id()::text
  and (storage.foldername(name))[3] = auth.uid()::text
  and can_access_chat_channel(safe_uuid((storage.foldername(name))[2]))
);

drop policy if exists chat_media_delete on storage.objects;
create policy chat_media_delete on storage.objects for delete to authenticated using (
  bucket_id = 'chat-media' and (storage.foldername(name))[3] = auth.uid()::text
);

-- ----------------------------------------------------------------------------
-- 9. Live updates (Supabase Realtime)
-- ----------------------------------------------------------------------------
-- Edits and deletes now arrive as UPDATEs, and reactions/receipts are new
-- tables. Adds them to Realtime if it's set up; skipped silently otherwise
-- (e.g. the test database).
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['chat_messages', 'chat_message_reactions', 'chat_read_receipts'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
