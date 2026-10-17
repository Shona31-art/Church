-- ============================================================================
-- BIBLE READER V2 — verse highlights
--
-- Run after chat_v3.sql. Safe to re-run.
--
-- In plain language:
--   1. Members can highlight verses in one of five colours (yellow, green,
--      blue, pink, purple). One colour per verse; choosing another colour
--      replaces it. Like bookmarks and notes, a highlight stores only the
--      reference (book, chapter, verse), never the Bible text, so it applies
--      in every version.
--   2. Highlights are private to the person who made them: nobody else —
--      not pastors, church admins or the platform super admin — can see
--      them. Same rule as Bible notes and the journal.
--   3. Housekeeping on the existing tables: bookmarks get an `updated_at`
--      column (every table has one), and new notes are limited to 2,000
--      characters (existing longer notes are left alone).
--   When a member is deleted, their highlights are deleted with them (POPIA).
-- ============================================================================

-- 1. Highlights
create table if not exists bible_highlights (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references app_users(id) on delete cascade,
  book        text not null check (char_length(book) between 1 and 40),
  chapter     integer not null check (chapter between 1 and 150),
  verse       integer not null check (verse between 1 and 200),
  color       text not null check (color in ('yellow', 'green', 'blue', 'pink', 'purple')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- One highlight per verse per person. Also serves the "highlights on this
  -- chapter" lookup, since (user_id, book, chapter) is its leading prefix.
  unique (user_id, book, chapter, verse)
);

alter table bible_highlights enable row level security;

-- Owner only, no admin bypass, ever.
drop policy if exists bible_highlights_select on bible_highlights;
drop policy if exists bible_highlights_insert on bible_highlights;
drop policy if exists bible_highlights_update on bible_highlights;
drop policy if exists bible_highlights_delete on bible_highlights;
create policy bible_highlights_select on bible_highlights for select using (user_id = auth.uid());
create policy bible_highlights_insert on bible_highlights for insert with check (user_id = auth.uid());
create policy bible_highlights_update on bible_highlights for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy bible_highlights_delete on bible_highlights for delete using (user_id = auth.uid());

drop trigger if exists trg_bible_highlights_updated_at on bible_highlights;
create trigger trg_bible_highlights_updated_at before update on bible_highlights
  for each row execute function set_updated_at();

-- 2. Bookmarks: the standard updated_at column.
alter table bible_bookmarks add column if not exists updated_at timestamptz not null default now();
drop trigger if exists trg_bible_bookmarks_updated_at on bible_bookmarks;
create trigger trg_bible_bookmarks_updated_at before update on bible_bookmarks
  for each row execute function set_updated_at();

-- 3. Notes: a sensible length limit for new and edited notes. NOT VALID means
-- existing rows aren't checked, so the migration can't fail on old data.
alter table bible_notes drop constraint if exists bible_notes_note_length;
alter table bible_notes add constraint bible_notes_note_length check (char_length(note) between 1 and 2000) not valid;
