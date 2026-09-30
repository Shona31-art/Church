-- ============================================================================
-- GIVING — one-time donations via Stripe Checkout (payment mode, separate
-- from the church's own SaaS subscription which uses subscription mode).
-- ============================================================================

insert into modules (key, name, description) values
  ('giving', 'Online Giving', 'Accept tithes and offerings via card, tracked per fund');

insert into plan_modules (plan_key, module_key) values
  ('free_trial', 'giving'),
  ('basic', 'giving'),
  ('premium', 'giving'),
  ('enterprise', 'giving'),
  ('sponsored', 'giving');

create table givings (
  id                      uuid primary key default uuid_generate_v4(),
  church_id               uuid not null references churches(id) on delete cascade,
  user_id                 uuid references app_users(id),
  amount_cents            integer not null,
  currency                text not null default 'zar',
  fund                    text not null default 'general',
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  status                  text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  created_at              timestamptz not null default now()
);

create index idx_givings_church on givings(church_id, created_at desc);
create index idx_givings_user on givings(user_id);
create index idx_givings_stripe_session on givings(stripe_checkout_session_id);

alter table givings enable row level security;

create policy givings_select on givings
  for select using (
    is_super_admin()
    or user_id = auth.uid()
    or (church_id = current_church_id() and exists (select 1 from app_users where id = auth.uid() and role = 'church_admin'))
  );

-- No insert/update policy for ordinary users — rows are created by the
-- checkout-initiation server action and updated by the Stripe webhook only,
-- both using elevated access. A giving record's "succeeded" status must
-- come from a real Stripe event, never a client-side claim.
