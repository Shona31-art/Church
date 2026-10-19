# Card giving with Paystack — plan

Status: **BUILDING** (2026-10-19). Decisions delegated to the developer by the
product owner ("do it as a senior developer"); they follow ADR-0004.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Scope | **Card giving now.** Church subscriptions (Billing) through Paystack when the first church pays. | No subscription income yet; halves the work and the testing. |
| Where the money goes | Each church is a Paystack **subaccount** with its own bank account. Card gifts settle there (rand, about 2 working days). | The platform never holds a church's tithes. |
| Platform share | **0 %** (`percentage_charge: 0`). | Taking a cut of tithes is a trust problem; income is subscriptions. |
| Who pays Paystack's fee | The church's share (`bearer: "subaccount"`). Members may tick **"Add the card fee"** so the church gets the full gift — shown only when the fee rate is configured. | Common in church giving; never a guessed number. |
| Stripe | **Removed** once Paystack works (giving and billing checkout); Billing shows plans and stays manual. | One payment system, no dead code. DB columns stay (no destructive change). |
| Bank transfers | Stay — free, alongside cards. | ADR-0004. |

Facts checked against Paystack's official OpenAPI spec (github.com/PaystackOSS/openapi,
2026-10-19) and the public bank list: ZAR supported; `GET /bank?country=south africa`
returns 33 banks whose `code` is the universal branch code; subaccount needs
`business_name`, `settlement_bank` (that code), `account_number`,
`percentage_charge`; `POST /transaction/initialize` takes `amount` in cents,
`currency`, `reference`, `callback_url`, `metadata`, `subaccount`, `bearer`,
`channels`; webhooks are signed with HMAC SHA-512 of the raw body using the
secret key (`x-paystack-signature`).

## Workflow

1. **Church admin, once:** Church settings → Bank details for giving (bank now
   picked from Paystack's South African list; branch code fills itself) →
   **Turn on card giving**. The server creates the church's Paystack
   subaccount from those details. Changing the bank details later switches
   card giving **off** until the admin turns it on again (so card money can
   never go to an old account); every admin is already notified of the change.
2. **Member:** Giving → **Give by card**: amount, fund, optional "Add the card
   fee". The server records a *pending* gift, then sends them to Paystack's
   secure page. Card details never touch the app.
3. **Back from Paystack:** the app asks Paystack directly whether that
   payment succeeded (works on localhost), marks the gift *received* or
   *failed*, and shows the result.
4. **Webhook** (`/api/paystack/webhook`, deployed app): Paystack's signed
   `charge.success` triggers the same check — so a member who closes the tab
   still gets their gift recorded. Both paths re-verify with Paystack and are
   idempotent; the gift is only ever marked received if Paystack confirms
   success, in rand, for exactly the expected amount and gift.
5. Card gifts appear in history, totals, report and CSV like confirmed
   transfers (method "Card").

## Data — migration #31 `supabase/paystack_card_giving.sql`

- **`church_card_giving`** (one row per church): `subaccount_code`,
  `bank_code`, `account_ending`, `enabled`, `created_at`, `updated_at`,
  `updated_by`. Readable by the church's members; **no write policies** — only
  the server (after checking the person is a church admin) writes it, so no
  one can point a church's card money at another account from the browser.
- Trigger: when `church_giving_details` changes bank or account number,
  `church_card_giving.enabled` becomes false (and it's audit-logged).
- **`givings`**: `provider` (`stripe` | `paystack`, null for transfers),
  `provider_reference` (unique), `fee_cents` (fee the member chose to add).

## Files

- `lib/paystack.ts` (server-only: initialize, verify, create/update
  subaccount, webhook signature; 15 s timeouts) + tests with mocked fetch
- `lib/banks-za.ts` (Paystack's list, snapshot 2026-10-19) + bank picker
- `lib/card-giving.ts` (`settlePaystackGift` — the one place a card gift
  becomes received) + tests
- `app/dashboard/setup/giving/` card-giving section + actions
- `app/dashboard/giving/` card form + action; `app/api/giving/paystack/return/route.ts`;
  `app/api/paystack/webhook/route.ts`; middleware lets the webhook through
- Stripe removal; README + `.env.example`

## Environment

`PAYSTACK_SECRET_KEY` (server only; `sk_test_…` for testing),
`PAYSTACK_FEE_PERCENT` and `PAYSTACK_FEE_FLAT_CENTS` (optional — copy from
Paystack's pricing page; without them the "add the fee" option is hidden).

## Verification

Unit tests for signature checks and settlement rules (wrong amount, wrong
currency, wrong gift, replays); DB tests for the new table's rules. With a
test key in `.env.local`: create a test subaccount and a test card payment
end to end. Webhooks need the deployed HTTPS URL.

## Out of scope

Billing subscriptions on Paystack, refunds in the app (done in Paystack's
dashboard), recurring card gifts.
