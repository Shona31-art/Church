-- ============================================================================
-- Church logo uploads (migration #35)
-- ============================================================================
-- Church admins upload their church's logo from Church settings → Church
-- profile. It shows in the app header (instead of the initials) and on
-- posters, and the file's public link is saved in churches.logo_url (that
-- column already exists).
--
-- Path:  church-logos/<church_id>/<random uuid>.<webp|jpg|png>
--
-- The bucket is public: a logo is public information (it's on the church's
-- posters and signboard), and public links cache well on phones. Only a
-- church admin of that church can add or remove files in its folder.
-- Uploads always use a new random name, so there's no UPDATE policy.
--
-- Safe to run more than once.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('church-logos', 'church-logos', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Logos are public anyway; the storage service also reads back what it uploads.
drop policy if exists church_logos_select on storage.objects;
create policy church_logos_select on storage.objects for select to authenticated, anon using (
  bucket_id = 'church-logos'
);

drop policy if exists church_logos_insert on storage.objects;
create policy church_logos_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'church-logos'
  and (storage.foldername(name))[1] = current_church_id()::text
  and is_church_admin(current_church_id())
);

drop policy if exists church_logos_delete on storage.objects;
create policy church_logos_delete on storage.objects for delete to authenticated using (
  bucket_id = 'church-logos'
  and (storage.foldername(name))[1] = current_church_id()::text
  and is_church_admin(current_church_id())
);
