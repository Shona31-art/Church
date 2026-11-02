-- ============================================================================
-- Spot the difference game (migration #45). Run after member_children.sql.
-- ============================================================================
-- In plain language: lets the scoreboard record the new "Spot the difference"
-- Bible game. Nothing else changes. Safe to run more than once.
-- ============================================================================
alter table bible_quiz_attempts drop constraint if exists bible_quiz_attempts_game_type_check;
alter table bible_quiz_attempts add constraint bible_quiz_attempts_game_type_check
  check (game_type in ('quiz', 'word_search', 'verse_puzzle', 'crossword', 'scramble', 'emoji', 'maze', 'verse_fill', 'who_said', 'books_order', 'jigsaw', 'differences'));
