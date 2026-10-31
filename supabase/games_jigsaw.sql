-- ============================================================================
-- Bible jigsaw game (migration #38)
-- ============================================================================
-- In plain language:
--   1. Lets the scoreboard record the new Bible jigsaw game.
--   2. Keeps each finished game's answers, so players can open a past game
--      from "Your recent games" and see their answers again. Like the rest of
--      game_sessions, only the server reads it (members have no direct access).
--   3. Numbered levels 1–100 in every game: which level a game was played at.
-- Safe to run more than once.
-- ============================================================================
alter table bible_quiz_attempts drop constraint if exists bible_quiz_attempts_game_type_check;
alter table bible_quiz_attempts add constraint bible_quiz_attempts_game_type_check
  check (game_type in ('quiz', 'word_search', 'verse_puzzle', 'crossword', 'scramble', 'emoji', 'maze', 'verse_fill', 'who_said', 'books_order', 'jigsaw'));

alter table game_sessions add column if not exists answers jsonb;
alter table game_sessions add column if not exists stage smallint check (stage is null or stage between 1 and 100);
alter table bible_quiz_attempts add column if not exists stage smallint check (stage is null or stage between 1 and 100);
create index if not exists idx_quiz_attempts_user_stage on bible_quiz_attempts (user_id, game_type, stage) where stage is not null;
