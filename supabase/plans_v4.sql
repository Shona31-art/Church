-- ============================================================================
-- Plans v4 (migration #64): two plans — Grace and Grace Plus
-- ============================================================================
-- In plain language:
--   * Grace (plan key "basic"): R249 a month or R2,490 a year, up to 100
--     members. Every church feature, including the pastoral tools (Service
--     planner, Pastor booking, Pastoral care), plus AI writing help for
--     announcements, prayers, sermons, Bible study and poster wording (100 AI
--     requests a month).
--   * Grace Plus (plan key "premium"): R599 a month or R5,990 a year, up to
--     500 members (bigger churches ask the platform team for a price — every
--     member's photos, voice notes and files use storage). Everything in Grace, plus AI counselling, AI poster
--     pictures, calls, voice notes, photos in chat, sermon uploads, church
--     colours and priority support (1,000 AI requests a month).
--   * Unlimited ("enterprise") is no longer offered. Churches already on it
--     keep it (and its Paystack subscription) until they choose a new plan.
--   * AI poster pictures get their own switch (ai_pictures), so the cheaper
--     plan can have AI writing help without the costlier pictures.
--   Churches with a special price keep it. Prices can be changed any time in
--   Super Admin → Plans & prices. Remember to change the Paystack plans too.
-- Safe to run more than once.
-- ============================================================================

insert into modules (key, name, description) values
  ('ai_pictures', 'AI poster pictures', 'AI draws poster pictures (Poster Studio)')
on conflict (key) do nothing;

update plans
   set name = 'Grace', monthly_price = 249, yearly_price = 2490, member_limit = 100, ai_monthly_limit = 100,
       description = 'Everything your church needs, for up to 100 members'
 where key = 'basic';

update plans
   set name = 'Grace Plus', monthly_price = 599, yearly_price = 5990, member_limit = 500, ai_monthly_limit = 1000,
       description = 'For up to 500 members, with the full AI tools, calls, media and priority support. Bigger church? Ask us for a price.'
 where key = 'premium';

update plans set name = 'Unlimited (no longer offered)' where key = 'enterprise';

-- Grace: the pastoral tools and AI writing help.
insert into plan_modules (plan_key, module_key)
select 'basic', m from unnest(array['service_planner', 'pastor_booking', 'pastoral_care', 'ai_assist', 'bible_study_ai']) m
where exists (select 1 from modules where key = m)
on conflict do nothing;

-- Grace Plus: everything Unlimited had, plus AI pictures.
insert into plan_modules (plan_key, module_key)
select 'premium', module_key from plan_modules where plan_key = 'enterprise'
on conflict do nothing;

-- AI pictures: Grace Plus, the old Unlimited plan, the free trial and sponsored churches.
insert into plan_modules (plan_key, module_key)
select p::plan_key, 'ai_pictures' from unnest(array['premium', 'enterprise', 'free_trial', 'sponsored']) p
where exists (select 1 from plans where key::text = p)
on conflict do nothing;
