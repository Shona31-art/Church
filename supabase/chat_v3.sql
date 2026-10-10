-- ============================================================================
-- CHAT V3 — create, edit and delete channels; delete chats
--
-- Run after bible_games_content.sql. Safe to re-run.
--
-- In plain language:
--   1. Pastors and church admins can create extra group channels (e.g.
--      "Prayer team"), open to the whole church or to chosen members only,
--      and rename them or change who's in them later.
--   2. Church admins can permanently delete a department channel or an extra
--      channel, with all its messages. The church-wide "General" channel
--      can't be deleted.
--   3. Either person in a private conversation can delete it for both of
--      them (permanent), or just hide it from their own list ("delete for
--      me" — it comes back if a new message arrives).
--   All of this goes through database functions that check who's asking, so
--   nobody can delete or join a channel by calling the API directly.
-- ============================================================================

-- 1. Channel details
alter table chat_channels add column if not exists is_custom boolean not null default false;
alter table chat_channels add column if not exists members_only boolean not null default false;
alter table chat_channels add column if not exists description text;
alter table chat_channels add column if not exists created_by uuid references app_users(id) on delete set null;
alter table chat_channels add column if not exists updated_at timestamptz not null default now();

alter table chat_channels drop constraint if exists chat_channels_description_length;
alter table chat_channels add constraint chat_channels_description_length check (description is null or char_length(description) <= 200);

drop trigger if exists trg_chat_channels_updated_at on chat_channels;
create trigger trg_chat_channels_updated_at before update on chat_channels
  for each row execute function set_updated_at();

-- "Delete for me": hidden from my list until a newer message arrives.
alter table chat_member_settings add column if not exists hidden_at timestamptz;

-- 2. Who can see a channel — now including members-only channels.
create or replace function can_access_chat_channel(target_channel uuid)
returns boolean as $$
  select exists (
    select 1 from chat_channels c
    where c.id = target_channel
      and c.church_id = current_church_id()
      and (
        -- DMs and members-only channels: you're on the member list…
        ((c.is_dm or c.members_only) and exists (
          select 1 from chat_channel_members m where m.channel_id = c.id and m.user_id = auth.uid()
        ))
        -- …and pastors/admins can see (and moderate) members-only channels.
        or (not c.is_dm and c.members_only and is_church_shepherd(c.church_id))
        -- Open channels: church-wide, your department's, or any for pastors/admins.
        or (
          not c.is_dm and not c.members_only
          and (
            c.department_id is null
            or c.department_id = (select department_id from app_users where id = auth.uid())
            or is_church_shepherd(c.church_id)
          )
        )
      )
  );
$$ language sql stable security definer set search_path = public;

-- Channel and message visibility now use that one definition (replacing the
-- inline rules from chat_schema.sql / dm_schema.sql).
drop policy if exists chat_channels_select on chat_channels;
create policy chat_channels_select on chat_channels for select using (is_super_admin() or can_access_chat_channel(id));

drop policy if exists chat_messages_select on chat_messages;
create policy chat_messages_select on chat_messages for select using (is_super_admin() or can_access_chat_channel(channel_id));

-- Creating channels goes through create_chat_channel() below.
drop policy if exists chat_channels_insert on chat_channels;

-- 3. Create / edit a channel (pastors and church admins)
create or replace function set_channel_members(target_channel uuid, member_ids uuid[])
returns void as $$
  -- Replace the member list: only active people from the channel's church.
  with church as (select church_id from chat_channels where id = target_channel)
  , wanted as (
    select u.id from app_users u, church
    where u.id = any(member_ids) and u.church_id = church.church_id and u.status <> 'disabled'
  )
  , removed as (
    delete from chat_channel_members m
    where m.channel_id = target_channel and m.user_id not in (select id from wanted)
  )
  insert into chat_channel_members (channel_id, user_id)
  select target_channel, id from wanted
  on conflict do nothing;
$$ language sql volatile security definer set search_path = public;

create or replace function create_chat_channel(channel_name text, channel_description text, only_members boolean, member_ids uuid[])
returns uuid as $$
declare
  my_church uuid := current_church_id();
  created uuid;
begin
  if my_church is null or not is_church_shepherd(my_church) then
    raise exception 'Only pastors and church admins can create channels.' using errcode = '42501';
  end if;
  if channel_name is null or char_length(btrim(channel_name)) not between 2 and 60 then
    raise exception 'Channel names must be 2 to 60 characters.' using errcode = '22023';
  end if;

  insert into chat_channels (church_id, department_id, name, description, is_custom, members_only, created_by)
  values (my_church, null, btrim(channel_name), nullif(btrim(coalesce(channel_description, '')), ''), true, coalesce(only_members, false), auth.uid())
  returning id into created;

  if only_members then
    -- The creator is always a member of a members-only channel they create.
    perform set_channel_members(created, array_append(coalesce(member_ids, '{}'), auth.uid()));
  end if;
  return created;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function update_chat_channel(target_channel uuid, channel_name text, channel_description text, only_members boolean, member_ids uuid[])
returns void as $$
declare
  c chat_channels;
begin
  select * into c from chat_channels where id = target_channel;
  if not found or c.church_id <> current_church_id() or not is_church_shepherd(c.church_id) then
    raise exception 'Only pastors and church admins can change channels.' using errcode = '42501';
  end if;
  if not c.is_custom then
    raise exception 'Only channels created in the app can be edited.' using errcode = '22023';
  end if;
  if channel_name is null or char_length(btrim(channel_name)) not between 2 and 60 then
    raise exception 'Channel names must be 2 to 60 characters.' using errcode = '22023';
  end if;

  update chat_channels
     set name = btrim(channel_name),
         description = nullif(btrim(coalesce(channel_description, '')), ''),
         members_only = coalesce(only_members, false)
   where id = target_channel;

  if only_members then
    perform set_channel_members(target_channel, coalesce(member_ids, '{}'));
  else
    delete from chat_channel_members where channel_id = target_channel;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- 4. Deleting channels and DMs. Both return the conversation's voice-note /
-- photo file paths so the server can remove the files from Storage.

/** Church admins only; department and extra channels; never General or a DM. */
create or replace function delete_chat_channel(target_channel uuid)
returns text[] as $$
declare
  c chat_channels;
  paths text[];
begin
  select * into c from chat_channels where id = target_channel;
  if not found or c.church_id <> current_church_id() or not exists (
    select 1 from app_users where id = auth.uid() and role = 'church_admin' and status <> 'disabled'
  ) then
    raise exception 'Only church admins can delete channels.' using errcode = '42501';
  end if;
  if c.is_dm or (c.department_id is null and not c.is_custom) then
    raise exception 'This channel can''t be deleted.' using errcode = '22023';
  end if;

  select coalesce(array_agg(media_path), '{}') into paths from chat_messages where channel_id = target_channel and media_path is not null;
  delete from chat_channels where id = target_channel; -- messages, members, reactions and settings cascade
  return paths;
end;
$$ language plpgsql security definer set search_path = public;

/** Either person in a DM can delete it for both. Permanent. */
create or replace function delete_direct_message(target_channel uuid)
returns text[] as $$
declare
  paths text[];
begin
  if not exists (
    select 1 from chat_channels c
    join chat_channel_members m on m.channel_id = c.id and m.user_id = auth.uid()
    where c.id = target_channel and c.is_dm and c.church_id = current_church_id()
  ) then
    raise exception 'You can only delete your own conversations.' using errcode = '42501';
  end if;

  select coalesce(array_agg(media_path), '{}') into paths from chat_messages where channel_id = target_channel and media_path is not null;
  delete from chat_channels where id = target_channel;
  return paths;
end;
$$ language plpgsql security definer set search_path = public;
