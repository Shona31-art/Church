-- ============================================================================
-- AI POSTER STUDIO + BIBLE READER + SUPPORT HELPDESK — schema
-- 'ai_poster' and 'bible' module keys already exist in schema.sql. Adding
-- a 'support' module here since the helpdesk wasn't in the original list.
-- ============================================================================

insert into modules (key, name, description) values
  ('support', 'Support Helpdesk', 'In-app support tickets to the platform team');

insert into plan_modules (plan_key, module_key) values
  ('free_trial', 'support'),
  ('basic', 'support'),
  ('premium', 'support'),
  ('enterprise', 'support'),
  ('sponsored', 'support');
  -- Support is available on every plan — a church that can't get help
  -- isn't a church that stays subscribed.

-- ----------------------------------------------------------------------------
-- AI POSTER STUDIO
-- Template-based design (not true AI image generation — see README for why).
-- Stores the poster's text content + styling choices, not a rendered image,
-- so it can be re-rendered/edited later. Export-to-PNG happens client-side.
-- ----------------------------------------------------------------------------
create table posters (
  id              uuid primary key default uuid_generate_v4(),
  church_id       uuid not null references churches(id) on delete cascade,
  created_by      uuid not null references app_users(id),

  event_title     text not null,
  tagline         text,
  speaker         text,
  event_date      text,        -- free text, e.g. "Sunday, 10 August · 9AM"
  location        text,

  template_key    text not null default 'classic',   -- 'classic' | 'bold' | 'minimal'
  theme_color     text not null default '#b45309',
  format          text not null default 'square',      -- 'square' | 'story' | 'print'

  created_at      timestamptz not null default now()
);

create index idx_posters_church on posters(church_id, created_at desc);

alter table posters enable row level security;

create policy posters_select on posters
  for select using (is_super_admin() or church_id = current_church_id());

create policy posters_insert on posters
  for insert with check (
    church_id = current_church_id()
    and created_by = auth.uid()
    and exists (select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor', 'department_leader'))
  );

create policy posters_delete on posters
  for delete using (
    created_by = auth.uid()
    or exists (select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor') and church_id = posters.church_id)
  );

-- ----------------------------------------------------------------------------
-- BIBLE READER
-- Verse TEXT itself is never stored here — it's fetched at read-time from a
-- public-domain-translation API (see lib/bible.ts), which keeps this app
-- clear of Bible-translation copyright/licensing entirely. Bookmarks/notes
-- store only the reference (book/chapter/verse), not the verse text.
-- ----------------------------------------------------------------------------
create table bible_bookmarks (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references app_users(id) on delete cascade,
  book          text not null,
  chapter       integer not null,
  verse         integer not null,
  created_at    timestamptz not null default now(),
  unique (user_id, book, chapter, verse)
);

alter table bible_bookmarks enable row level security;

create policy bible_bookmarks_select on bible_bookmarks for select using (user_id = auth.uid());
create policy bible_bookmarks_insert on bible_bookmarks for insert with check (user_id = auth.uid());
create policy bible_bookmarks_delete on bible_bookmarks for delete using (user_id = auth.uid());

-- Personal notes on a verse — same privacy pattern as the journal: member-only,
-- no admin bypass, ever.
create table bible_notes (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references app_users(id) on delete cascade,
  book          text not null,
  chapter       integer not null,
  verse         integer,          -- null = note on the whole chapter
  note          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_bible_notes_user on bible_notes(user_id, book, chapter);

alter table bible_notes enable row level security;

create policy bible_notes_select on bible_notes for select using (user_id = auth.uid());
create policy bible_notes_insert on bible_notes for insert with check (user_id = auth.uid());
create policy bible_notes_update on bible_notes for update using (user_id = auth.uid());
create policy bible_notes_delete on bible_notes for delete using (user_id = auth.uid());

create trigger trg_bible_notes_updated_at before update on bible_notes
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- SUPPORT HELPDESK
-- ----------------------------------------------------------------------------
create table support_tickets (
  id            uuid primary key default uuid_generate_v4(),
  church_id     uuid not null references churches(id) on delete cascade,
  created_by    uuid not null references app_users(id),

  subject       text not null,
  status        text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  priority      text not null default 'normal' check (priority in ('low', 'normal', 'high')),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_support_tickets_church on support_tickets(church_id, status);

alter table support_tickets enable row level security;

-- Creator sees their own; church_admin sees their church's; super_admin sees all
create policy support_tickets_select on support_tickets
  for select using (
    is_super_admin()
    or created_by = auth.uid()
    or (church_id = current_church_id() and exists (select 1 from app_users where id = auth.uid() and role = 'church_admin'))
  );

create policy support_tickets_insert on support_tickets
  for insert with check (church_id = current_church_id() and created_by = auth.uid());

-- Status/priority changes: creator can close their own; church_admin can
-- manage their church's; super_admin (the actual support team) can manage any.
create policy support_tickets_update on support_tickets
  for update using (
    is_super_admin()
    or created_by = auth.uid()
    or (church_id = current_church_id() and exists (select 1 from app_users where id = auth.uid() and role = 'church_admin'))
  );

create trigger trg_support_tickets_updated_at before update on support_tickets
  for each row execute function set_updated_at();

create table support_ticket_messages (
  id            uuid primary key default uuid_generate_v4(),
  ticket_id     uuid not null references support_tickets(id) on delete cascade,
  sender_id     uuid not null references app_users(id),
  content       text not null,
  attachment_url text,
  created_at    timestamptz not null default now()
);

create index idx_support_messages_ticket on support_ticket_messages(ticket_id, created_at);

alter table support_ticket_messages enable row level security;

-- Inherits visibility from the parent ticket
create policy support_messages_select on support_ticket_messages
  for select using (
    exists (
      select 1 from support_tickets t
      where t.id = ticket_id
      and (
        is_super_admin()
        or t.created_by = auth.uid()
        or (t.church_id = current_church_id() and exists (select 1 from app_users where id = auth.uid() and role = 'church_admin'))
      )
    )
  );

create policy support_messages_insert on support_ticket_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from support_tickets t
      where t.id = ticket_id
      and (
        is_super_admin()
        or t.created_by = auth.uid()
        or (t.church_id = current_church_id() and exists (select 1 from app_users where id = auth.uid() and role = 'church_admin'))
      )
    )
  );
