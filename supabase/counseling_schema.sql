-- ============================================================================
-- AI COUNSELING MODULE — schema additions
-- Run after schema.sql. Adds the module to the paywall system + its tables.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Register the module (gated by paywall like everything else)
-- ----------------------------------------------------------------------------
insert into modules (key, name, description) values
  ('ai_counseling', 'AI Christian Counseling', 'Scripture-based conversational support, with crisis escalation to pastors');

-- Available on Premium and above (sensitive feature, not free trial / basic)
insert into plan_modules (plan_key, module_key) values
  ('premium', 'ai_counseling'),
  ('enterprise', 'ai_counseling'),
  ('sponsored', 'ai_counseling');

-- ----------------------------------------------------------------------------
-- 2. Per-church configuration
-- ----------------------------------------------------------------------------
create table counseling_settings (
  church_id           uuid primary key references churches(id) on delete cascade,
  enabled             boolean not null default false,   -- explicit opt-in, not on by default
  bible_translation   text not null default 'WEB',       -- 'WEB' | 'KJV' | licensed key if configured
  theological_stance  text,                               -- free-text guidance injected into the system prompt
  escalation_pastor_id uuid references app_users(id),     -- who gets notified on a crisis flag; falls back to any pastor/church_admin if null
  updated_at          timestamptz not null default now()
);

alter table counseling_settings enable row level security;

create policy counseling_settings_select on counseling_settings
  for select using (is_super_admin() or church_id = current_church_id());

create policy counseling_settings_write on counseling_settings
  for all using (
    is_super_admin() or
    (church_id = current_church_id() and exists (
      select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor')
    ))
  )
  with check (
    is_super_admin() or
    (church_id = current_church_id() and exists (
      select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor')
    ))
  );

-- ----------------------------------------------------------------------------
-- 3. Conversations & messages
-- ----------------------------------------------------------------------------
create table counseling_conversations (
  id            uuid primary key default uuid_generate_v4(),
  church_id     uuid not null references churches(id) on delete cascade,
  member_id     uuid not null references app_users(id) on delete cascade,
  started_at    timestamptz not null default now(),
  last_message_at timestamptz not null default now(),

  -- set true the moment a crisis signal is detected; drives escalation + visibility
  flagged            boolean not null default false,
  flagged_at         timestamptz,
  flagged_reason     text,          -- short category, e.g. 'self_harm_language', 'abuse_disclosure'

  -- member can explicitly share a conversation with their pastor (opt-in, separate from flagging)
  shared_with_pastor boolean not null default false,
  shared_at          timestamptz
);

create index idx_counseling_conv_member on counseling_conversations(member_id);
create index idx_counseling_conv_church_flagged on counseling_conversations(church_id, flagged);

create table counseling_messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references counseling_conversations(id) on delete cascade,
  sender          text not null check (sender in ('member', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index idx_counseling_messages_conv on counseling_messages(conversation_id);

-- ----------------------------------------------------------------------------
-- 4. Escalation log — separate from the conversation itself, this is the
-- pastoral action record ("pastor was notified, pastor followed up")
-- ----------------------------------------------------------------------------
create table counseling_escalations (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references counseling_conversations(id) on delete cascade,
  notified_user_id uuid references app_users(id),
  notified_at     timestamptz not null default now(),
  acknowledged_at timestamptz,      -- when the pastor confirms they've seen/actioned it
  outcome_notes   text              -- private pastoral notes, not visible to the member
);

-- ----------------------------------------------------------------------------
-- 5. RLS — this is the sensitive part. Default: member-only visibility.
-- ----------------------------------------------------------------------------
alter table counseling_conversations enable row level security;
alter table counseling_messages enable row level security;
alter table counseling_escalations enable row level security;

-- Members see only their own conversations.
-- Pastors/church_admins see a conversation ONLY if it's flagged or explicitly shared.
create policy counseling_conversations_select on counseling_conversations
  for select using (
    is_super_admin()
    or member_id = auth.uid()
    or (
      church_id = current_church_id()
      and (flagged = true or shared_with_pastor = true)
      and exists (
        select 1 from app_users
        where id = auth.uid() and role in ('pastor', 'church_admin')
      )
    )
  );

create policy counseling_conversations_insert on counseling_conversations
  for insert with check (member_id = auth.uid() and church_id = current_church_id());

-- messages inherit visibility from their parent conversation
create policy counseling_messages_select on counseling_messages
  for select using (
    exists (
      select 1 from counseling_conversations c
      where c.id = conversation_id
      and (
        is_super_admin()
        or c.member_id = auth.uid()
        or (
          c.church_id = current_church_id()
          and (c.flagged = true or c.shared_with_pastor = true)
          and exists (
            select 1 from app_users
            where id = auth.uid() and role in ('pastor', 'church_admin')
          )
        )
      )
    )
  );

create policy counseling_messages_insert on counseling_messages
  for insert with check (
    exists (
      select 1 from counseling_conversations c
      where c.id = conversation_id and c.member_id = auth.uid()
    )
  );

-- escalations: pastoral-eyes-only, never visible to the member
create policy counseling_escalations_select on counseling_escalations
  for select using (
    is_super_admin()
    or exists (
      select 1 from counseling_conversations c
      join app_users u on u.id = auth.uid()
      where c.id = conversation_id
      and c.church_id = current_church_id()
      and u.role in ('pastor', 'church_admin')
    )
  );

-- ============================================================================
-- END — remember to add 'ai_counseling' to the ModuleKey union in paywall.ts
-- ============================================================================
