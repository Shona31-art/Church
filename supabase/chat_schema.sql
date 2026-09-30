-- ============================================================================
-- CHAT — church-wide "General" channel + one channel per department
-- Uses the existing 'dept_chats' module key (already registered/gated in
-- schema.sql) for both — a general channel is just a channel with no
-- department_id.
-- ============================================================================

create table chat_channels (
  id            uuid primary key default uuid_generate_v4(),
  church_id     uuid not null references churches(id) on delete cascade,
  department_id uuid references departments(id) on delete cascade, -- null = church-wide "General"
  name          text not null,
  created_at    timestamptz not null default now(),

  unique (church_id, department_id)  -- one channel per department, one general per church (department_id null)
);

create index idx_chat_channels_church on chat_channels(church_id);

alter table chat_channels enable row level security;

-- Visible if: church-wide (department_id is null) and same church, OR
-- it's your own department's channel, OR you're pastor/church_admin (see all)
create policy chat_channels_select on chat_channels
  for select using (
    is_super_admin()
    or (
      church_id = current_church_id()
      and (
        department_id is null
        or department_id = (select department_id from app_users where id = auth.uid())
        or exists (select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor'))
      )
    )
  );

-- Channels are normally auto-created (general on church signup, one per
-- department on department creation) — this policy exists for the rare
-- manual case (e.g. a church_admin wants an extra general-purpose channel).
create policy chat_channels_insert on chat_channels
  for insert with check (
    church_id = current_church_id()
    and exists (select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor'))
  );

create table chat_messages (
  id            uuid primary key default uuid_generate_v4(),
  channel_id    uuid not null references chat_channels(id) on delete cascade,
  sender_id     uuid not null references app_users(id),
  content       text not null,
  attachment_url text,
  created_at    timestamptz not null default now()
);

create index idx_chat_messages_channel on chat_messages(channel_id, created_at);

alter table chat_messages enable row level security;

-- Inherits visibility from the parent channel
create policy chat_messages_select on chat_messages
  for select using (
    exists (
      select 1 from chat_channels c
      where c.id = channel_id
      and (
        is_super_admin()
        or (
          c.church_id = current_church_id()
          and (
            c.department_id is null
            or c.department_id = (select department_id from app_users where id = auth.uid())
            or exists (select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor'))
          )
        )
      )
    )
  );

create policy chat_messages_insert on chat_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from chat_channels c
      where c.id = channel_id
      and c.church_id = current_church_id()
      and (
        c.department_id is null
        or c.department_id = (select department_id from app_users where id = auth.uid())
        or exists (select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor'))
      )
    )
  );

-- Senders can delete their own messages; church_admin/pastor can moderate any
create policy chat_messages_delete on chat_messages
  for delete using (
    sender_id = auth.uid()
    or exists (
      select 1 from chat_channels c
      join app_users u on u.id = auth.uid()
      where c.id = channel_id and c.church_id = current_church_id() and u.role in ('church_admin', 'pastor')
    )
  );

-- ============================================================================
-- IMPORTANT: enable Realtime for chat_messages after running this file —
-- Supabase Dashboard → Database → Replication → toggle "chat_messages" on
-- (or run: alter publication supabase_realtime add table chat_messages;)
-- Without this, the chat UI will still work but won't update live —
-- messages will only appear after a page refresh.
-- ============================================================================
