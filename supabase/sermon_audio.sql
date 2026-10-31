-- ============================================================================
-- Sermon audio uploads (migration #40)
-- ============================================================================
-- In plain language: pastors and church admins (whoever can add sermons) can
-- upload a sermon recording from their phone. Files go in a "sermon-audio"
-- bucket; the app hands out one-time upload links only after checking who is
-- asking, so nobody can upload directly. Anyone with a sermon's link can play
-- it (sermons are meant to be shared). Up to 50 MB per file — about an hour
-- of speech as MP3/M4A. Safe to run more than once.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sermon-audio', 'sermon-audio', true, 52428800,
  array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/opus']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
