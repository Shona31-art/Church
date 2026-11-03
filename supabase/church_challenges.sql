-- ============================================================================
-- Whole-church Bible challenges (migration #57). Run after game_duels.sql.
-- ============================================================================
-- In plain language: a pastor or church admin starts a challenge — a title,
-- a level, 10/20/30 questions, and how long it's open. Everyone in the church
-- is notified and plays the same questions against the clock (once each). A
-- live leaderboard ranks everyone: most right answers, then quickest. When it
-- closes, everyone who played is told who won and where they came.
--
-- Everyone in the church can see the challenge and the leaderboard (names,
-- scores, times). The right answers and people's picks stay on the server
-- until the challenge has closed. Safe to run more than once.
-- ============================================================================

create table if not exists church_challenges (
  id            uuid primary key default uuid_generate_v4(),
  church_id     uuid not null references churches(id) on delete cascade,
  created_by    uuid references app_users(id) on delete set null,
  title         text not null check (char_length(title) between 1 and 80),
  level         text not null check (level in ('easy', 'medium', 'hard')),
  questions     jsonb not null,               -- questions and choices, never the answers
  starts_at     timestamptz not null default now(),
  ends_at       timestamptz not null,
  announced_at  timestamptz,                  -- results sent to everyone who played
  created_at    timestamptz not null default now(),
  constraint church_challenges_window check (ends_at > starts_at)
);
create index if not exists idx_church_challenges_church on church_challenges(church_id, ends_at desc);
alter table church_challenges enable row level security;
drop policy if exists church_challenges_select on church_challenges;
create policy church_challenges_select on church_challenges for select using (church_id = current_church_id());

-- The answer key (server only).
create table if not exists church_challenge_keys (
  challenge_id uuid primary key references church_challenges(id) on delete cascade,
  correct      integer[] not null
);
alter table church_challenge_keys enable row level security;

-- One row per player: the leaderboard.
create table if not exists church_challenge_entries (
  challenge_id uuid not null references church_challenges(id) on delete cascade,
  user_id      uuid not null references app_users(id) on delete cascade,
  church_id    uuid not null references churches(id) on delete cascade,
  started_at   timestamptz not null default now(),
  done         integer not null default 0,
  score        integer not null default 0,
  ms           integer not null default 0,
  finished_at  timestamptz,
  primary key (challenge_id, user_id)
);
create index if not exists idx_church_challenge_entries_board on church_challenge_entries(challenge_id, score desc, ms);
alter table church_challenge_entries enable row level security;
drop policy if exists church_challenge_entries_select on church_challenge_entries;
create policy church_challenge_entries_select on church_challenge_entries for select using (church_id = current_church_id());

-- Each answer (server only).
create table if not exists church_challenge_answers (
  challenge_id uuid not null references church_challenges(id) on delete cascade,
  user_id      uuid not null references app_users(id) on delete cascade,
  idx          integer not null check (idx between 0 and 49),
  choice       integer not null check (choice between -1 and 3),
  correct      boolean not null,
  ms           integer not null check (ms >= 0),
  answered_at  timestamptz not null default now(),
  primary key (challenge_id, user_id, idx)
);
alter table church_challenge_answers enable row level security;

-- Tell the whole church a challenge has started.
create or replace function app_private.on_church_challenge()
returns trigger as $$
declare
  host text;
begin
  select name into host from app_users where id = new.created_by;
  perform app_private.notify(
    array(select id from app_users where church_id = new.church_id and status = 'active'),
    new.church_id, 'church_news', 'game.challenge',
    '⛪ Church challenge: ' || new.title,
    coalesce(host, 'Your church') || ' challenges everyone — ' || jsonb_array_length(new.questions) || ' ' || new.level || ' questions. Can you top the leaderboard?',
    '/dashboard/games/challenge/' || new.id,
    new.created_by
  );
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_church_challenge on church_challenges;
create trigger trg_church_challenge after insert on church_challenges
  for each row execute function app_private.on_church_challenge();

revoke all on all functions in schema app_private from public;

-- Live leaderboard (Realtime applies the select rule above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'church_challenge_entries') then
    alter publication supabase_realtime add table public.church_challenge_entries;
  end if;
end $$;

select freeze_church_id_on('church_challenges');
select freeze_church_id_on('church_challenge_entries');
