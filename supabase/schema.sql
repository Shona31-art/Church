-- ============================================================================
-- CHURCH PLATFORM — FOUNDATION SCHEMA
-- Target: Supabase free tier (Postgres + Auth + RLS). No paid add-ons required.
-- Run this in Supabase SQL Editor, top to bottom, in a fresh project.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. ENUMS
-- ----------------------------------------------------------------------------
create type user_role as enum (
  'super_admin',
  'church_admin',
  'pastor',
  'department_leader',
  'member'
);

create type church_account_status as enum (
  'active',
  'trial',
  'payment_pending',
  'grace',
  'suspended'
);

create type plan_key as enum (
  'free_trial',
  'basic',
  'premium',
  'enterprise',
  'sponsored'   -- super-admin-granted, price = 0, controlled manually
);

-- ----------------------------------------------------------------------------
-- 2. CHURCHES
-- ----------------------------------------------------------------------------
create table churches (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  logo_url          text,
  address           text,
  phone             text,
  email             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. DEPARTMENTS (Worship, Youth, Media, etc.) — scoped per church
-- ----------------------------------------------------------------------------
create table departments (
  id          uuid primary key default uuid_generate_v4(),
  church_id   uuid not null references churches(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (church_id, name)
);

-- ----------------------------------------------------------------------------
-- 4. USERS
-- One row per authenticated person, 1:1 with Supabase auth.users.id
-- super_admin rows have church_id = NULL (they belong to no single church)
-- ----------------------------------------------------------------------------
create table app_users (
  id              uuid primary key references auth.users(id) on delete cascade,
  church_id       uuid references churches(id) on delete cascade,
  department_id   uuid references departments(id) on delete set null,
  name            text not null,
  email           text not null,
  phone           text,
  role            user_role not null default 'member',
  status          text not null default 'active', -- active | invited | disabled
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Only super_admin may have a NULL church_id
  constraint chk_church_required check (
    (role = 'super_admin' and church_id is null)
    or (role != 'super_admin' and church_id is not null)
  )
);

create index idx_app_users_church on app_users(church_id);
create index idx_app_users_role on app_users(role);

-- ----------------------------------------------------------------------------
-- 5. MODULES — canonical list of gate-able features
-- This is the single source of truth for module keys used throughout the app.
-- ----------------------------------------------------------------------------
create table modules (
  key           text primary key,   -- e.g. 'members', 'announcements', 'sermon_ai'
  name          text not null,
  description   text
);

insert into modules (key, name) values
  ('members',          'Member Management'),
  ('announcements',    'Announcements'),
  ('calendar',         'Church Calendar'),
  ('service_planner',  'Service Planner'),
  ('pastor_booking',   'Pastor Booking System'),
  ('ai_poster',        'AI Poster Generator'),
  ('sermon_ai',        'Sermon AI (transcription/summary)'),
  ('dept_chats',       'Department Chats'),
  ('bible',            'Bible Module'),
  ('analytics',        'Advanced Analytics'),
  ('multi_campus',     'Multiple Campuses');

-- ----------------------------------------------------------------------------
-- 6. PLANS — canonical list of subscription tiers
-- ----------------------------------------------------------------------------
create table plans (
  key             plan_key primary key,
  name            text not null,
  monthly_price   numeric(10,2) not null default 0,
  member_limit    integer,           -- null = unlimited
  trial_days      integer,           -- only meaningful for free_trial
  description     text
);

insert into plans (key, name, monthly_price, member_limit, trial_days, description) values
  ('free_trial', 'Free Trial', 0,   null, 30, 'Full core feature trial for 30 days'),
  ('basic',      'Basic',      299, 200,  null, 'Small church starter plan'),
  ('premium',    'Premium',    799, null, null, 'Unlimited members + AI tools'),
  ('enterprise', 'Enterprise', 0,   null, null, 'Custom pricing, multi-campus'),
  ('sponsored',  'Sponsored',  0,   null, null, 'Manually granted by Super Admin');

-- Which modules each plan includes by default
create table plan_modules (
  plan_key    plan_key not null references plans(key) on delete cascade,
  module_key  text not null references modules(key) on delete cascade,
  primary key (plan_key, module_key)
);

insert into plan_modules (plan_key, module_key) values
  -- free_trial: core modules only
  ('free_trial', 'members'),
  ('free_trial', 'announcements'),
  ('free_trial', 'calendar'),
  ('free_trial', 'sermon_ai'), -- "basic sermons" per SOW; AI-summary limited in app logic, not here

  -- basic
  ('basic', 'members'),
  ('basic', 'announcements'),
  ('basic', 'calendar'),

  -- premium (everything except multi-campus/enterprise analytics)
  ('premium', 'members'),
  ('premium', 'announcements'),
  ('premium', 'calendar'),
  ('premium', 'service_planner'),
  ('premium', 'pastor_booking'),
  ('premium', 'ai_poster'),
  ('premium', 'sermon_ai'),
  ('premium', 'dept_chats'),
  ('premium', 'bible'),

  -- enterprise (everything)
  ('enterprise', 'members'),
  ('enterprise', 'announcements'),
  ('enterprise', 'calendar'),
  ('enterprise', 'service_planner'),
  ('enterprise', 'pastor_booking'),
  ('enterprise', 'ai_poster'),
  ('enterprise', 'sermon_ai'),
  ('enterprise', 'dept_chats'),
  ('enterprise', 'bible'),
  ('enterprise', 'analytics'),
  ('enterprise', 'multi_campus'),

  -- sponsored (everything, mirrors enterprise; can still be overridden per-church)
  ('sponsored', 'members'),
  ('sponsored', 'announcements'),
  ('sponsored', 'calendar'),
  ('sponsored', 'service_planner'),
  ('sponsored', 'pastor_booking'),
  ('sponsored', 'ai_poster'),
  ('sponsored', 'sermon_ai'),
  ('sponsored', 'dept_chats'),
  ('sponsored', 'bible'),
  ('sponsored', 'analytics'),
  ('sponsored', 'multi_campus');

-- ----------------------------------------------------------------------------
-- 7. CHURCH SUBSCRIPTIONS — one active row per church
-- This table drives account_status, which drives the paywall.
-- ----------------------------------------------------------------------------
create table church_subscriptions (
  id                  uuid primary key default uuid_generate_v4(),
  church_id           uuid not null unique references churches(id) on delete cascade,
  plan_key            plan_key not null default 'free_trial',
  status              church_account_status not null default 'trial',

  trial_expires_at    timestamptz,          -- set when plan_key = free_trial
  billing_date        timestamptz,          -- next expected payment date
  grace_period_end    timestamptz,          -- set when a payment fails
  suspended_at        timestamptz,

  price_override      numeric(10,2),        -- for discounts / sponsored (null = use plan default)
  is_lifetime          boolean not null default false, -- never expires, super-admin only
  notes               text,                  -- e.g. "Sponsored by Super Admin — Grace Church"

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Per-church module overrides (super admin can grant/revoke individual modules
-- regardless of plan — e.g. give one church early access to ai_poster)
create table church_modules (
  church_id   uuid not null references churches(id) on delete cascade,
  module_key  text not null references modules(key) on delete cascade,
  enabled     boolean not null,           -- true = force on, false = force off
  set_by      uuid references app_users(id),
  set_at      timestamptz not null default now(),
  primary key (church_id, module_key)
);

-- ----------------------------------------------------------------------------
-- 8. AUDIT LOG — required for POPIA / accountability
-- ----------------------------------------------------------------------------
create table audit_logs (
  id            uuid primary key default uuid_generate_v4(),
  church_id     uuid references churches(id) on delete set null,
  actor_id      uuid references app_users(id) on delete set null,
  action        text not null,        -- e.g. 'subscription.suspended', 'member.deleted'
  target_table  text,
  target_id     uuid,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 9. UPDATED_AT TRIGGER HELPER
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_churches_updated_at before update on churches
  for each row execute function set_updated_at();
create trigger trg_app_users_updated_at before update on app_users
  for each row execute function set_updated_at();
create trigger trg_church_subscriptions_updated_at before update on church_subscriptions
  for each row execute function set_updated_at();

-- ============================================================================
-- 10. ROW LEVEL SECURITY (multi-tenant isolation — this is not optional)
-- ============================================================================

alter table churches enable row level security;
alter table departments enable row level security;
alter table app_users enable row level security;
alter table church_subscriptions enable row level security;
alter table church_modules enable row level security;
alter table audit_logs enable row level security;

-- Helper: is the current user a super_admin?
create or replace function is_super_admin()
returns boolean as $$
  select exists (
    select 1 from app_users
    where id = auth.uid() and role = 'super_admin'
  );
$$ language sql stable security definer;

-- Helper: current user's church_id
create or replace function current_church_id()
returns uuid as $$
  select church_id from app_users where id = auth.uid();
$$ language sql stable security definer;

-- app_users: users can see themselves + everyone in their own church; super_admin sees all
create policy app_users_select on app_users
  for select using (
    is_super_admin() or church_id = current_church_id() or id = auth.uid()
  );

create policy app_users_update_self on app_users
  for update using (id = auth.uid() or is_super_admin());

-- churches: visible to super_admin, or to members of that church
create policy churches_select on churches
  for select using (
    is_super_admin() or id = current_church_id()
  );

create policy churches_update on churches
  for update using (
    is_super_admin() or
    (id = current_church_id() and exists (
      select 1 from app_users
      where id = auth.uid() and role in ('church_admin')
    ))
  );

-- departments: scoped to church
create policy departments_select on departments
  for select using (is_super_admin() or church_id = current_church_id());

-- church_subscriptions: church members can READ their own subscription status
-- (needed to show "trial expires in X days" banners), but only super_admin can WRITE
create policy church_subscriptions_select on church_subscriptions
  for select using (is_super_admin() or church_id = current_church_id());

create policy church_subscriptions_write on church_subscriptions
  for all using (is_super_admin())
  with check (is_super_admin());

-- church_modules: same pattern — readable by church, writable only by super_admin
create policy church_modules_select on church_modules
  for select using (is_super_admin() or church_id = current_church_id());

create policy church_modules_write on church_modules
  for all using (is_super_admin())
  with check (is_super_admin());

-- audit_logs: super_admin sees everything; church_admin sees their own church's log
create policy audit_logs_select on audit_logs
  for select using (
    is_super_admin() or
    (church_id = current_church_id() and exists (
      select 1 from app_users where id = auth.uid() and role = 'church_admin'
    ))
  );

-- ============================================================================
-- END OF FOUNDATION SCHEMA
-- Next: add tables per module (members detail, announcements, events, etc.)
-- as each module is built — each new table should follow the same RLS pattern:
-- scoped by church_id, super_admin bypass, role checks for writes.
-- ============================================================================
