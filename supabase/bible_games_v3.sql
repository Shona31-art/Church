-- ============================================================================
-- BIBLE GAMES V3 — levels, server-checked scores, and room for new games
--
-- Run after plan_basic_v2.sql. Safe to re-run.
--
-- In plain language:
--   1. game_sessions: one row per game played. The server creates it when a
--      game starts (with the puzzle and its answers), times it, and marks the
--      answers when it finishes. Members can't read or write this table at
--      all — so the answers can't be looked up and a score can't be faked.
--   2. bible_quiz_attempts (the scoreboard) gains points, level, mode, time
--      and a link to its session. Members can no longer write scores
--      directly; only the server does, after checking the answers. Existing
--      scores are kept and still count.
--   3. New game types are allowed (crossword, scramble, emoji, maze, …) so
--      later games don't need another migration to be scored.
--   4. Two tables for later steps: a shared content bank for the new games,
--      and earned badges. Created now, empty.
-- ============================================================================

-- 1. Game sessions (server only)
create table if not exists game_sessions (
  id           uuid primary key default uuid_generate_v4(),
  church_id    uuid not null references churches(id) on delete cascade,
  user_id      uuid not null references app_users(id) on delete cascade,
  game_type    text not null,
  level        text not null check (level in ('easy', 'medium', 'hard')),
  mode         text not null default 'practice' check (mode in ('practice', 'daily', 'kids')),
  timed        boolean not null default false,
  seed         bigint not null,
  puzzle       jsonb not null,               -- includes the answer key: never sent to members
  progress     jsonb not null default '{}',  -- e.g. quiz choices, locked in as they're made
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  correct      integer,
  max_correct  integer,
  points       integer,
  duration_ms  integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_game_sessions_user on game_sessions(user_id, started_at desc);
create index if not exists idx_game_sessions_church_daily on game_sessions(church_id, mode, started_at) where mode = 'daily';

-- RLS on with no policies: only trusted server code (service role) can touch it.
alter table game_sessions enable row level security;

drop trigger if exists trg_game_sessions_updated_at on game_sessions;
create trigger trg_game_sessions_updated_at before update on game_sessions
  for each row execute function set_updated_at();

-- 2. Scoreboard rows
alter table bible_quiz_attempts add column if not exists points integer;
alter table bible_quiz_attempts add column if not exists level text;
alter table bible_quiz_attempts add column if not exists mode text not null default 'practice';
alter table bible_quiz_attempts add column if not exists duration_ms integer;
alter table bible_quiz_attempts add column if not exists session_id uuid references game_sessions(id) on delete set null;

create unique index if not exists idx_quiz_attempts_session on bible_quiz_attempts(session_id) where session_id is not null;

-- 3. Every game type the engine knows (current and planned).
alter table bible_quiz_attempts drop constraint if exists bible_quiz_attempts_game_type_check;
alter table bible_quiz_attempts add constraint bible_quiz_attempts_game_type_check
  check (game_type in ('quiz', 'word_search', 'verse_puzzle', 'crossword', 'scramble', 'emoji', 'maze', 'verse_fill', 'who_said', 'books_order'));

-- Members could insert their own scores before; now only the server can,
-- after checking the answers against the session.
drop policy if exists bible_quiz_attempts_insert on bible_quiz_attempts;

-- 4a. Shared content bank for the new games (filled in a later step).
create table if not exists bible_game_content (
  id          uuid primary key default uuid_generate_v4(),
  type        text not null check (type in ('emoji', 'crossword_clue', 'scramble_word', 'quote', 'verse')),
  difficulty  text not null check (difficulty in ('easy', 'medium', 'hard')),
  kids_ok     boolean not null default false,
  payload     jsonb not null,
  reference   text not null,            -- Bible reference, so a pastor can check every item
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_bible_game_content_type on bible_game_content(type, difficulty);
alter table bible_game_content enable row level security;

drop policy if exists bible_game_content_read on bible_game_content;
create policy bible_game_content_read on bible_game_content for select using (auth.uid() is not null);
drop policy if exists bible_game_content_write on bible_game_content;
create policy bible_game_content_write on bible_game_content for all using (is_super_admin()) with check (is_super_admin());

drop trigger if exists trg_bible_game_content_updated_at on bible_game_content;
create trigger trg_bible_game_content_updated_at before update on bible_game_content
  for each row execute function set_updated_at();

alter table bible_quiz_questions add column if not exists kids_ok boolean not null default false;

-- 4b. Badges (awarded by the server only; visible within the church).
create table if not exists user_badges (
  user_id     uuid not null references app_users(id) on delete cascade,
  church_id   uuid not null references churches(id) on delete cascade,
  badge_key   text not null,
  awarded_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, badge_key)
);
alter table user_badges enable row level security;
drop policy if exists user_badges_select on user_badges;
create policy user_badges_select on user_badges for select using (church_id = current_church_id());

select freeze_church_id_on('game_sessions');
select freeze_church_id_on('user_badges');
