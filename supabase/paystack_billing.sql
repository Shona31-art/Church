-- ============================================================================
-- MIGRATION #34 — Online billing: church subscriptions paid with Paystack.
-- Run after email_sync.sql (#33). Plan: docs/plans/paystack-billing.md.
--
-- In plain language:
--   * church_subscriptions gains the Paystack customer and subscription codes
--     for a church that pays online, plus the token Paystack needs to cancel
--     it. Only the server writes these (church admins still can't change
--     their own subscription row — schema.sql's rule is unchanged).
--   * New table billing_payments: one row per subscription payment (the first
--     one from the Billing page, and every monthly renewal Paystack charges).
--     A church's admins can read their own church's payments (their invoice
--     history); nobody can write them from the browser — only the server,
--     after asking Paystack what really happened.
--   * A payment reference can only ever be recorded once, so a payment that
--     arrives twice (return page + webhook) can't extend a plan twice.
-- Safe to re-run.
-- ============================================================================

alter table church_subscriptions add column if not exists paystack_customer_code     text;
alter table church_subscriptions add column if not exists paystack_subscription_code text;
alter table church_subscriptions add column if not exists paystack_email_token       text;
-- When the church asked Paystack to stop renewing (access continues until billing_date).
alter table church_subscriptions add column if not exists cancelled_at               timestamptz;

alter table church_subscriptions drop constraint if exists church_subscriptions_paystack_customer_check;
alter table church_subscriptions add constraint church_subscriptions_paystack_customer_check
  check (paystack_customer_code is null or paystack_customer_code ~ '^CUS_[A-Za-z0-9]+$');
alter table church_subscriptions drop constraint if exists church_subscriptions_paystack_subscription_check;
alter table church_subscriptions add constraint church_subscriptions_paystack_subscription_check
  check (paystack_subscription_code is null or paystack_subscription_code ~ '^SUB_[A-Za-z0-9]+$');

create unique index if not exists idx_church_subscriptions_paystack_customer
  on church_subscriptions(paystack_customer_code) where paystack_customer_code is not null;
create unique index if not exists idx_church_subscriptions_paystack_subscription
  on church_subscriptions(paystack_subscription_code) where paystack_subscription_code is not null;

create table if not exists billing_payments (
  id              uuid primary key default uuid_generate_v4(),
  church_id       uuid not null references churches(id) on delete cascade,
  plan_key        plan_key not null check (plan_key in ('basic', 'premium')),
  amount_cents    integer not null check (amount_cents > 0),
  currency        text not null default 'ZAR' check (currency = 'ZAR'),
  -- 'gbsub-<uuid>' for checkouts started in the app; Paystack's own reference for renewals.
  reference       text not null unique check (char_length(reference) between 6 and 100),
  status          text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  -- 'checkout' = started from the Billing page; 'renewal' = Paystack's monthly charge.
  kind            text not null default 'checkout' check (kind in ('checkout', 'renewal')),
  -- The period this payment covers (set when it succeeds).
  period_end      timestamptz,
  started_by      uuid references app_users(id) on delete set null,
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_billing_payments_church on billing_payments(church_id, created_at desc);

alter table billing_payments enable row level security;

drop policy if exists billing_payments_select on billing_payments;
create policy billing_payments_select on billing_payments
  for select using (is_super_admin() or (church_id = current_church_id() and is_church_admin(church_id)));
-- No insert/update/delete policies on purpose: server (service role) only.
