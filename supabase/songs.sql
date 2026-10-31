-- ============================================================================
-- Songs (migration #36)
-- ============================================================================
-- In plain language:
--   1. Each church keeps its own song list: title, optional writer and key,
--      and the lyrics.
--   2. Everyone in the church can browse the songs and read the lyrics.
--   3. Pastors, church admins and the worship team can add, change and delete
--      songs. "Worship team" is the department a pastor or church admin picks
--      in the songs settings — everyone in it (members and leaders).
--   4. A song title can only be used once per church, so imports can't
--      create duplicates.
--
-- Safe to run more than once.
-- ============================================================================

create table if not exists church_song_settings (
  church_id              uuid primary key references churches(id) on delete cascade,
  worship_department_id  uuid references departments(id) on delete set null,
  updated_at             timestamptz not null default now()
);
alter table church_song_settings enable row level security;

drop policy if exists church_song_settings_select on church_song_settings;
create policy church_song_settings_select on church_song_settings
  for select using (is_super_admin() or church_id = current_church_id());

drop policy if exists church_song_settings_write on church_song_settings;
create policy church_song_settings_write on church_song_settings
  for all using (is_church_shepherd(church_id)) with check (is_church_shepherd(church_id));

-- Who may add, change or delete songs in a church.
create or replace function can_manage_songs(target_church uuid)
returns boolean as $$
  select exists (
    select 1 from app_users u
    where u.id = auth.uid()
      and u.church_id = target_church
      and u.status <> 'disabled'
      and (
        u.role in ('pastor', 'church_admin')
        or (u.department_id is not null and u.department_id = (
          select s.worship_department_id from church_song_settings s where s.church_id = target_church
        ))
      )
  );
$$ language sql stable security definer set search_path = public;

create table if not exists songs (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references churches(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  author      text check (author is null or char_length(author) <= 200),
  song_key    text check (song_key is null or char_length(song_key) <= 12),
  lyrics      text not null default '' check (char_length(lyrics) <= 20000),
  created_by  uuid references app_users(id) on delete set null,
  updated_by  uuid references app_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists songs_church_title_unique on songs (church_id, lower(btrim(title)));
create index if not exists idx_songs_church_title on songs (church_id, title);

drop trigger if exists trg_songs_updated_at on songs;
create trigger trg_songs_updated_at before update on songs
  for each row execute function set_updated_at();

alter table songs enable row level security;

drop policy if exists songs_select on songs;
create policy songs_select on songs
  for select using (is_super_admin() or church_id = current_church_id());

drop policy if exists songs_insert on songs;
create policy songs_insert on songs
  for insert with check (can_manage_songs(church_id));

drop policy if exists songs_update on songs;
create policy songs_update on songs
  for update using (can_manage_songs(church_id)) with check (can_manage_songs(church_id));

drop policy if exists songs_delete on songs;
create policy songs_delete on songs
  for delete using (can_manage_songs(church_id));
