-- ============================================================================
-- SERVICE PLANNER + PASTOR BOOKING — schema
-- Module keys 'service_planner' and 'pastor_booking' already exist in
-- schema.sql's modules/plan_modules tables — no need to re-register them.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SERVICE PLANNER
-- ----------------------------------------------------------------------------
create table service_plans (
  id            uuid primary key default uuid_generate_v4(),
  church_id     uuid not null references churches(id) on delete cascade,
  created_by    uuid not null references app_users(id),

  title         text not null,          -- e.g. "Sunday Service"
  service_date  date not null,
  status        text not null default 'draft' check (status in ('draft', 'published')),
  notes         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_service_plans_church_date on service_plans(church_id, service_date desc);

alter table service_plans enable row level security;

-- Everyone in the church can see published plans (volunteers need the
-- running order); only pastor/church_admin see drafts, and only they write.
create policy service_plans_select on service_plans
  for select using (
    is_super_admin()
    or (
      church_id = current_church_id()
      and (
        status = 'published'
        or exists (select 1 from app_users where id = auth.uid() and role in ('pastor', 'church_admin'))
      )
    )
  );

create policy service_plans_insert on service_plans
  for insert with check (
    church_id = current_church_id()
    and created_by = auth.uid()
    and exists (select 1 from app_users where id = auth.uid() and role in ('pastor', 'church_admin'))
  );

create policy service_plans_update on service_plans
  for update using (
    church_id = current_church_id()
    and exists (select 1 from app_users where id = auth.uid() and role in ('pastor', 'church_admin'))
  );

create policy service_plans_delete on service_plans
  for delete using (
    church_id = current_church_id()
    and exists (select 1 from app_users where id = auth.uid() and role in ('pastor', 'church_admin'))
  );

create trigger trg_service_plans_updated_at before update on service_plans
  for each row execute function set_updated_at();

-- Items within a plan (Worship, Opening Prayer, Offering, Sermon, etc.)
create table service_plan_items (
  id                uuid primary key default uuid_generate_v4(),
  service_plan_id   uuid not null references service_plans(id) on delete cascade,
  order_index       integer not null default 0,
  item_title        text not null,        -- e.g. "Worship", "7-Minute Word"
  assigned_to       uuid references app_users(id),
  duration_minutes  integer,
  notes             text,

  created_at        timestamptz not null default now()
);

create index idx_service_plan_items_plan on service_plan_items(service_plan_id, order_index);

alter table service_plan_items enable row level security;

-- Inherits visibility from the parent plan (published, or pastor/admin)
create policy service_plan_items_select on service_plan_items
  for select using (
    exists (
      select 1 from service_plans p
      where p.id = service_plan_id
      and (
        is_super_admin()
        or (
          p.church_id = current_church_id()
          and (
            p.status = 'published'
            or exists (select 1 from app_users where id = auth.uid() and role in ('pastor', 'church_admin'))
          )
        )
      )
    )
  );

create policy service_plan_items_write on service_plan_items
  for all using (
    exists (
      select 1 from service_plans p
      join app_users u on u.id = auth.uid()
      where p.id = service_plan_id
      and p.church_id = current_church_id()
      and u.role in ('pastor', 'church_admin')
    )
  )
  with check (
    exists (
      select 1 from service_plans p
      join app_users u on u.id = auth.uid()
      where p.id = service_plan_id
      and p.church_id = current_church_id()
      and u.role in ('pastor', 'church_admin')
    )
  );

-- ----------------------------------------------------------------------------
-- PASTOR BOOKING SYSTEM
-- ----------------------------------------------------------------------------
create table pastor_bookings (
  id                uuid primary key default uuid_generate_v4(),
  church_id         uuid not null references churches(id) on delete cascade,
  requested_by      uuid not null references app_users(id),
  pastor_id         uuid references app_users(id),   -- who it's requested of; null = any pastor

  booking_type      text not null check (booking_type in ('wedding', 'funeral', 'thanksgiving', 'baptism', 'counselling', 'other')),
  preferred_date    date not null,
  preferred_time    time,
  location          text,
  details           text,

  status            text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'completed')),
  decline_reason    text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_pastor_bookings_church_date on pastor_bookings(church_id, preferred_date);
create index idx_pastor_bookings_requester on pastor_bookings(requested_by);

alter table pastor_bookings enable row level security;

-- Requester sees their own; pastor/church_admin see everything in the church
create policy pastor_bookings_select on pastor_bookings
  for select using (
    is_super_admin()
    or requested_by = auth.uid()
    or (
      church_id = current_church_id()
      and exists (select 1 from app_users where id = auth.uid() and role in ('pastor', 'church_admin'))
    )
  );

create policy pastor_bookings_insert on pastor_bookings
  for insert with check (
    church_id = current_church_id() and requested_by = auth.uid()
  );

-- Only pastor/church_admin can change status (approve/decline); the
-- requester cannot edit their own request after submitting (encourages a
-- clean audit trail — cancellation would be a separate explicit action,
-- not yet built).
create policy pastor_bookings_update on pastor_bookings
  for update using (
    church_id = current_church_id()
    and exists (select 1 from app_users where id = auth.uid() and role in ('pastor', 'church_admin'))
  );

create trigger trg_pastor_bookings_updated_at before update on pastor_bookings
  for each row execute function set_updated_at();

-- Pastor-declared blocked time (vacation, existing commitments, etc.)
create table pastor_availability_blocks (
  id            uuid primary key default uuid_generate_v4(),
  church_id     uuid not null references churches(id) on delete cascade,
  pastor_id     uuid not null references app_users(id),
  blocked_date  date not null,
  note          text,
  created_at    timestamptz not null default now()
);

create index idx_pastor_availability_pastor_date on pastor_availability_blocks(pastor_id, blocked_date);

alter table pastor_availability_blocks enable row level security;

-- Visible to the whole church (so members can see a pastor is unavailable
-- before requesting), writable only by the pastor themselves or church_admin
create policy pastor_availability_select on pastor_availability_blocks
  for select using (is_super_admin() or church_id = current_church_id());

create policy pastor_availability_write on pastor_availability_blocks
  for all using (
    pastor_id = auth.uid()
    or exists (select 1 from app_users where id = auth.uid() and role = 'church_admin' and church_id = pastor_availability_blocks.church_id)
  )
  with check (
    pastor_id = auth.uid()
    or exists (select 1 from app_users where id = auth.uid() and role = 'church_admin' and church_id = pastor_availability_blocks.church_id)
  );
