-- ============================================================================
-- SERMONS MODULE
-- ============================================================================

create table sermons (
  id                    uuid primary key default uuid_generate_v4(),
  church_id             uuid not null references churches(id) on delete cascade,
  created_by            uuid not null references app_users(id),

  title                 text not null,
  speaker               text,
  sermon_date           date not null default current_date,
  audio_url             text,
  video_url             text,
  transcript            text,

  ai_summary            text,
  scripture_refs        text[],
  discussion_questions  text[],
  prayer_points         text[],

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_sermons_church_date on sermons(church_id, sermon_date desc);

alter table sermons enable row level security;

create policy sermons_select on sermons
  for select using (is_super_admin() or church_id = current_church_id());

create policy sermons_insert on sermons
  for insert with check (
    church_id = current_church_id()
    and created_by = auth.uid()
    and exists (select 1 from app_users where id = auth.uid() and role in ('pastor', 'church_admin'))
  );

create policy sermons_update on sermons
  for update using (
    created_by = auth.uid()
    or exists (select 1 from app_users where id = auth.uid() and role in ('pastor', 'church_admin') and church_id = sermons.church_id)
  );

create policy sermons_delete on sermons
  for delete using (
    exists (select 1 from app_users where id = auth.uid() and role in ('pastor', 'church_admin') and church_id = sermons.church_id)
  );

create trigger trg_sermons_updated_at before update on sermons
  for each row execute function set_updated_at();

-- Personal sermon notes — private to the member who wrote them, same
-- pattern as the journal (member-only, no admin bypass).
create table sermon_notes (
  id            uuid primary key default uuid_generate_v4(),
  sermon_id     uuid not null references sermons(id) on delete cascade,
  user_id       uuid not null references app_users(id) on delete cascade,
  note          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_sermon_notes_user on sermon_notes(user_id, sermon_id);

alter table sermon_notes enable row level security;

create policy sermon_notes_select on sermon_notes
  for select using (user_id = auth.uid());

create policy sermon_notes_insert on sermon_notes
  for insert with check (user_id = auth.uid());

create policy sermon_notes_update on sermon_notes
  for update using (user_id = auth.uid());

create policy sermon_notes_delete on sermon_notes
  for delete using (user_id = auth.uid());

create trigger trg_sermon_notes_updated_at before update on sermon_notes
  for each row execute function set_updated_at();
