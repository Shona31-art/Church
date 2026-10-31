-- ============================================================================
-- Jigsaw pictures (migration #39)
-- ============================================================================
-- In plain language:
--   1. Each church can have its own pictures for the Bible jigsaw: painted by
--      AI from a Bible story, or uploaded (e.g. church photos or licensed art).
--   2. Everyone in the church plays them; pastors and church admins add and
--      remove them.
--   3. The image files live in a private "jigsaw-pictures" bucket that only
--      the server touches; players get short-lived links.
--   Until a church adds pictures, the jigsaw uses its built-in drawings.
--
-- Safe to run more than once.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jigsaw-pictures', 'jigsaw-pictures', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists jigsaw_pictures (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references churches(id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 1 and 120),
  reference     text check (reference is null or char_length(reference) <= 60),
  storage_path  text not null check (storage_path like church_id::text || '/%'),
  source        text not null default 'upload' check (source in ('ai', 'upload')),
  created_by    uuid references app_users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_jigsaw_pictures_church on jigsaw_pictures (church_id, created_at);

alter table jigsaw_pictures enable row level security;

drop policy if exists jigsaw_pictures_select on jigsaw_pictures;
create policy jigsaw_pictures_select on jigsaw_pictures
  for select using (is_super_admin() or church_id = current_church_id());

drop policy if exists jigsaw_pictures_insert on jigsaw_pictures;
create policy jigsaw_pictures_insert on jigsaw_pictures
  for insert with check (is_church_shepherd(church_id));

drop policy if exists jigsaw_pictures_delete on jigsaw_pictures;
create policy jigsaw_pictures_delete on jigsaw_pictures
  for delete using (is_church_shepherd(church_id));
