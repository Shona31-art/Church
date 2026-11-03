-- ============================================================================
-- Bible Quiz Duels (migration #56). Run after calls_v5.sql.
-- ============================================================================
-- In plain language: challenge someone in your church to a Bible quiz. You
-- both get the same questions (10, 20 or 30 — the challenger chooses), answered against a timer; most right
-- answers wins, and if that's a tie, the quicker player wins. Play at the
-- same time (you see each other's progress live) or one after the other
-- within two days.
--
-- Only the two players can see a duel. Nobody — not even the players — can
-- read the right answers or the other player's picks until the duel is over:
-- they're kept in server-only tables, and every answer is checked by the
-- server. Safe to run more than once.
-- ============================================================================

create table if not exists game_duels (
  id                    uuid primary key default uuid_generate_v4(),
  church_id             uuid not null references churches(id) on delete cascade,
  challenger_id         uuid not null references app_users(id) on delete cascade,
  opponent_id           uuid not null references app_users(id) on delete cascade,
  level                 text not null check (level in ('easy', 'medium', 'hard')),
  -- pending: waiting for the opponent to accept · active · finished · declined · cancelled
  status                text not null default 'pending' check (status in ('pending', 'active', 'finished', 'declined', 'cancelled')),
  -- The questions and their choices (never the answers).
  questions             jsonb not null,
  -- How far each player has got (questions answered), for the live progress bar.
  challenger_done       integer not null default 0,
  opponent_done         integer not null default 0,
  challenger_started_at timestamptz,
  opponent_started_at   timestamptz,
  challenger_finished_at timestamptz,
  opponent_finished_at  timestamptz,
  -- Filled in when the duel is over.
  challenger_score      integer,
  opponent_score        integer,
  challenger_ms         integer,
  opponent_ms           integer,
  winner_id             uuid references app_users(id) on delete set null,
  created_at            timestamptz not null default now(),
  expires_at            timestamptz not null default now() + interval '48 hours',
  finished_at           timestamptz,
  constraint game_duels_two_people check (challenger_id <> opponent_id)
);
create index if not exists idx_game_duels_challenger on game_duels(challenger_id, created_at desc);
create index if not exists idx_game_duels_opponent on game_duels(opponent_id, created_at desc);

alter table game_duels enable row level security;
drop policy if exists game_duels_select on game_duels;
create policy game_duels_select on game_duels
  for select using (church_id = current_church_id() and (select auth.uid()) in (challenger_id, opponent_id));
-- No insert/update/delete policies: only the server writes.

-- The answer key (server only: no policies at all).
create table if not exists game_duel_keys (
  duel_id   uuid primary key references game_duels(id) on delete cascade,
  correct   integer[] not null
);
alter table game_duel_keys enable row level security;

-- Each answer, with how long it took (server only until the duel is over).
create table if not exists game_duel_answers (
  duel_id     uuid not null references game_duels(id) on delete cascade,
  user_id     uuid not null references app_users(id) on delete cascade,
  idx         integer not null check (idx between 0 and 49),
  choice      integer not null check (choice between -1 and 3), -- -1: ran out of time
  correct     boolean not null,
  ms          integer not null check (ms >= 0),
  answered_at timestamptz not null default now(),
  primary key (duel_id, user_id, idx)
);
alter table game_duel_answers enable row level security;

-- Notifications: the challenge, the answer to it, and the result.
create or replace function app_private.on_game_duel()
returns trigger as $$
declare
  challenger text;
  opponent text;
  link text := '/dashboard/games/duel/' || new.id;
begin
  select name into challenger from app_users where id = new.challenger_id;
  select name into opponent from app_users where id = new.opponent_id;
  if tg_op = 'INSERT' then
    perform app_private.notify(array[new.opponent_id], new.church_id, 'messages', 'game.duel',
      coalesce(challenger, 'Someone') || ' challenged you to a Bible duel ⚔️',
      initcap(new.level) || ' quiz, ' || jsonb_array_length(new.questions) || ' questions. Tap to accept.', link, new.challenger_id);
  elsif new.status is distinct from old.status then
    if new.status = 'active' then
      perform app_private.notify(array[new.challenger_id], new.church_id, 'messages', 'game.duel',
        coalesce(opponent, 'They') || ' accepted your Bible duel', 'Tap to see how they''re doing.', link, new.opponent_id);
    elsif new.status = 'declined' then
      perform app_private.notify(array[new.challenger_id], new.church_id, 'messages', 'game.duel',
        coalesce(opponent, 'They') || ' declined your Bible duel', 'Challenge someone else?', '/dashboard/games/duel', new.opponent_id);
    elsif new.status = 'finished' then
      perform app_private.notify(array[new.challenger_id, new.opponent_id], new.church_id, 'messages', 'game.duel',
        case when new.winner_id is null then 'Bible duel: it''s a draw!'
             when new.winner_id = new.challenger_id then coalesce(challenger, 'Challenger') || ' won the Bible duel 🏆'
             else coalesce(opponent, 'Opponent') || ' won the Bible duel 🏆' end,
        coalesce(challenger, 'Challenger') || ' ' || coalesce(new.challenger_score, 0) || ' – ' || coalesce(new.opponent_score, 0) || ' ' || coalesce(opponent, 'Opponent'),
        link, null);
    end if;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_game_duel on game_duels;
create trigger trg_game_duel after insert or update of status on game_duels
  for each row execute function app_private.on_game_duel();

revoke all on all functions in schema app_private from public;

-- Live progress for both players (Realtime applies the select rule above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_duels') then
    alter publication supabase_realtime add table public.game_duels;
  end if;
end $$;

select freeze_church_id_on('game_duels');
