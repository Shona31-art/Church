-- ============================================================================
-- Billing v4 (migration #59): a cheaper Basic, payment reminders and receipts
-- ============================================================================
-- In plain language:
--   * Basic is now R250 a month (R2,500 a year), for up to 50 members, with the
--     everyday features: members, announcements, calendar, chats, the Bible,
--     prayer board, journal, Bible games, giving and support. The leadership
--     tools (Service planner, Pastor booking and Pastoral care) move to
--     Premium and up. Churches on Basic keep their data; those pages pause
--     until they upgrade.
--   * Payment reminders: the nightly job emails a church's pastors and admins
--     a few days before their payment date. This remembers which payment date
--     was reminded, so nobody gets the same reminder twice.
--   * Receipts: every successful payment gets an invoice number and a
--     thank-you email with the invoice; this remembers when it was sent.
-- Safe to run more than once.
-- ============================================================================

update plans
   set monthly_price = 250,
       yearly_price = 2500,
       description = 'The everyday church app for up to 50 members'
 where key = 'basic';

delete from plan_modules
 where plan_key = 'basic'
   and module_key in ('service_planner', 'pastor_booking', 'pastoral_care');

-- The payment date (billing_date) the last reminder was for.
alter table church_subscriptions add column if not exists reminder_sent_for timestamptz;

-- Invoice numbers count up from 1001, one per payment; receipts are emailed once.
alter table billing_payments add column if not exists invoice_no bigint;
create sequence if not exists billing_invoice_no_seq start 1001;
alter table billing_payments alter column invoice_no set default nextval('billing_invoice_no_seq');
update billing_payments set invoice_no = nextval('billing_invoice_no_seq') where invoice_no is null and status = 'succeeded';
create unique index if not exists idx_billing_payments_invoice_no on billing_payments(invoice_no) where invoice_no is not null;
alter table billing_payments add column if not exists receipt_sent_at timestamptz;
