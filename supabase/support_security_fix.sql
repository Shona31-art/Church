-- ============================================================================
-- SUPPORT DESK ATTACHMENTS — security fix (run after booking_security_fix.sql)
--
-- What this changes, in plain language:
--   1. Messages store the attachment's storage PATH (attachment_path), not a
--      free-text URL. Before, the browser sent any URL it liked, so a ticket
--      could embed an image from an attacker's server (a tracking pixel that
--      reveals support staff's IP addresses). Existing Supabase-hosted
--      attachments are copied across automatically; anything else is ignored.
--   2. Uploads must go into the uploader's own folder ("<user id>/...").
--      Before, anyone signed in could write anywhere in the bucket.
--   3. A message can only reference a file in the sender's own folder, so
--      nobody can attach someone else's screenshot to gain access to it.
--   4. Reading a file (needed for signed links) is limited to its uploader
--      and the people who can see the ticket it's attached to.
--   5. The bucket only accepts PNG/JPEG/WebP/GIF up to 5 MB. SVG is excluded
--      on purpose: it can carry scripts.
--
-- NOT changed here: whether the bucket is public. While it stays public,
-- anyone holding a file's link can still open it. Making it private is a
-- one-line change (bottom of this file) — the app already uses signed links,
-- so nothing breaks when you flip it.
--
-- attachment_url is kept (not dropped) so no data is lost; the app no longer
-- reads or writes it.
--
-- Safe to re-run.
-- ============================================================================

-- 1. Store paths, not URLs.
alter table support_ticket_messages add column if not exists attachment_path text;

update support_ticket_messages
set attachment_path = substring(attachment_url from '/storage/v1/object/public/attachments/(.+)$')
where attachment_path is null and attachment_url is not null;

-- 3. Messages may only reference the sender's own uploads.
drop policy if exists support_messages_insert on support_ticket_messages;
create policy support_messages_insert on support_ticket_messages
  for insert with check (
    sender_id = auth.uid()
    and (attachment_path is null or split_part(attachment_path, '/', 1) = auth.uid()::text)
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

-- 2. Uploads only into your own folder.
drop policy if exists "authenticated users can upload attachments" on storage.objects;
drop policy if exists "attachments upload into own folder" on storage.objects;
create policy "attachments upload into own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Read access: your own folder, or a file on a ticket message you can see
-- (the subquery runs under support_ticket_messages' own RLS).
drop policy if exists "anyone can view attachments" on storage.objects;
drop policy if exists "attachments readable by ticket participants" on storage.objects;
create policy "attachments readable by ticket participants"
on storage.objects for select
to authenticated
using (
  bucket_id = 'attachments'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.support_ticket_messages m where m.attachment_path = storage.objects.name)
  )
);

-- 5. Size and type limits, enforced by Supabase Storage itself. Creates the
-- bucket if the manual dashboard step was skipped; never changes `public`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- To make attachments private (recommended — support screenshots can contain
-- personal information), run this once the app update is deployed:
--   update storage.buckets set public = false where id = 'attachments';
