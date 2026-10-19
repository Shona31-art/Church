# Members change their own email — plan

Status: **BUILT** (2026-10-19), approved. Change from the plan: no "Cancel this change" button — Supabase offers no reliable way for a member to withdraw a pending change, so the page says the links simply expire, and a new request replaces the old one. Closes the README gap
"Member email changes aren't supported in the app".

## Why it needs care

The email address is the sign-in. A careless change flow lets someone who
borrows an unlocked phone take over an account, or locks a person out with a
typo. So: prove it's you, confirm by email, tell the old address, and keep the
app's copy of the email in step with the sign-in.

## Workflow

1. **My account → Email address**: shows the current address. Fields: new
   email, **current password**. (The password check proves it's the account
   owner, not someone holding an unlocked phone.)
2. Server: checks the password without touching the person's session, rejects
   "same as current", then asks Supabase Auth to change the email. Supabase
   emails a confirmation link — with **Secure email change** on (Supabase's
   default), to **both** the old and the new address, and the change only
   happens once both are confirmed. The old address is therefore always told.
3. While waiting, My account shows "Waiting for confirmation: new@… — check
   both inboxes", with **Cancel this change** (sets the email back to the
   current one, which withdraws the pending change).
4. The link brings the person back to My account
   (`/auth/confirm-email` → `/dashboard/account`), which shows the real state.
   Opening the link on another device still completes the change; it just
   doesn't sign them in there.
5. When Supabase switches the sign-in email, a database trigger copies it to
   `app_users.email` (used for member lists, receipts and Paystack), and
   writes an audit-log entry (both addresses masked, e.g. `vi***@gmail.com`).

Church admins still can't change a member's email (the member form keeps it
read-only, now with "members change it themselves in My account"); the
platform admin can still do it in Supabase if someone has lost access to
their old inbox.

## Changes

- `supabase/email_sync.sql` (migration #33): trigger on `auth.users` email
  change → `app_users.email` + audit. Test in `tests/db/email-sync.test.ts`.
- `app/dashboard/account/` — Email address section, `requestEmailChange` and
  `cancelEmailChange` actions (Zod-validated; password re-check with a
  throwaway client that saves no session).
- `app/auth/confirm-email/route.ts` — finishes the link, then My account.
- README: how to check **Secure email change** is on (Supabase → Auth →
  Providers → Email), the redirect URL to allow, migration #33, gap removed.

## Risks

- I can't see your Supabase settings: if **Secure email change** is off, only
  the new address gets a link. The README step asks you to confirm it's on.
- Supabase's own email sending is heavily rate-limited until custom SMTP is
  set up (already a README launch item).
