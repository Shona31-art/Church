-- ============================================================================
-- Delete messages "for me" (migration #52). Run after calls_v3.sql.
-- ============================================================================
-- In plain language: like WhatsApp, you can select one or more messages and
-- delete them just for yourself — e.g. a "Missed video call" note. They
-- disappear from your view of the chat (and from your search and starred
-- lists); everyone else still sees them. Deleting your own messages "for
-- everyone" works as before.
--
-- Each hidden message is one small row (who + which message). Nothing about
-- the message itself is copied. Safe to run more than once.
-- ============================================================================

create table if not exists chat_hidden_messages (
  user_id     uuid not null references app_users(id) on delete cascade,
  message_id  uuid not null references chat_messages(id) on delete cascade,
  channel_id  uuid not null references chat_channels(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, message_id)
);
create index if not exists idx_chat_hidden_message on chat_hidden_messages(message_id);
alter table chat_hidden_messages enable row level security;

-- Only your own rows, and only for messages you can see in a chat you're in.
drop policy if exists chat_hidden_select on chat_hidden_messages;
create policy chat_hidden_select on chat_hidden_messages for select using (user_id = (select auth.uid()));
drop policy if exists chat_hidden_insert on chat_hidden_messages;
create policy chat_hidden_insert on chat_hidden_messages for insert with check (
  user_id = (select auth.uid())
  and can_access_chat_channel(channel_id)
  and exists (select 1 from chat_messages m where m.id = message_id and m.channel_id = chat_hidden_messages.channel_id)
);
drop policy if exists chat_hidden_delete on chat_hidden_messages;
create policy chat_hidden_delete on chat_hidden_messages for delete using (user_id = (select auth.uid()));

-- Hidden messages are gone from everything you read: the chat, live updates,
-- search, starred. Restrictive, so it narrows the existing read rules.
-- (Looked up by a helper so the two tables' rules don't check each other in a loop.)
create or replace function chat_message_hidden_by_me(target_message uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_hidden_messages h where h.message_id = target_message and h.user_id = auth.uid())
$$;
revoke all on function chat_message_hidden_by_me(uuid) from public;
grant execute on function chat_message_hidden_by_me(uuid) to authenticated;

drop policy if exists chat_messages_not_hidden_by_me on chat_messages;
create policy chat_messages_not_hidden_by_me on chat_messages as restrictive for select to authenticated using (
  not chat_message_hidden_by_me(id)
);
