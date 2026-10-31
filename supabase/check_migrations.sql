-- ============================================================================
-- Which database updates have been run?  (read-only — changes nothing)
--
-- Paste into Supabase → SQL Editor → Run. Each row is one file from the
-- README's "Database setup" list. Any row saying MISSING: run that file next
-- (in the README's order), then run this check again.
-- ============================================================================
select n as "#", file, case when ok then 'ok' else 'MISSING — run this file' end as status
from (values
  (22, 'chat_v2.sql',              exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'app_users' and column_name = 'avatar_path')),
  (23, 'plan_basic_v2.sql',        exists (select 1 from public.modules where key = 'ai_assist')),
  (24, 'bible_games_v3.sql',       to_regclass('public.game_sessions') is not null),
  (25, 'bible_games_content.sql',  (select count(*) from public.bible_quiz_questions) >= 150),
  (26, 'chat_v3.sql',              exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chat_member_settings' and column_name = 'hidden_at')),
  (27, 'bible_reader_v2.sql',      to_regclass('public.bible_highlights') is not null),
  (28, 'notifications.sql',        to_regclass('public.notifications') is not null),
  (29, 'poster_editor.sql',        to_regclass('public.poster_assets') is not null),
  (30, 'eft_giving.sql',           to_regclass('public.church_giving_details') is not null),
  (31, 'paystack_card_giving.sql', to_regclass('public.church_card_giving') is not null),
  (32, 'church_move.sql',          exists (select 1 from pg_trigger where tgname = 'trg_member_church_changed')),
  (33, 'email_sync.sql',           exists (select 1 from pg_trigger where tgname = 'trg_sync_app_user_email')),
  (34, 'paystack_billing.sql',     to_regclass('public.billing_payments') is not null),
  (35, 'church_logo.sql',          exists (select 1 from storage.buckets where id = 'church-logos')),
  (36, 'songs.sql',                to_regclass('public.songs') is not null),
  (37, 'counseling_delete.sql',    exists (select 1 from pg_policies where tablename = 'counseling_conversations' and policyname = 'counseling_conversations_delete_own')),
  (38, 'games_jigsaw.sql',         exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'game_sessions' and column_name = 'answers')),
  (39, 'jigsaw_pictures.sql',      to_regclass('public.jigsaw_pictures') is not null)
) as t(n, file, ok)
order by n;
