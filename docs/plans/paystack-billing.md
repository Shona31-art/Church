# Online billing with Paystack subscriptions — plan

Status: **BUILT** (2026-10-30), awaiting a test-mode run against a real
Paystack account. Builds on `paystack-card-giving.md` (which deferred
billing "until the first church pays") and ADR-0004.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Provider | **Paystack subscriptions** (plans + monthly charges). | Already integrated for card giving; ZAR; one payment system. |
| Who receives the money | The platform's own Paystack balance (no subaccount). | Subscriptions are platform income; tithes stay with churches. |
| Plans online | **Basic** and **Premium** only. Lifetime, sponsored and price-override churches keep the manual route. | Custom terms need a person. |
| Prices | Paystack plan codes in env (`PAYSTACK_PLAN_BASIC/PREMIUM`); amounts must match the `plans` table, and a mismatch is never activated. | The catalogue stays in our database; Paystack is checked against it. |
| Activation | Only after verifying the transaction with Paystack (amount, currency, reference, our payment id, plan code). | Never trust a URL or webhook body. |
| Renewals | `charge.success` with Paystack's reference → verify → match church by customer code → record once (unique reference) → extend a month. | Retries can't double-extend. |
| Failed renewal | 7 days' grace (`status = grace`), Paystack keeps retrying; a later success clears it. | Matches the existing grace banner. |
| Cancel | Disable at Paystack; `cancelled_at` set; access continues to `billing_date`; the nightly job suspends afterwards. | Paid time is honoured; data is kept. |
| Plan change | Cancel, then subscribe to the other plan (new month starts then). | Avoids proration logic for now. |

## Pieces

- `supabase/paystack_billing.sql` (#34) — codes on `church_subscriptions`, `billing_payments` (+ RLS; tests `tests/db/paystack-billing.test.ts`).
- `lib/billing.ts` — pure rules (tests `tests/unit/paystack-billing.test.ts`).
- `lib/subscription-billing.ts` — settlement, renewals, grace, cancellation, nightly end.
- `lib/paystack.ts` — `initializeSubscriptionCheckout`, `fetchSubscription`, `disableSubscription`.
- `app/dashboard/billing/` — Subscribe / Cancel / payment history.
- `app/api/billing/paystack/return/route.ts`, `app/api/paystack/webhook/route.ts`, `app/api/cron/expire-chat-media/route.ts`.

## Before going live

Test mode: subscribe, renew (Paystack's test plans can use a short interval),
fail a renewal with a failing test card, cancel, and confirm the nightly job
suspends after the paid date.
