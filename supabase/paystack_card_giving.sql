-- ============================================================================
-- MIGRATION #31 — Card giving with Paystack. Run after eft_giving.sql (#30).
-- Plan: docs/plans/paystack-card-giving.md (and ADR-0004's update).
--
-- In plain language:
--   * New table church_card_giving: each church's Paystack "subaccount" — the
--     link that sends card gifts to the church's own bank account. Members of
--     the church can see whether card giving is on. NOBODY can change it from
--     the browser: only the server writes it, after checking the person is a
--     church admin — so a church's card money can't be pointed elsewhere.
--   * If a church's bank details change, card giving switches off until an
--     admin turns it on again (re-linking Paystack to the new account), and
--     that's audit-logged. Card money can never go to an old account.
--   * givings gains provider ('stripe' | 'paystack'), provider_reference
--     (unique) and fee_cents (card fee a member chose to add). Existing card
--     gifts are labelled 'stripe'.
-- Safe to re-run.
-- ============================================================================

create table if not exists church_card_giving (
  church_id         uuid primary key references churches(id) on delete cascade,
  subaccount_code   text not null check (subaccount_code ~ '^ACCT_[A-Za-z0-9]+$'),
  bank_code         text not null check (bank_code ~ '^[0-9]{6}$'),
  account_ending    text not null check (account_ending ~ '^[0-9]{4}$'),
  enabled           boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references app_users(id) on delete set null
);

alter table church_card_giving enable row level security;

drop policy if exists card_giving_select on church_card_giving;
create policy card_giving_select on church_card_giving
  for select using (church_id = current_church_id());
-- No insert/update/delete policies on purpose: server (service role) only.

drop trigger if exists trg_card_giving_updated_at on church_card_giving;
create trigger trg_card_giving_updated_at before update on church_card_giving
  for each row execute function set_updated_at();

-- Bank details changed → card giving off until re-linked.
create or replace function app_private.on_giving_bank_changed()
returns trigger as $$
begin
  if new.account_number is distinct from old.account_number
     or new.branch_code is distinct from old.branch_code
     or new.account_name is distinct from old.account_name then
    update church_card_giving set enabled = false where church_id = new.church_id and enabled;
    if found then
      insert into audit_logs (church_id, actor_id, action, target_table, target_id, metadata)
      values (new.church_id, auth.uid(), 'card_giving.paused_bank_changed', 'church_card_giving', new.church_id,
              jsonb_build_object('account_ending', right(new.account_number, 4)));
    end if;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_giving_bank_changed on church_giving_details;
create trigger trg_giving_bank_changed after update on church_giving_details
  for each row execute function app_private.on_giving_bank_changed();

-- Card gifts: which provider, its reference, and any fee the member added.
alter table givings add column if not exists provider           text;
alter table givings add column if not exists provider_reference text;
alter table givings add column if not exists fee_cents          integer not null default 0;

alter table givings drop constraint if exists givings_provider_check;
alter table givings add constraint givings_provider_check check (provider is null or provider in ('stripe', 'paystack'));
alter table givings drop constraint if exists givings_fee_check;
alter table givings add constraint givings_fee_check check (fee_cents >= 0);

create unique index if not exists idx_givings_provider_reference on givings(provider_reference) where provider_reference is not null;

update givings set provider = 'stripe' where provider is null and method = 'card' and stripe_checkout_session_id is not null;

revoke all on all functions in schema app_private from public;
