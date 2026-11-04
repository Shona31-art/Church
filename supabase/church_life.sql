-- ============================================================================
-- Church life (migration #60). Run after billing_v4.sql. Safe to re-run.
-- ============================================================================
-- In plain language, eight new parts of the app:
--   1. Live Sunday      — the livestream link (YouTube/Facebook) with the order
--                         of service, song lyrics and sermon notes beside it.
--   2. Sermon notes     — fill-in-the-blank notes for the sermon; members fill
--                         them in and keep them in their (encrypted) journal.
--   3. Testimonies      — members share what God has done; a pastor approves
--                         each one before anyone else sees it.
--   4. Reading plans    — Bible reading plans with streaks; pastors start
--                         church-wide ones ("the whole church reads John").
--   5. Prayer chain     — members book prayer slots (e.g. 24 hours a day for a
--                         fast); each gets a reminder before their slot.
--   6. Volunteer rosters— teams (ushers, worship, sound, kids' church), who is
--                         on duty when, a reminder the day before, and swaps.
--   7. Certificates     — baptism, baby dedication, membership and course
--                         certificates with the church logo, printable.
--   8. Monday report    — a weekly email to pastors and admins (server-only
--                         log of what was sent).
-- Plans: Basic gets 1–5 (everyday member features); Premium and up get all.
-- Prices: Basic R250, Premium R500, Unlimited R1,000 a month (section 10).
-- Reminders run every 10 minutes with pg_cron when it's available (Supabase:
-- it is), and from the app's nightly job as a back-up.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Plan switches
-- ---------------------------------------------------------------------------
insert into modules (key, name, description) values
  ('live_sunday',   'Live Sunday',       'Livestream with the order of service, lyrics and sermon notes'),
  ('sermon_notes',  'Sermon notes',      'Fill-in-the-blank sermon notes members keep in their journal'),
  ('testimonies',   'Testimonies',       'Testimonies wall, approved by a pastor'),
  ('reading_plans', 'Reading plans',     'Bible reading plans with streaks, personal and church-wide'),
  ('prayer_chain',  'Prayer chain',      'Book prayer slots for fasts and revival weeks, with reminders'),
  ('rosters',       'Volunteer rosters', 'Teams, duties, reminders and swaps'),
  ('certificates',  'Certificates',      'Baptism, dedication, membership and course certificates'),
  ('weekly_report', 'Monday report',     'Weekly email summary for pastors and admins')
on conflict (key) do nothing;

insert into plan_modules (plan_key, module_key)
select p::plan_key, m from unnest(array['free_trial', 'premium', 'enterprise', 'sponsored']) p,
  unnest(array['live_sunday', 'sermon_notes', 'testimonies', 'reading_plans', 'prayer_chain', 'rosters', 'certificates', 'weekly_report']) m
on conflict do nothing;
insert into plan_modules (plan_key, module_key)
select 'basic'::plan_key, m from unnest(array['live_sunday', 'sermon_notes', 'testimonies', 'reading_plans', 'prayer_chain']) m
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. Sermon notes (before Live Sunday, which links to them)
-- Body text: blanks are written [[answer]]; members see a box to fill in.
-- ---------------------------------------------------------------------------
create table if not exists sermon_outlines (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references churches(id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 160),
  speaker      text check (char_length(speaker) <= 120),
  sermon_date  date not null,
  scripture    text check (char_length(scripture) <= 200),
  body         text not null check (char_length(body) between 1 and 20000),
  published    boolean not null default false,
  created_by   uuid references app_users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_sermon_outlines_church on sermon_outlines(church_id, sermon_date desc);
drop trigger if exists trg_sermon_outlines_updated_at on sermon_outlines;
create trigger trg_sermon_outlines_updated_at before update on sermon_outlines for each row execute function set_updated_at();
alter table sermon_outlines enable row level security;
drop policy if exists sermon_outlines_select on sermon_outlines;
create policy sermon_outlines_select on sermon_outlines for select
  using (church_id = current_church_id() and (published or is_church_shepherd(church_id)));
drop policy if exists sermon_outlines_write on sermon_outlines;
create policy sermon_outlines_write on sermon_outlines for all
  using (church_id = current_church_id() and is_church_shepherd(church_id))
  with check (church_id = current_church_id() and is_church_shepherd(church_id));

-- ---------------------------------------------------------------------------
-- 1. Live Sunday
-- ---------------------------------------------------------------------------
create table if not exists live_services (
  id               uuid primary key default gen_random_uuid(),
  church_id        uuid not null references churches(id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 1 and 160),
  starts_at        timestamptz not null,
  stream_url       text check (stream_url is null or (stream_url ~ '^https://' and char_length(stream_url) <= 500)),
  service_plan_id  uuid references service_plans(id) on delete set null,
  song_ids         uuid[] not null default '{}' check (cardinality(song_ids) <= 30),
  outline_id   uuid references sermon_outlines(id) on delete set null,
  message          text check (char_length(message) <= 1000),
  created_by       uuid references app_users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_live_services_church on live_services(church_id, starts_at desc);
drop trigger if exists trg_live_services_updated_at on live_services;
create trigger trg_live_services_updated_at before update on live_services for each row execute function set_updated_at();
alter table live_services enable row level security;
drop policy if exists live_services_select on live_services;
create policy live_services_select on live_services for select using (church_id = current_church_id());
drop policy if exists live_services_write on live_services;
create policy live_services_write on live_services for all
  using (church_id = current_church_id() and is_church_shepherd(church_id))
  with check (church_id = current_church_id() and is_church_shepherd(church_id));

-- ---------------------------------------------------------------------------
-- 3. Testimonies
-- ---------------------------------------------------------------------------
create table if not exists testimonies (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references churches(id) on delete cascade,
  user_id      uuid not null references app_users(id) on delete cascade,
  title        text check (char_length(title) <= 120),
  body         text not null check (char_length(btrim(body)) between 10 and 3000),
  show_name    boolean not null default true,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  reviewed_by  uuid references app_users(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_testimonies_church on testimonies(church_id, status, created_at desc);
alter table testimonies enable row level security;
drop policy if exists testimonies_select on testimonies;
create policy testimonies_select on testimonies for select
  using (church_id = current_church_id() and (status = 'approved' or user_id = auth.uid() or is_church_shepherd(church_id)));
drop policy if exists testimonies_insert on testimonies;
create policy testimonies_insert on testimonies for insert
  with check (church_id = current_church_id() and user_id = auth.uid() and status = 'pending' and reviewed_by is null);
-- Pastors review; the author can still edit while it's waiting (and it stays waiting).
drop policy if exists testimonies_update on testimonies;
create policy testimonies_update on testimonies for update
  using (church_id = current_church_id() and (is_church_shepherd(church_id) or (user_id = auth.uid() and status = 'pending')))
  with check (church_id = current_church_id() and (is_church_shepherd(church_id) or (user_id = auth.uid() and status = 'pending' and reviewed_by is null)));
drop policy if exists testimonies_delete on testimonies;
create policy testimonies_delete on testimonies for delete
  using (church_id = current_church_id() and (user_id = auth.uid() or is_church_shepherd(church_id)));

create or replace function app_private.on_testimony() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    perform app_private.notify(
      array(select id from app_users where church_id = new.church_id and status = 'active' and role in ('pastor', 'church_admin')),
      new.church_id, 'alerts', 'testimony.submitted', 'A testimony is waiting for approval',
      left(coalesce(new.title, new.body), 120), '/dashboard/testimonies?tab=review', new.user_id);
  elsif new.status = 'approved' and old.status is distinct from 'approved' then
    perform app_private.notify(array[new.user_id], new.church_id, 'church_news', 'testimony.approved',
      'Your testimony is on the wall', 'Thank you for sharing what God has done.', '/dashboard/testimonies', new.reviewed_by);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_testimony_notify on testimonies;
create trigger trg_testimony_notify after insert or update of status on testimonies
  for each row execute function app_private.on_testimony();

-- ---------------------------------------------------------------------------
-- 4. Reading plans
-- days: [{"readings":[{"book":"John","chapter":1}, …]}, …] — day N is days[N-1].
-- ---------------------------------------------------------------------------
create table if not exists reading_plans (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references churches(id) on delete cascade,
  created_by   uuid references app_users(id) on delete set null,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  description  text check (char_length(description) <= 1000),
  start_date   date not null,
  days         jsonb not null check (jsonb_typeof(days) = 'array' and jsonb_array_length(days) between 1 and 400),
  church_wide  boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_reading_plans_church on reading_plans(church_id, start_date desc);
alter table reading_plans enable row level security;
drop policy if exists reading_plans_select on reading_plans;
create policy reading_plans_select on reading_plans for select
  using (church_id = current_church_id() and (church_wide or created_by = auth.uid()));
drop policy if exists reading_plans_insert on reading_plans;
create policy reading_plans_insert on reading_plans for insert
  with check (church_id = current_church_id() and created_by = auth.uid() and (not church_wide or is_church_shepherd(church_id)));
drop policy if exists reading_plans_update on reading_plans;
create policy reading_plans_update on reading_plans for update
  using (church_id = current_church_id() and (created_by = auth.uid() or (church_wide and is_church_shepherd(church_id))))
  with check (church_id = current_church_id() and (not church_wide or is_church_shepherd(church_id)));
drop policy if exists reading_plans_delete on reading_plans;
create policy reading_plans_delete on reading_plans for delete
  using (church_id = current_church_id() and (created_by = auth.uid() or (church_wide and is_church_shepherd(church_id))));

create table if not exists reading_plan_members (
  plan_id    uuid not null references reading_plans(id) on delete cascade,
  user_id    uuid not null references app_users(id) on delete cascade,
  church_id  uuid not null references churches(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (plan_id, user_id)
);
create index if not exists idx_reading_plan_members_user on reading_plan_members(user_id);
alter table reading_plan_members enable row level security;
drop policy if exists reading_plan_members_select on reading_plan_members;
create policy reading_plan_members_select on reading_plan_members for select
  using (church_id = current_church_id() and exists (select 1 from reading_plans p where p.id = plan_id));
drop policy if exists reading_plan_members_insert on reading_plan_members;
create policy reading_plan_members_insert on reading_plan_members for insert
  with check (user_id = auth.uid() and church_id = current_church_id()
    and exists (select 1 from reading_plans p where p.id = plan_id and p.church_id = current_church_id()));
drop policy if exists reading_plan_members_delete on reading_plan_members;
create policy reading_plan_members_delete on reading_plan_members for delete using (user_id = auth.uid());

create table if not exists reading_progress (
  plan_id    uuid not null references reading_plans(id) on delete cascade,
  user_id    uuid not null references app_users(id) on delete cascade,
  church_id  uuid not null references churches(id) on delete cascade,
  day        integer not null check (day between 1 and 400),
  done_at    timestamptz not null default now(),
  primary key (plan_id, user_id, day)
);
create index if not exists idx_reading_progress_user on reading_progress(user_id, done_at desc);
alter table reading_progress enable row level security;
-- Your own ticks; on church-wide plans, everyone's (for "how the church is doing").
drop policy if exists reading_progress_select on reading_progress;
create policy reading_progress_select on reading_progress for select
  using (church_id = current_church_id() and (user_id = auth.uid() or exists (select 1 from reading_plans p where p.id = plan_id and p.church_wide)));
drop policy if exists reading_progress_insert on reading_progress;
create policy reading_progress_insert on reading_progress for insert
  with check (user_id = auth.uid() and church_id = current_church_id()
    and exists (select 1 from reading_plans p where p.id = plan_id and p.church_id = current_church_id() and day <= jsonb_array_length(p.days)));
drop policy if exists reading_progress_delete on reading_progress;
create policy reading_progress_delete on reading_progress for delete using (user_id = auth.uid());

create or replace function app_private.on_church_reading_plan() returns trigger as $$
begin
  if new.church_wide then
    perform app_private.notify(
      array(select id from app_users where church_id = new.church_id and status = 'active'),
      new.church_id, 'church_news', 'reading_plan.new', 'New church reading plan: ' || new.title,
      'Read along with the whole church — join the plan.', '/dashboard/reading-plans/' || new.id, new.created_by);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_reading_plan_notify on reading_plans;
create trigger trg_reading_plan_notify after insert on reading_plans
  for each row execute function app_private.on_church_reading_plan();

-- ---------------------------------------------------------------------------
-- 5. Prayer chain
-- ---------------------------------------------------------------------------
create table if not exists prayer_chains (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references churches(id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 1 and 120),
  description   text check (char_length(description) <= 1000),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  slot_minutes  integer not null default 60 check (slot_minutes in (15, 30, 60, 120)),
  max_per_slot  integer not null default 3 check (max_per_slot between 1 and 50),
  created_by    uuid references app_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '31 days')
);
create index if not exists idx_prayer_chains_church on prayer_chains(church_id, starts_at desc);
alter table prayer_chains enable row level security;
drop policy if exists prayer_chains_select on prayer_chains;
create policy prayer_chains_select on prayer_chains for select using (church_id = current_church_id());
drop policy if exists prayer_chains_write on prayer_chains;
create policy prayer_chains_write on prayer_chains for all
  using (church_id = current_church_id() and is_church_shepherd(church_id))
  with check (church_id = current_church_id() and is_church_shepherd(church_id));

create table if not exists prayer_chain_slots (
  id           uuid primary key default gen_random_uuid(),
  chain_id     uuid not null references prayer_chains(id) on delete cascade,
  church_id    uuid not null references churches(id) on delete cascade,
  slot_start   timestamptz not null,
  user_id      uuid not null references app_users(id) on delete cascade,
  reminded_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (chain_id, slot_start, user_id)
);
create index if not exists idx_prayer_chain_slots_chain on prayer_chain_slots(chain_id, slot_start);
create index if not exists idx_prayer_chain_slots_due on prayer_chain_slots(slot_start) where reminded_at is null;
alter table prayer_chain_slots enable row level security;
drop policy if exists prayer_chain_slots_select on prayer_chain_slots;
create policy prayer_chain_slots_select on prayer_chain_slots for select using (church_id = current_church_id());
drop policy if exists prayer_chain_slots_insert on prayer_chain_slots;
create policy prayer_chain_slots_insert on prayer_chain_slots for insert
  with check (user_id = auth.uid() and church_id = current_church_id() and reminded_at is null);
drop policy if exists prayer_chain_slots_delete on prayer_chain_slots;
create policy prayer_chain_slots_delete on prayer_chain_slots for delete
  using (church_id = current_church_id() and (user_id = auth.uid() or is_church_shepherd(church_id)));

-- A slot must be inside its chain, on a slot boundary, not already over, and not full.
create or replace function app_private.check_prayer_slot() returns trigger as $$
declare
  c prayer_chains;
  taken integer;
begin
  select * into c from prayer_chains where id = new.chain_id;
  if c.id is null or c.church_id <> new.church_id then raise exception 'That prayer chain could not be found'; end if;
  if new.slot_start < c.starts_at or new.slot_start >= c.ends_at
     or mod((extract(epoch from (new.slot_start - c.starts_at)))::bigint, c.slot_minutes * 60) <> 0 then
    raise exception 'That time is not one of the prayer slots';
  end if;
  if new.slot_start + make_interval(mins => c.slot_minutes) <= now() then raise exception 'That prayer slot is already over'; end if;
  perform pg_advisory_xact_lock(hashtext(new.chain_id::text || new.slot_start::text));
  select count(*) into taken from prayer_chain_slots where chain_id = new.chain_id and slot_start = new.slot_start;
  if taken >= c.max_per_slot then raise exception 'That prayer slot is full'; end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_check_prayer_slot on prayer_chain_slots;
create trigger trg_check_prayer_slot before insert on prayer_chain_slots
  for each row execute function app_private.check_prayer_slot();

create or replace function app_private.on_prayer_chain() returns trigger as $$
begin
  perform app_private.notify(
    array(select id from app_users where church_id = new.church_id and status = 'active'),
    new.church_id, 'prayer_care', 'prayer_chain.new', 'Prayer chain: ' || new.title,
    'Book a time to pray — every slot counts.', '/dashboard/prayer-chain/' || new.id, new.created_by);
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_prayer_chain_notify on prayer_chains;
create trigger trg_prayer_chain_notify after insert on prayer_chains
  for each row execute function app_private.on_prayer_chain();

-- ---------------------------------------------------------------------------
-- 6. Volunteer rosters
-- ---------------------------------------------------------------------------
create table if not exists roster_teams (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references churches(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  description  text check (char_length(description) <= 500),
  leader_id    uuid references app_users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_roster_teams_church on roster_teams(church_id, name);

create table if not exists roster_team_members (
  team_id    uuid not null references roster_teams(id) on delete cascade,
  user_id    uuid not null references app_users(id) on delete cascade,
  church_id  uuid not null references churches(id) on delete cascade,
  primary key (team_id, user_id)
);
create index if not exists idx_roster_team_members_user on roster_team_members(user_id);

create table if not exists roster_duties (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references roster_teams(id) on delete cascade,
  church_id        uuid not null references churches(id) on delete cascade,
  duty_date        date not null,
  role             text check (char_length(role) <= 80),
  user_id          uuid references app_users(id) on delete set null,
  swap_requested   boolean not null default false,
  swap_note        text check (char_length(swap_note) <= 300),
  reminded_at      timestamptz,
  created_by       uuid references app_users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists idx_roster_duties_team on roster_duties(team_id, duty_date);
create index if not exists idx_roster_duties_user on roster_duties(user_id, duty_date);

-- Pastors/admins, or the team's leader.
create or replace function can_manage_roster_team(target_team uuid) returns boolean as $$
  select exists (
    select 1 from roster_teams t
    where t.id = target_team and t.church_id = current_church_id()
      and (t.leader_id = auth.uid() or is_church_shepherd(t.church_id))
  );
$$ language sql stable security definer set search_path = public;
grant execute on function can_manage_roster_team(uuid) to authenticated;

alter table roster_teams enable row level security;
drop policy if exists roster_teams_select on roster_teams;
create policy roster_teams_select on roster_teams for select using (church_id = current_church_id());
drop policy if exists roster_teams_write on roster_teams;
create policy roster_teams_write on roster_teams for all
  using (church_id = current_church_id() and is_church_shepherd(church_id))
  with check (church_id = current_church_id() and is_church_shepherd(church_id));
drop policy if exists roster_teams_leader_update on roster_teams;
create policy roster_teams_leader_update on roster_teams for update
  using (church_id = current_church_id() and leader_id = auth.uid())
  with check (church_id = current_church_id() and leader_id = auth.uid());

alter table roster_team_members enable row level security;
drop policy if exists roster_team_members_select on roster_team_members;
create policy roster_team_members_select on roster_team_members for select using (church_id = current_church_id());
drop policy if exists roster_team_members_write on roster_team_members;
create policy roster_team_members_write on roster_team_members for all
  using (church_id = current_church_id() and can_manage_roster_team(team_id))
  with check (church_id = current_church_id() and can_manage_roster_team(team_id)
    and exists (select 1 from app_users u where u.id = user_id and u.church_id = current_church_id()));

alter table roster_duties enable row level security;
drop policy if exists roster_duties_select on roster_duties;
create policy roster_duties_select on roster_duties for select using (church_id = current_church_id());
drop policy if exists roster_duties_write on roster_duties;
create policy roster_duties_write on roster_duties for all
  using (church_id = current_church_id() and can_manage_roster_team(team_id))
  with check (church_id = current_church_id() and can_manage_roster_team(team_id)
    and (user_id is null or exists (select 1 from app_users u where u.id = user_id and u.church_id = current_church_id())));

-- Someone is put on duty: tell them.
create or replace function app_private.on_roster_duty() returns trigger as $$
declare
  team_name text;
begin
  if new.user_id is not null and (tg_op = 'INSERT' or new.user_id is distinct from old.user_id) then
    select name into team_name from roster_teams where id = new.team_id;
    perform app_private.notify(array[new.user_id], new.church_id, 'church_news', 'roster.assigned',
      'You''re on the ' || team_name || ' roster',
      to_char(new.duty_date, 'FMDay FMDD FMMonth') || coalesce(' · ' || new.role, ''),
      '/dashboard/rosters', auth.uid());
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_roster_duty_notify on roster_duties;
create trigger trg_roster_duty_notify after insert or update of user_id on roster_duties
  for each row execute function app_private.on_roster_duty();

-- The person on duty asks for a swap (or takes the request back).
create or replace function request_roster_swap(duty uuid, note text default null, cancel boolean default false)
returns void as $$
declare
  d roster_duties;
  team_name text;
begin
  select * into d from roster_duties where id = duty for update;
  if d.id is null or d.church_id <> current_church_id() then raise exception 'That duty could not be found'; end if;
  if d.user_id is distinct from auth.uid() then raise exception 'Only the person on duty can ask for a swap'; end if;
  if d.duty_date < (now() at time zone 'Africa/Johannesburg')::date then raise exception 'That duty has passed'; end if;
  update roster_duties set swap_requested = not cancel, swap_note = case when cancel then null else left(note, 300) end where id = duty;
  if not cancel then
    select name into team_name from roster_teams where id = d.team_id;
    perform app_private.notify(
      array(select m.user_id from roster_team_members m where m.team_id = d.team_id
            union select leader_id from roster_teams where id = d.team_id and leader_id is not null),
      d.church_id, 'church_news', 'roster.swap_requested', 'Can you swap? ' || team_name || ', ' || to_char(d.duty_date, 'FMDay FMDD FMMonth'),
      coalesce(left(note, 200), 'Tap to take this duty.'), '/dashboard/rosters', auth.uid());
  end if;
end;
$$ language plpgsql security definer set search_path = public;
revoke all on function request_roster_swap(uuid, text, boolean) from public, anon;
grant execute on function request_roster_swap(uuid, text, boolean) to authenticated;

-- A team member takes a duty that's up for swapping.
create or replace function take_roster_swap(duty uuid) returns void as $$
declare
  d roster_duties;
  me_name text;
begin
  select * into d from roster_duties where id = duty for update;
  if d.id is null or d.church_id <> current_church_id() then raise exception 'That duty could not be found'; end if;
  if not d.swap_requested then raise exception 'That duty is no longer up for a swap'; end if;
  if d.user_id = auth.uid() then raise exception 'That is already your duty'; end if;
  if not exists (select 1 from roster_team_members where team_id = d.team_id and user_id = auth.uid())
     and not can_manage_roster_team(d.team_id) then
    raise exception 'Only people on this team can take the duty';
  end if;
  update roster_duties set user_id = auth.uid(), swap_requested = false, swap_note = null, reminded_at = null where id = duty;
  select name into me_name from app_users where id = auth.uid();
  if d.user_id is not null then
    perform app_private.notify(array[d.user_id], d.church_id, 'church_news', 'roster.swapped',
      me_name || ' took your duty', to_char(d.duty_date, 'FMDay FMDD FMMonth') || coalesce(' · ' || d.role, ''), '/dashboard/rosters', auth.uid());
  end if;
end;
$$ language plpgsql security definer set search_path = public;
revoke all on function take_roster_swap(uuid) from public, anon;
grant execute on function take_roster_swap(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Certificates
-- ---------------------------------------------------------------------------
create sequence if not exists certificate_no_seq start 1001;
create table if not exists certificates (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references churches(id) on delete cascade,
  certificate_no  bigint not null default nextval('certificate_no_seq'),
  kind            text not null check (kind in ('baptism', 'dedication', 'membership', 'course')),
  recipient_name  text not null check (char_length(btrim(recipient_name)) between 1 and 120),
  member_id       uuid references app_users(id) on delete set null,
  issued_on       date not null,
  course_name     text check (char_length(course_name) <= 120),
  parents         text check (char_length(parents) <= 160),
  officiant       text check (char_length(officiant) <= 120),
  scripture       text check (char_length(scripture) <= 300),
  place           text check (char_length(place) <= 120),
  issued_by       uuid references app_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  check (kind <> 'course' or course_name is not null)
);
create index if not exists idx_certificates_church on certificates(church_id, issued_on desc);
create index if not exists idx_certificates_member on certificates(member_id);
alter table certificates enable row level security;
drop policy if exists certificates_select on certificates;
create policy certificates_select on certificates for select
  using (church_id = current_church_id() and (member_id = auth.uid() or is_church_shepherd(church_id)));
drop policy if exists certificates_write on certificates;
create policy certificates_write on certificates for all
  using (church_id = current_church_id() and is_church_shepherd(church_id))
  with check (church_id = current_church_id() and is_church_shepherd(church_id)
    and (member_id is null or exists (select 1 from app_users u where u.id = member_id and u.church_id = current_church_id())));

-- ---------------------------------------------------------------------------
-- 8. Monday report: which week each church was sent (server-only; no policies).
-- ---------------------------------------------------------------------------
create table if not exists weekly_report_log (
  church_id   uuid not null references churches(id) on delete cascade,
  week_start  date not null,
  sent_at     timestamptz not null default now(),
  primary key (church_id, week_start)
);
alter table weekly_report_log enable row level security;

-- ---------------------------------------------------------------------------
-- Reminders: prayer slots (about 30 minutes before) and roster duties (the
-- day before, from 08:00). Each goes once. Server-only.
-- ---------------------------------------------------------------------------
create or replace function run_due_reminders() returns integer as $$
declare
  n integer := 0;
  r record;
  today date := (now() at time zone 'Africa/Johannesburg')::date;
begin
  -- Server only (pg_cron or the app's service key) — never a signed-in person.
  if auth.uid() is not null then raise exception 'Not allowed'; end if;
  for r in
    update prayer_chain_slots s set reminded_at = now()
     from prayer_chains c
     where c.id = s.chain_id and s.reminded_at is null
       and s.slot_start > now() - interval '5 minutes' and s.slot_start <= now() + interval '35 minutes'
    returning s.user_id, s.church_id, s.slot_start, c.id as chain_id, c.title
  loop
    perform app_private.notify(array[r.user_id], r.church_id, 'prayer_care', 'prayer_chain.reminder',
      'Your prayer slot starts at ' || to_char(r.slot_start at time zone 'Africa/Johannesburg', 'HH24:MI'),
      r.title || ' — thank you for standing in prayer.', '/dashboard/prayer-chain/' || r.chain_id, null);
    n := n + 1;
  end loop;

  if extract(hour from now() at time zone 'Africa/Johannesburg') >= 8 then
    for r in
      update roster_duties d set reminded_at = now()
       from roster_teams t
       where t.id = d.team_id and d.reminded_at is null and d.user_id is not null and d.duty_date = today + 1
      returning d.user_id, d.church_id, d.duty_date, d.role, t.name
    loop
      perform app_private.notify(array[r.user_id], r.church_id, 'church_news', 'roster.reminder',
        'Reminder: ' || r.name || ' tomorrow', coalesce(r.role || ' · ', '') || 'Can''t make it? Ask for a swap in Rosters.', '/dashboard/rosters', null);
      n := n + 1;
    end loop;
  end if;
  return n;
end;
$$ language plpgsql security definer set search_path = public;
revoke all on function run_due_reminders() from public, anon, authenticated;
grant execute on function run_due_reminders() to service_role;

-- Every 10 minutes, where pg_cron is available (Supabase → Database → Extensions).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'grace-reminders';
  perform cron.schedule('grace-reminders', '*/10 * * * *', 'select public.run_due_reminders()');
exception when others then
  raise notice 'pg_cron is not available (%); reminders run from the nightly job only', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Platform admin: payments a platform admin records by hand (cash, EFT),
--    so they get an invoice number and a receipt like card payments.
-- ---------------------------------------------------------------------------
alter table billing_payments drop constraint if exists billing_payments_kind_check;
alter table billing_payments add constraint billing_payments_kind_check check (kind in ('checkout', 'renewal', 'manual'));

-- ---------------------------------------------------------------------------
-- 10. Prices: Basic R250, Premium R500, Unlimited R1,000 a month; paying
--     yearly is 10 months' price (2 months free). Churches with a special
--     price keep it. Change them any time in Super Admin → Plans & prices.
-- ---------------------------------------------------------------------------
update plans set monthly_price = 250,  yearly_price = 2500  where key = 'basic';
update plans set monthly_price = 500,  yearly_price = 5000  where key = 'premium';
update plans set monthly_price = 1000, yearly_price = 10000 where key = 'enterprise';

-- ---------------------------------------------------------------------------
-- 11. What each plan gets (November 2026)
--   Basic     — everything members use each week, plus Sermons as links
--               (YouTube, Facebook, Drive…). No uploads, calls, AI.
--   Premium   — + leadership tools, calls, voice notes, photos in chat,
--               uploading sermon recordings, AI (300 requests a month).
--   Unlimited — + any size, AI 1,000 a month, priority support, and the
--               church's own colours in the app.
-- ---------------------------------------------------------------------------
insert into modules (key, name, description) values
  ('sermon_uploads',   'Sermon uploads',   'Upload sermon audio and video recordings (uses file storage)'),
  ('priority_support', 'Priority support', 'Support tickets marked high priority, and a WhatsApp line'),
  ('church_colours',   'Church colours',   'The church''s own colours throughout the app')
on conflict (key) do nothing;

insert into plan_modules (plan_key, module_key) values
  ('basic', 'sermon_ai'),
  ('premium', 'chat_photos'), ('premium', 'sermon_uploads'),
  ('free_trial', 'chat_photos'), ('free_trial', 'sermon_uploads'),
  ('sponsored', 'chat_photos'), ('sponsored', 'sermon_uploads'),
  ('enterprise', 'chat_photos'), ('enterprise', 'sermon_uploads'), ('enterprise', 'priority_support'), ('enterprise', 'church_colours')
on conflict do nothing;

-- Monthly AI requests a church may make (null = no monthly limit).
alter table plans add column if not exists ai_monthly_limit integer check (ai_monthly_limit is null or ai_monthly_limit >= 0);
update plans set ai_monthly_limit = case key
  when 'free_trial' then 50 when 'basic' then 0 when 'premium' then 300 when 'enterprise' then 1000 when 'sponsored' then 300 else ai_monthly_limit end;
create index if not exists idx_ai_usage_church_time on ai_usage_events(church_id, created_at desc);

-- The church's colour scheme (Unlimited). One of the app's checked palettes.
alter table churches add column if not exists brand_theme text;
alter table churches drop constraint if exists churches_brand_theme_check;
alter table churches add constraint churches_brand_theme_check
  check (brand_theme is null or brand_theme in ('royal', 'forest', 'crimson', 'ocean', 'gold', 'violet', 'charcoal'));

-- Tickets from churches with priority support are high priority.
create or replace function app_private.ticket_priority() returns trigger as $$
begin
  if church_module_enabled(new.church_id, 'priority_support') then new.priority := 'high'; end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_ticket_priority on support_tickets;
create trigger trg_ticket_priority before insert on support_tickets
  for each row execute function app_private.ticket_priority();
