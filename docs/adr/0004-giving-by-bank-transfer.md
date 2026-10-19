# ADR-0004: Giving by bank transfer (EFT) first; card payments later via Paystack

**Status:** Accepted (2026-10-19)
**Date:** 2026-10-19
**Deciders:** Product owner (Vishona)

## Context

Giving and Billing were built on Stripe, but neither has ever been switched
on. Two problems surfaced when setting them up:

1. **Stripe is unlikely to accept a South African organisation.** Stripe lists
   South Africa only as an "extended network" country; independent sources say
   South African-registered organisations can't open a normal account.
2. **Every church's card gifts would land in one account** — the platform's.
   With more than one church, the platform would be holding and paying out
   other churches' tithes: a legal, tax and trust problem.

Today there is one church (KAMI, on lifetime Enterprise), so there is no
subscription income to collect yet.

## Options considered

| | A. EFT now, card later (chosen) | B. Paystack now | C. PayFast now | D. Stripe via a foreign company |
|---|---|---|---|---|
| Cost | Free | % per card gift, no monthly fee | % per card gift | Company + accounting costs, USD settlement |
| Money goes to | Each church's own bank | Each church, via subaccounts (to confirm for SA) | Each church only with split payments | Platform, then paid out |
| Verified automatically | No — treasurer confirms | Yes | Yes | Yes |
| Build effort | Small (one migration, Giving page + report) | Rewrite of giving + billing payments | Rewrite | Small code change, large admin |
| Familiar to SA churches | Very | Yes | Very | No |

## Decision

**A.** Members give by bank transfer to their church's own account using a
personal reference, record the gift in the app, and a church admin confirms it
against the bank statement. Only confirmed gifts count in totals and reports.

Billing stays manual (Super Admin plan changes, EFT invoices) until a paying
church signs up. When card payments are needed, add **Paystack** (owned by
Stripe, handles rand, subscriptions, and subaccounts so card gifts go to each
church) — after confirming with Paystack that subaccounts work for South
African merchants. The existing Stripe code stays in place but switched off
until Paystack replaces it.

## Consequences

- **Easier:** no fees; no provider account; no platform custody of church
  money; works for any number of churches.
- **Harder:** gifts are self-reported until confirmed (a few minutes a week for
  a church admin); no card giving yet.
- **Risks:**
  - *Changed bank details* (an admin account taken over and the account
    number swapped) would send members' money to the wrong place. Mitigated
    by an audit-log entry and a bell notification to every church admin on
    any change, and a "details last changed" date shown to members.
  - *Inflated self-reports* can't affect anything: totals and reports only
    count gifts an admin confirmed, and members can't confirm their own.
- **Revisit when:** the first church pays a subscription, or members ask to
  give by card.

## Update (2026-10-19): card giving added via Paystack

Brought forward at the product owner's request. Each church becomes a
Paystack subaccount (0 % platform share, Paystack's fee borne by the church's
share unless the member adds it), so card gifts settle to the church's own
bank account. Billing subscriptions stay manual for now. Stripe is removed.
Details: `docs/plans/paystack-card-giving.md`.
