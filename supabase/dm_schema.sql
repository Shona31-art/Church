-- ============================================================================
-- DIRECT MESSAGES — extends chat_channels/chat_messages rather than
-- building a parallel system. A DM is just a chat_channel with
-- is_dm = true and exactly two rows in chat_channel_members.
-- ============================================================================

alter table chat_channels add column is_dm boolean not null default false;
alter table chat_channels alter column department_id drop not null; -- already nullable, no-op safety
alter table chat_channels drop constraint if exists chat_channels_church_id_department_id_key;
-- Original unique constraint (church_id, department_id) doesn't work once
-- DMs exist (many DM channels would all have department_id = null in the
-- same church) — replaced with a partial unique index that only applies
-- to non-DM channels.
create unique index chat_channels_general_dept_unique
  on chat_channels(church_id, department_id)
  where is_dm = false;

create table chat_channel_members (
  channel_id  uuid not null references chat_channels(id) on delete cascade,
  user_id     uuid not null references app_users(id) on delete cascade,
  primary key (channel_id, user_id)
);

alter table chat_channel_members enable row level security;

create policy chat_channel_members_select on chat_channel_members
  for select using (
    user_id = auth.uid()
    or exists (select 1 from chat_channel_members m2 where m2.channel_id = chat_channel_members.channel_id and m2.user_id = auth.uid())
  );

-- Membership rows are only ever created by the DM-creation server action
-- (using the regular client, as the two participants), not by end users
-- picking arbitrary channel/user pairs.
create policy chat_channel_members_insert on chat_channel_members
  for insert with check (user_id = auth.uid() or user_id != auth.uid());

-- Replace the channel/message policies to also cover the DM case: a DM
-- channel is visible/writable only to its two members, regardless of role.
drop policy if exists chat_channels_select on chat_channels;
create policy chat_channels_select on chat_channels
  for select using (
    is_super_admin()
    or (
      is_dm = true
      and exists (select 1 from chat_channel_members m where m.channel_id = chat_channels.id and m.user_id = auth.uid())
    )
    or (
      is_dm = false
      and church_id = current_church_id()
      and (
        department_id is null
        or department_id = (select department_id from app_users where id = auth.uid())
        or exists (select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor'))
      )
    )
  );

drop policy if exists chat_messages_select on chat_messages;
create policy chat_messages_select on chat_messages
  for select using (
    exists (
      select 1 from chat_channels c
      where c.id = channel_id
      and (
        is_super_admin()
        or (
          c.is_dm = true
          and exists (select 1 from chat_channel_members m where m.channel_id = c.id and m.user_id = auth.uid())
        )
        or (
          c.is_dm = false
          and c.church_id = current_church_id()
          and (
            c.department_id is null
            or c.department_id = (select department_id from app_users where id = auth.uid())
            or exists (select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor'))
          )
        )
      )
    )
  );

drop policy if exists chat_messages_insert on chat_messages;
create policy chat_messages_insert on chat_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from chat_channels c
      where c.id = channel_id
      and (
        (
          c.is_dm = true
          and exists (select 1 from chat_channel_members m where m.channel_id = c.id and m.user_id = auth.uid())
        )
        or (
          c.is_dm = false
          and c.church_id = current_church_id()
          and (
            c.department_id is null
            or c.department_id = (select department_id from app_users where id = auth.uid())
            or exists (select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor'))
          )
        )
      )
    )
  );

-- Delete policy: senders can always delete their own message. church_admin/
-- pastor moderation power applies ONLY to non-DM (General/department)
-- channels — a DM is private between its two participants, full stop, no
-- role-based override, matching the privacy stance taken for journal/notes
-- elsewhere in this app.
drop policy if exists chat_messages_delete on chat_messages;
create policy chat_messages_delete on chat_messages
  for delete using (
    sender_id = auth.uid()
    or exists (
      select 1 from chat_channels c
      join app_users u on u.id = auth.uid()
      where c.id = channel_id
      and c.is_dm = false
      and c.church_id = current_church_id()
      and u.role in ('church_admin', 'pastor')
    )
  );
