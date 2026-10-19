-- ============================================================================
-- MIGRATION #30 — Giving by bank transfer (EFT). Run after poster_editor.sql.
-- Why: docs/adr/0004-giving-by-bank-transfer.md. Plan: docs/plans/eft-giving.md
--
-- In plain language:
--   * New table church_giving_details: each church's bank details for giving.
--     Members of that church can read them; only its church admins can
--     change them. Every change is audit-logged and lands in every church
--     admin's notification bell (a swapped account number is the main risk).
--   * givings gains: method (card | eft), reference, paid_on, confirmed_by,
--     confirmed_at, updated_at; and two statuses: 'reported' (member says they
--     paid, waiting for an admin) and 'not_received'. 'succeeded' still means
--     "money received", so every existing total keeps working unchanged.
--   * Members can record their own transfer (status 'reported' only) and
--     delete it while it's waiting. Nobody can update a gift directly: admins
--     confirm through confirm_eft_gift(), which checks role, church and that
--     nobody else acted on it first, and writes the audit log.
--   * The reference is worked out by the database (church prefix + a code
--     from the member's account), so it can't be spoofed.
-- Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: is the signed-in person an active church admin of `target_church`?
-- ----------------------------------------------------------------------------
create or replace function is_church_admin(target_church uuid)
returns boolean as $$
  select exists (
    select 1 from app_users
    where id = auth.uid() and church_id = target_church and role = 'church_admin' and status <> 'disabled'
  );
$$ language sql stable security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 1. Bank details per church
-- ----------------------------------------------------------------------------
create table if not exists church_giving_details (
  church_id         uuid primary key references churches(id) on delete cascade,
  account_name      text not null check (char_length(account_name) between 2 and 100),
  bank_name         text not null check (char_length(bank_name) between 2 and 60),
  account_number    text not null check (account_number ~ '^[0-9]{6,16}$'),
  branch_code       text not null check (branch_code ~ '^[0-9]{6}$'),
  account_type      text not null check (account_type in ('cheque', 'savings', 'transmission', 'business')),
  -- First part of every member's reference, e.g. KAMI → KAMI-3F9A2C.
  reference_prefix  text not null check (reference_prefix ~ '^[A-Z0-9]{2,8}$'),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references app_users(id) on delete set null
);

alter table church_giving_details enable row level security;

drop policy if exists giving_details_select on church_giving_details;
create policy giving_details_select on church_giving_details
  for select using (church_id = current_church_id());

drop policy if exists giving_details_insert on church_giving_details;
create policy giving_details_insert on church_giving_details
  for insert with check (church_id = current_church_id() and is_church_admin(church_id));

drop policy if exists giving_details_update on church_giving_details;
create policy giving_details_update on church_giving_details
  for update using (church_id = current_church_id() and is_church_admin(church_id))
  with check (church_id = current_church_id() and is_church_admin(church_id));
-- No delete policy: details are corrected, never removed, so the audit trail stays whole.

-- Who changed it comes from the session, never from the form.
create or replace function app_private.stamp_giving_details()
returns trigger as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_stamp_giving_details on church_giving_details;
create trigger trg_stamp_giving_details before insert or update on church_giving_details
  for each row execute function app_private.stamp_giving_details();

-- Audit + bell for every church admin (including whoever made the change, so
-- a change made from a taken-over account still shows up in the owner's bell).
create or replace function app_private.on_giving_details_changed()
returns trigger as $$
declare
  actor_name text := (select name from app_users where id = auth.uid());
begin
  insert into audit_logs (church_id, actor_id, action, target_table, target_id, metadata)
  values (
    new.church_id, auth.uid(), 'giving_details.' || lower(tg_op), 'church_giving_details', new.church_id,
    jsonb_build_object(
      'bank_name', new.bank_name,
      'account_ending', right(new.account_number, 4),
      'previous_account_ending', case when tg_op = 'UPDATE' then right(old.account_number, 4) end
    )
  );
  perform app_private.notify(
    array(select id from app_users where church_id = new.church_id and role = 'church_admin' and status = 'active'),
    new.church_id, 'alerts', 'giving.bank_details_changed',
    'Bank details for giving changed',
    coalesce(actor_name, 'Someone') || ' changed the bank details members see on the Giving page (account ending '
      || right(new.account_number, 4) || '). If you didn''t expect this, check them now.',
    '/dashboard/setup/giving', null);
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_giving_details_changed on church_giving_details;
create trigger trg_giving_details_changed after insert or update on church_giving_details
  for each row execute function app_private.on_giving_details_changed();

-- ----------------------------------------------------------------------------
-- 2. Gifts: bank transfers alongside card payments
-- ----------------------------------------------------------------------------
alter table givings add column if not exists method       text not null default 'card';
alter table givings add column if not exists reference    text;
alter table givings add column if not exists paid_on      date;
alter table givings add column if not exists confirmed_by uuid references app_users(id) on delete set null;
alter table givings add column if not exists confirmed_at timestamptz;
alter table givings add column if not exists updated_at   timestamptz not null default now();

alter table givings drop constraint if exists givings_method_check;
alter table givings add constraint givings_method_check check (method in ('card', 'eft'));

alter table givings drop constraint if exists givings_status_check;
alter table givings add constraint givings_status_check
  check (status in ('pending', 'succeeded', 'failed', 'reported', 'not_received'));

-- A bank transfer always says when it was paid and under which reference.
alter table givings drop constraint if exists givings_eft_fields;
alter table givings add constraint givings_eft_fields
  check (method = 'card' or (paid_on is not null and reference is not null));

create index if not exists idx_givings_church_status on givings(church_id, status);

drop trigger if exists trg_givings_updated_at on givings;
create trigger trg_givings_updated_at before update on givings
  for each row execute function set_updated_at();

-- The reference is the church's prefix + the first 6 characters of the
-- member's account id, upper-case. lib/giving.ts (eftReference) builds the
-- same thing for display; tests/db/eft-giving.test.ts checks they match.
create or replace function app_private.set_eft_reference()
returns trigger as $$
begin
  if new.method = 'eft' then
    new.reference := (select reference_prefix from church_giving_details where church_id = new.church_id)
      || '-' || upper(left(replace(new.user_id::text, '-', ''), 6));
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_set_eft_reference on givings;
create trigger trg_set_eft_reference before insert on givings
  for each row execute function app_private.set_eft_reference();

-- Members: record their own transfer, waiting for confirmation, nothing more.
drop policy if exists givings_insert_eft_report on givings;
create policy givings_insert_eft_report on givings
  for insert with check (
    user_id = auth.uid()
    and church_id = current_church_id()
    and method = 'eft'
    and status = 'reported'
    and confirmed_by is null and confirmed_at is null
    and stripe_checkout_session_id is null and stripe_payment_intent_id is null
    and amount_cents between 100 and 10000000          -- R1 to R100 000
    and paid_on <= current_date and paid_on >= current_date - 366
  );

-- Members: remove their own report while it's still waiting (typos).
drop policy if exists givings_delete_own_report on givings;
create policy givings_delete_own_report on givings
  for delete using (user_id = auth.uid() and method = 'eft' and status = 'reported');

-- ----------------------------------------------------------------------------
-- 3. Church admins confirm a reported transfer
-- ----------------------------------------------------------------------------
-- p_outcome: 'received' (optionally with the amount that actually arrived) or
-- 'not_received'. p_expected_updated_at: the gift's updated_at when the admin
-- loaded it — if it changed since (another admin acted, or the member deleted
-- it), nothing is written.
-- Returns 'ok' | 'not_found' | 'changed' | 'invalid'. A gift in another church
-- reads as 'not_found', so the function can't be used to probe other churches.
create or replace function confirm_eft_gift(
  p_gift uuid, p_outcome text, p_amount_cents integer, p_expected_updated_at timestamptz
) returns text as $$
declare
  g givings;
begin
  if p_outcome not in ('received', 'not_received') then return 'invalid'; end if;

  select * into g from givings where id = p_gift for update;
  if not found or g.method <> 'eft' or not is_church_admin(g.church_id) then return 'not_found'; end if;
  if g.status <> 'reported' or g.updated_at is distinct from p_expected_updated_at then return 'changed'; end if;
  if p_outcome = 'received' and (p_amount_cents is null or p_amount_cents < 100 or p_amount_cents > 10000000) then
    return 'invalid';
  end if;

  update givings set
    status = case when p_outcome = 'received' then 'succeeded' else 'not_received' end,
    amount_cents = case when p_outcome = 'received' then p_amount_cents else amount_cents end,
    confirmed_by = auth.uid(),
    confirmed_at = now()
  where id = p_gift;

  insert into audit_logs (church_id, actor_id, action, target_table, target_id, metadata)
  values (g.church_id, auth.uid(), 'giving.eft_' || p_outcome, 'givings', g.id,
    jsonb_build_object('reported_cents', g.amount_cents, 'received_cents', case when p_outcome = 'received' then p_amount_cents end));
  return 'ok';
end;
$$ language plpgsql volatile security definer set search_path = public;

revoke all on function confirm_eft_gift(uuid, text, integer, timestamptz) from public;
grant execute on function confirm_eft_gift(uuid, text, integer, timestamptz) to authenticated;

revoke all on all functions in schema app_private from public;
