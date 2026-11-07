-- ============================================================================
-- Giving v2 (migration #65): PayShap and the church's own payment link
-- ============================================================================
-- In plain language:
--   * Besides the bank account (#30) and cards (#31), a church can give
--     members two cheaper ways to pay:
--       - PayShap: an instant bank payment to the church's PayShap ID
--         (usually a cellphone number linked to its bank account). Free or a
--         few rand, paid by the giver's bank — no provider in between.
--       - The church's own payment link, e.g. a SnapScan, Zapper or Yoco link
--         it already has (the church pays that provider's fees directly).
--   * Members pay, then record the gift as before ("I've paid"); church
--     admins confirm it once it arrives. givings.channel says how it came in.
--   * Only church admins can change these; every change is audit-logged.
-- Safe to run more than once.
-- ============================================================================

create table if not exists church_payment_options (
  church_id   uuid primary key references churches(id) on delete cascade,
  payshap_id  text check (payshap_id is null or char_length(btrim(payshap_id)) between 3 and 60),
  link_label  text check (link_label is null or char_length(btrim(link_label)) between 2 and 40),
  link_url    text check (link_url is null or (char_length(link_url) <= 500 and link_url ~ '^https://[^[:space:]]{4,}$')),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users(id) on delete set null
);
alter table church_payment_options enable row level security;

drop policy if exists payment_options_select on church_payment_options;
create policy payment_options_select on church_payment_options
  for select using (church_id = current_church_id());
drop policy if exists payment_options_insert on church_payment_options;
create policy payment_options_insert on church_payment_options
  for insert with check (church_id = current_church_id() and is_church_admin(church_id));
drop policy if exists payment_options_update on church_payment_options;
create policy payment_options_update on church_payment_options
  for update using (church_id = current_church_id() and is_church_admin(church_id))
  with check (church_id = current_church_id() and is_church_admin(church_id));
drop policy if exists payment_options_delete on church_payment_options;
create policy payment_options_delete on church_payment_options
  for delete using (church_id = current_church_id() and is_church_admin(church_id));

-- How a recorded gift was paid: bank transfer, PayShap or the church's link.
alter table givings add column if not exists channel text;
alter table givings drop constraint if exists givings_channel_check;
alter table givings add constraint givings_channel_check check (channel is null or channel in ('bank', 'payshap', 'link'));

-- Changes to where money goes are always audit-logged (activity_log.sql #42).
do $$
begin
  if to_regprocedure('public.audit_row_change()') is not null then
    drop trigger if exists trg_audit_church_payment_options on church_payment_options;
    create trigger trg_audit_church_payment_options after insert or update or delete on church_payment_options
      for each row execute function public.audit_row_change('payment_options');
  end if;
end $$;

-- Every church admin hears when these change (like the bank details), so a
-- payment link or PayShap ID can't be quietly pointed somewhere else.
create or replace function app_private.on_payment_options_changed()
returns trigger as $$
declare
  actor_name text := (select name from app_users where id = auth.uid());
  row church_payment_options := coalesce(new, old);
begin
  perform app_private.notify(
    array(select id from app_users where church_id = row.church_id and role = 'church_admin' and status = 'active'),
    row.church_id, 'alerts', 'giving.payment_options_changed',
    'Giving options changed',
    coalesce(actor_name, 'Someone') || ' changed the PayShap or payment link members see on the Giving page. If you didn''t expect this, check them now.',
    '/dashboard/setup/giving', null);
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_payment_options_changed on church_payment_options;
create trigger trg_payment_options_changed after insert or update or delete on church_payment_options
  for each row execute function app_private.on_payment_options_changed();
