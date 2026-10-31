-- ============================================================================
-- Plans v3 (migration #41)
-- ============================================================================
-- In plain language:
--   * Basic stays as it is (R299/month, up to 50 members).
--   * Premium is for churches of 50 to 150 members (R799/month, AI tools).
--   * Unlimited (the old "Enterprise" slot): R1,300/month, unlimited members
--     and every feature, and churches can now pay for it online.
--   * Online payments can be recorded for the Unlimited plan too.
--   * Yearly billing: each plan has a yearly price (two months free), and a
--     church's subscription and payments remember monthly vs yearly.
-- Churches already on a plan keep it. Safe to run more than once.
-- ============================================================================

update plans set member_limit = 150, description = 'For churches of 50 to 150 members, with AI tools' where key = 'premium';

update plans
   set name = 'Unlimited',
       monthly_price = 1300,
       member_limit = null,
       description = 'Unlimited members and every feature'
 where key = 'enterprise';

-- Every feature the app has, now and later (all modules) — Unlimited means everything.
insert into plan_modules (plan_key, module_key)
select 'enterprise', key from modules
on conflict do nothing;

alter table billing_payments drop constraint if exists billing_payments_plan_key_check;
alter table billing_payments add constraint billing_payments_plan_key_check check (plan_key in ('basic', 'premium', 'enterprise'));

alter table plans add column if not exists yearly_price numeric(10,2);
update plans set yearly_price = monthly_price * 10 where key in ('basic', 'premium', 'enterprise') and yearly_price is null;

alter table church_subscriptions add column if not exists billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'yearly'));
alter table billing_payments add column if not exists interval text not null default 'monthly' check (interval in ('monthly', 'yearly'));
