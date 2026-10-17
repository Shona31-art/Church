-- ============================================================================
-- POSTER EDITOR — Poster Studio v2
--
-- Run after notifications.sql. Safe to re-run.
-- Decision record: docs/adr/0003-poster-editor.md
--
-- In plain language:
--   1. Posters can now hold an editable design (text boxes, photos, shapes)
--      instead of only the three old fixed layouts. Old posters keep working.
--      A design is limited in size so nobody can store something huge.
--   2. `poster_assets` lists each church's uploaded poster photos and logos
--      (e.g. speaker photos) so they can be reused. Only the church's poster
--      makers (department leaders, pastors, church admins) see the library.
--      Uploaders can delete their own; pastors and admins can delete any.
--   3. A private `poster-assets` storage bucket holds those photos and the
--      small previews shown in the posters list. Nobody can read or write it
--      directly from the browser: the app's server checks who's asking, then
--      hands out short-lived links. That way a member can see a finished
--      poster's photos without being able to browse the photo library.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Posters: editable designs
-- ----------------------------------------------------------------------------
alter table posters add column if not exists title text;
alter table posters add column if not exists design jsonb;
alter table posters add column if not exists design_version integer;
alter table posters add column if not exists width integer;
alter table posters add column if not exists height integer;
alter table posters add column if not exists thumbnail_path text;

alter table posters drop constraint if exists posters_design_shape;
alter table posters add constraint posters_design_shape check (
  design is null
  or (
    jsonb_typeof(design) = 'object'
    and octet_length(design::text) <= 200000           -- ~200 KB: far more than a real poster needs
    and design_version is not null
    and width between 100 and 5000
    and height between 100 and 5000
  )
);

alter table posters drop constraint if exists posters_title_length;
alter table posters add constraint posters_title_length check (title is null or char_length(title) between 1 and 120);

-- The preview must live in this church's folder of the bucket.
alter table posters drop constraint if exists posters_thumbnail_path;
alter table posters add constraint posters_thumbnail_path check (
  thumbnail_path is null or thumbnail_path like church_id::text || '/thumbs/%'
);

-- ----------------------------------------------------------------------------
-- 2. Who makes posters (same roles as Poster Studio has always had)
-- ----------------------------------------------------------------------------
create or replace function is_poster_maker(target_church uuid)
returns boolean as $$
  select exists (
    select 1 from app_users
    where id = auth.uid()
      and church_id = target_church
      and role in ('church_admin', 'pastor', 'department_leader')
      and status <> 'disabled'
  );
$$ language sql stable security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 3. The church's poster photo library
-- ----------------------------------------------------------------------------
create table if not exists poster_assets (
  id            uuid primary key default uuid_generate_v4(),
  church_id     uuid not null references churches(id) on delete cascade,
  uploaded_by   uuid references app_users(id) on delete set null,
  -- <church_id>/<uploader_id>/<random>.<ext> in the poster-assets bucket
  storage_path  text not null unique,
  kind          text not null default 'photo' check (kind in ('photo', 'logo')),
  label         text check (label is null or char_length(label) <= 120),
  width         integer not null check (width between 1 and 10000),
  height        integer not null check (height between 1 and 10000),
  bytes         integer not null check (bytes between 1 and 5242880),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint poster_assets_path_in_church check (storage_path like church_id::text || '/%')
);
create index if not exists idx_poster_assets_church on poster_assets(church_id, created_at desc);
create index if not exists idx_poster_assets_uploader on poster_assets(uploaded_by);

drop trigger if exists trg_poster_assets_updated_at on poster_assets;
create trigger trg_poster_assets_updated_at before update on poster_assets
  for each row execute function set_updated_at();

alter table poster_assets enable row level security;

drop policy if exists poster_assets_select on poster_assets;
drop policy if exists poster_assets_insert on poster_assets;
drop policy if exists poster_assets_update on poster_assets;
drop policy if exists poster_assets_delete on poster_assets;

create policy poster_assets_select on poster_assets
  for select using (church_id = current_church_id() and is_poster_maker(church_id));

-- Recorded by the uploader, in their own church and their own folder.
create policy poster_assets_insert on poster_assets
  for insert with check (
    church_id = current_church_id()
    and uploaded_by = auth.uid()
    and is_poster_maker(church_id)
    and storage_path like church_id::text || '/' || auth.uid()::text || '/%'
  );

-- Only the label can usefully change; same people who can delete.
create policy poster_assets_update on poster_assets
  for update using (church_id = current_church_id() and (uploaded_by = auth.uid() or is_church_shepherd(church_id)))
  with check (church_id = current_church_id());

create policy poster_assets_delete on poster_assets
  for delete using (church_id = current_church_id() and (uploaded_by = auth.uid() or is_church_shepherd(church_id)));

-- Nobody can move a photo to another church or rewrite where it's stored.
create or replace function poster_assets_freeze()
returns trigger as $$
begin
  if new.church_id is distinct from old.church_id
     or new.storage_path is distinct from old.storage_path
     or new.uploaded_by is distinct from old.uploaded_by then
    raise exception 'A poster photo''s church, owner and file can''t be changed';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_poster_assets_freeze on poster_assets;
create trigger trg_poster_assets_freeze before update on poster_assets
  for each row execute function poster_assets_freeze();

-- ----------------------------------------------------------------------------
-- 4. Storage bucket (private; no browser policies on purpose — the server
--    signs every upload and download after its own checks)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('poster-assets', 'poster-assets', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
