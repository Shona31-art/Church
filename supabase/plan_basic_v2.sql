-- ============================================================================
-- BASIC PLAN V2 — 50 members, and only features that cost nothing to run.
--
-- Run after chat_v2.sql. Safe to re-run. Changes plan data (plans and
-- plan_modules), not any church's own data.
--
-- In plain language:
--   1. Basic now allows up to 50 active members (was 200). Churches already
--      above 50 keep every member; they just can't invite more until they're
--      under 50 or upgrade (the app explains this to their admin).
--   2. Two new switches for the costly *parts* of otherwise free features:
--        ai_assist  — AI writing help (announcement writer, "help me write my
--                     prayer", automatic prayer verse suggestions, quiz
--                     question generator). Costs per AI call.
--        chat_voice — voice notes in chat. Costs Storage.
--      Every plan that had these before keeps them; Basic doesn't get them.
--   3. Basic gains the Premium features that cost nothing to run: the Bible
--      reader (public-domain text), Service planner, Pastor booking, and
--      text chat (without voice notes).
--   4. The database refuses voice notes and their file uploads for churches
--      whose plan doesn't include chat_voice (photos already needed chat_photos).
-- ============================================================================

-- 1. Member limit
update plans
   set member_limit = 50,
       description = 'Small church starter plan: up to 50 members'
 where key = 'basic';

-- 2. New switches
insert into modules (key, name, description) values
  ('ai_assist',  'AI writing help',  'AI buttons inside announcements, prayers and quiz questions (costs per AI call)'),
  ('chat_voice', 'Chat voice notes', 'Record and send voice notes in chat (uses file storage)')
on conflict (key) do nothing;

insert into plan_modules (plan_key, module_key) values
  ('free_trial', 'ai_assist'),
  ('premium',    'ai_assist'),
  ('enterprise', 'ai_assist'),
  ('sponsored',  'ai_assist'),
  ('premium',    'chat_voice'),
  ('enterprise', 'chat_voice'),
  ('sponsored',  'chat_voice')
on conflict do nothing;

-- 3. Free-to-run features added to Basic
insert into plan_modules (plan_key, module_key) values
  ('basic', 'bible'),
  ('basic', 'service_planner'),
  ('basic', 'pastor_booking'),
  ('basic', 'dept_chats')
on conflict do nothing;

-- 4. Enforce the voice switch in the database, not just the screen.
-- Same as chat_v2.sql, plus the chat_voice check.
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
  if message_kind = 'voice' and (
    has_chat_restriction(auth.uid(), 'no_voice')
    or not church_module_enabled(c.church_id, 'chat_voice')
  ) then
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

-- Uploads too: no audio files without chat_voice, no images without
-- chat_photos — so a Basic church can't fill Storage by calling the API directly.
drop policy if exists chat_media_insert on storage.objects;
create policy chat_media_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[1] = current_church_id()::text
  and (storage.foldername(name))[3] = auth.uid()::text
  and can_access_chat_channel(safe_uuid((storage.foldername(name))[2]))
  and church_module_enabled(
    current_church_id(),
    case when lower(name) ~ '\.(webp|jpe?g)$' then 'chat_photos' else 'chat_voice' end
  )
);
