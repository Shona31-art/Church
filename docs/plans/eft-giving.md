# Giving by bank transfer (EFT) — plan

Status: **BUILT** (2026-10-19). Approved with: church admins only confirm; dashboard count, no bell per gift. Decision record:
`docs/adr/0004-giving-by-bank-transfer.md`.

## Workflow

1. **Church admin** (once): Church settings → *Bank details for giving* —
   account name, bank, account number, branch code, account type, and a short
   reference prefix (default from the church name, e.g. `KAMI`). Saving asks
   for confirmation, is audit-logged, and puts a bell notification in front
   of every church admin ("Bank details for giving were changed by …").
2. **Member**: Giving page shows the church's bank details with copy buttons
   and **their own reference** (prefix + a stable 6-character code from their
   account, e.g. `KAMI-3F9A2C`, so the treasurer knows who paid).
3. **Member** pays in their own banking app, then taps **I've made a transfer**:
   amount, fund, date paid (today by default, not in the future). The gift
   appears in their history as **Waiting for confirmation**. They can delete
   it while it's still waiting (typos).
4. **Church admin**: Giving report → *Waiting for confirmation* list (name,
   reference, amount, fund, date paid). For each: **Mark received** (may
   correct the amount to what arrived) or **Not received**. Both ask first,
   record who and when, and the member's history updates.
5. **Totals** (the member's "given this year", the report, the CSV, the
   dashboard stat) count **received** gifts only — exactly as today.
6. The dashboard's *Needs your attention* gains "Gifts waiting for
   confirmation" for church admins.

No card form unless a payment provider is configured (the Stripe form stays
in the code, hidden, until Paystack replaces it).

## Data model — migration #30 `supabase/eft_giving.sql`

**New table `church_giving_details`** (one row per church; not personal data):
`church_id` (PK, FK churches, cascade), `account_name`, `bank_name`,
`account_number`, `branch_code`, `account_type`, `reference_prefix`,
`created_at`, `updated_at`, `updated_by`.
- RLS select: members of that church (and nobody else, not the platform).
- RLS insert/update: that church's `church_admin` only. No delete (clear the
  fields instead) — keeps history in the audit log.
- Trigger: audit-log row + bell notification to each church admin on change.

**`givings` — added columns** (existing card rows unchanged):
`method` (`card` | `eft`, default `card`), `reference`, `paid_on` (date the
member says they paid), `confirmed_by`, `confirmed_at`, `updated_at`.
Status gains `reported` (waiting) and `not_received`; `succeeded` keeps
meaning "money received", so every existing total query stays correct.
Index on `(church_id, status)` for the waiting list.

**RLS (second layer behind the server actions):**
- Members may insert only their own row, in their own church, as
  `method = 'eft'`, `status = 'reported'`, with no confirmation fields.
- Members may delete only their own `reported` EFT rows.
- No direct updates. Confirming goes through a `security definer` function
  `confirm_eft_gift(gift_id, outcome, amount_cents, expected_updated_at)` that
  checks the caller is a church admin of that gift's church, that the gift is
  still `reported` and unchanged since it was loaded (two admins can't both
  act on it), then writes the status, confirmer and audit-log entry.

## Permissions

| Action | Member | Dept. leader | Pastor | Church admin | Super admin |
|---|---|---|---|---|---|
| See bank details + own reference | yes | yes | yes | yes | no |
| Record "I've made a transfer" | yes | yes | yes | yes | no |
| Delete own waiting gift | yes | yes | yes | yes | no |
| Edit bank details | no | no | no | yes | no |
| See waiting list, confirm / not received | no | no | no | yes | no |
| Report + CSV (received only, as today) | no | no | no | yes | no |

(Pastors don't see individual giving today; this keeps that.)

## Files

- `supabase/eft_giving.sql` (migration #30) + `tests/db/eft-giving.test.ts`
- `lib/giving.ts`: reference builder, bank-detail validation (Zod; account
  number 6–16 digits, branch code 6 digits), unit tests
- `app/dashboard/setup/` — bank details section + action
- `app/dashboard/giving/` — page, `BankDetails` (copy buttons), `ReportTransferForm`, history statuses, delete
- `app/dashboard/giving/report/` — waiting list + confirm actions; CSV adds method, reference, confirmed by/at
- `app/dashboard/page.tsx` — attention item
- README: setup steps, migration #30, Known gaps

## Out of scope (now)

Card payments (Paystack — later, per ADR-0004), Section 18A tax
certificates, bank-statement import / automatic matching, recurring pledges.

## Open questions

1. Should **pastors** also be able to confirm gifts, or church admins only?
2. Bell notification to church admins for each newly reported gift, or just
   the dashboard count (less noise)?
