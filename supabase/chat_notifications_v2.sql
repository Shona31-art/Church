-- ============================================================================
-- WhatsApp-style message notifications (migration #48). Run after video_calls.sql.
-- ============================================================================
-- In plain language:
--   * Message pop-ups (and bell items) now show what was said, like WhatsApp:
--     a private chat shows "Alice" / "See you at 6"; a group shows
--     "Youth group" / "Alice: See you at 6". Voice notes and photos show
--     "🎤 Voice message" / "📷 Photo". Long messages are cut to 140 characters.
--   * Each person can turn the text off (My account → Notifications → "Show
--     message text"); then pop-ups say "Sent you a message" as before. Useful
--     on a shared phone or a lock screen others can see.
--   * Only the person a notification is for can read it (as before), and it's
--     deleted after 90 days with the rest of their notifications.
--   * If a message is deleted or edited before it's been read, its preview in
--     the notification is replaced too ("🚫 This message was deleted").
--   * Each new message now updates the chat's single pop-up (one per chat,
--     showing the latest message and how many are waiting), instead of only
--     the first message popping up. This needs the notifications webhook to
--     send UPDATEs as well as INSERTs — see the README ("Phone pop-ups").
-- Safe to run more than once.
-- ============================================================================

alter table notification_preferences add column if not exists show_previews boolean not null default true;

-- The text shown for a message in a notification.
create or replace function app_private.chat_preview(kind text, content text)
returns text as $$
  select case
    when kind = 'voice' then '🎤 Voice message'
    when kind = 'image' then '📷 Photo'
    when char_length(regexp_replace(coalesce(content, ''), '\s+', ' ', 'g')) > 140
      then left(regexp_replace(content, '\s+', ' ', 'g'), 139) || '…'
    else regexp_replace(coalesce(content, ''), '\s+', ' ', 'g')
  end;
$$ language sql immutable;

-- Same people as before (notifications.sql); now with the message text for
-- those who want it.
create or replace function app_private.on_chat_message()
returns trigger as $$
declare
  ch record;
  sender_name text;
  preview text;
  body text;
  recipient uuid;
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
    if coalesce((select p.show_previews from notification_preferences p where p.user_id = recipient), true) then
      body := case when ch.is_dm then preview else sender_name || ': ' || preview end;
      perform app_private.notify_grouped(
        recipient, ch.church_id, 'messages', 'chat.message', 'chat:' || ch.id,
        case when ch.is_dm then sender_name else ch.name end,
        body, body, -- always the latest message (the count is shown alongside)
        '/dashboard/chat/' || ch.id, new.sender_id);
    else
      perform app_private.notify_grouped(
        recipient, ch.church_id, 'messages', 'chat.message', 'chat:' || ch.id,
        case when ch.is_dm then sender_name else ch.name end,
        case when ch.is_dm then 'Sent you a message' else 'New message from ' || sender_name end,
        '{n} new messages',
        '/dashboard/chat/' || ch.id, new.sender_id);
    end if;
  end loop;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

-- A message deleted or edited before it was read: don't leave its old text
-- in anyone's notification.
create or replace function app_private.on_chat_message_changed()
returns trigger as $$
declare
  ch record;
  sender_name text;
  old_preview text;
  replacement text;
begin
  if old.deleted_at is not null then return null; end if;
  if new.deleted_at is null and new.content is not distinct from old.content then return null; end if;
  select * into ch from chat_channels where id = new.channel_id;
  select name into sender_name from app_users where id = new.sender_id;
  old_preview := app_private.chat_preview(coalesce(old.kind, 'text'), old.content);
  replacement := case when new.deleted_at is not null then '🚫 This message was deleted' else app_private.chat_preview(coalesce(new.kind, 'text'), new.content) end;

  update notifications n
     set body = case when ch.is_dm then replacement else sender_name || ': ' || replacement end
   where n.group_key = 'chat:' || ch.id
     and n.read_at is null
     and n.body = case when ch.is_dm then old_preview else sender_name || ': ' || old_preview end;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_chat_message_changed on chat_messages;
create trigger trg_notify_chat_message_changed after update of content, deleted_at on chat_messages
  for each row execute function app_private.on_chat_message_changed();

revoke all on all functions in schema app_private from public;
