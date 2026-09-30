-- ============================================================================
-- BILLING — Stripe integration schema addition
-- ============================================================================

alter table church_subscriptions add column stripe_customer_id text;
alter table church_subscriptions add column stripe_subscription_id text;

create index idx_church_subscriptions_stripe_customer on church_subscriptions(stripe_customer_id);
create index idx_church_subscriptions_stripe_sub on church_subscriptions(stripe_subscription_id);
