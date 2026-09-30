-- ============================================================================
-- CALENDAR / EVENTS MODULE
-- ============================================================================

create table events (
  id            uuid primary key default uuid_generate_v4(),
  church_id     uuid not null references churches(id) on delete cascade,
  department_id uuid references departments(id) on delete cascade, -- null = church-wide
  created_by    uuid not null references app_users(id),

  title         text not null,
  description   text,
  location      text,
  category      text,      -- 'service' | 'meeting' | 'wedding' | 'youth' | etc, free text for MVP
  start_time    timestamptz not null,
  end_time      timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_events_church_time on events(church_id, start_time);

alter table events enable row level security;

create policy events_select on events
  for select using (
    is_super_admin()
    or (
      church_id = current_church_id()
      and (
        department_id is null
        or department_id = (select department_id from app_users where id = auth.uid())
        or exists (select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor'))
      )
    )
  );

create policy events_insert on events
  for insert with check (
    church_id = current_church_id()
    and created_by = auth.uid()
    and (
      exists (select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor'))
      or (
        department_id is not null
        and department_id = (select department_id from app_users where id = auth.uid())
        and exists (select 1 from app_users where id = auth.uid() and role = 'department_leader')
      )
    )
  );

create policy events_update on events
  for update using (
    created_by = auth.uid()
    or exists (select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor') and church_id = events.church_id)
  );

create policy events_delete on events
  for delete using (
    created_by = auth.uid()
    or exists (select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor') and church_id = events.church_id)
  );

create trigger trg_events_updated_at before update on events
  for each row execute function set_updated_at();

-- RSVPs
create table event_rsvps (
  event_id    uuid not null references events(id) on delete cascade,
  user_id     uuid not null references app_users(id) on delete cascade,
  status      text not null check (status in ('going', 'maybe', 'declined')),
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table event_rsvps enable row level security;

-- A member can see their own RSVP, plus everyone in the church can see
-- aggregate RSVPs on events they can already see (needed for "12 going" counts)
create policy event_rsvps_select on event_rsvps
  for select using (
    exists (
      select 1 from events e where e.id = event_id
      and (is_super_admin() or e.church_id = current_church_id())
    )
  );

create policy event_rsvps_upsert on event_rsvps
  for insert with check (user_id = auth.uid());

create policy event_rsvps_update on event_rsvps
  for update using (user_id = auth.uid());
