-- ============================================================================
-- Sermon video uploads (migration #46). Run after games_differences.sql.
-- ============================================================================
-- In plain language: like sermon audio (#40), pastors and church admins
-- (whoever can add sermons) can upload a sermon video from their phone or
-- computer. Files go in a "sermon-video" bucket; the app hands out one-time
-- upload links only after checking who is asking, so nobody can upload
-- directly. Anyone with a sermon's link can watch it (sermons are meant to be
-- shared). MP4, MOV, M4V or WebM, up to 1 GB per file.
--
-- IMPORTANT: Supabase also has a project-wide upload limit (Storage →
-- Settings → "Upload file size limit"), which is 50 MB on the Free plan.
-- Files over that limit are refused whatever this bucket allows, so raise it
-- (Pro plan) to the size of video you expect, e.g. 1 GB.
-- Safe to run more than once.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sermon-video', 'sermon-video', true, 1073741824,
  array['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
