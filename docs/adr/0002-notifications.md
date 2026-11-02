# ADR-0002: Notifications are created by database triggers; phone pop-ups go out through a webhook to an API route

**Status:** Accepted (2026-10-17)
**Date:** 2026-10-17
**Deciders:** Product owner (Vishona)

## Context

Members want a notification bell, plus phone pop-ups (Web Push) when the app
isn't open, for four groups of events:

| Group | Events | Who is told |
|---|---|---|
| Church news | Announcement published; event added to the calendar | Everyone who can see it (church-wide, or that department) |
| Messages | New direct message; new message in a chat you belong to | The other people in that chat, unless they muted it or blocked the sender |
| Prayer & care | Someone prays for or comments on your prayer; your pastor booking is approved or declined; a reply on your support ticket | The person it's about |
| Pastor/admin alerts | Crisis escalation in counseling; new booking request; a new member joins | Pastors / church admins of that church |

Constraints:
- **Zero running cost.** The feature should work on every plan.
- **Never notify someone who couldn't see the item** (e.g. a department
  announcement must not reach other departments, and a blocked sender must
  not reach the person who blocked them).
- These events are created in many places: server actions, database
  functions, the Stripe webhook, the seed script. Notifications must not be
  missed because one code path forgot to call a helper.
- Vercel's free plan only allows cron jobs **once a day**, so a background
  "send every minute" worker isn't available.

## Decision

1. **Postgres triggers create the bell notifications.** Each source table
   (announcements, events, chat_messages, prayer_intercessions,
   prayer_comments, pastor_bookings, support_ticket_messages,
   counseling_escalations, app_users) gets an `after insert/update` trigger
   that inserts rows into a new `notifications` table for exactly the right
   people. Triggers use the same visibility rules as the existing RLS
   policies, inside the database.
2. **Chat is grouped.** A busy channel creates one notification per person
   per chat, which counts up ("5 new messages in General") until read,
   instead of one row per message per member.
3. **The bell updates live** through Supabase Realtime on `notifications`
   (already used by chat), with owner-only RLS.
4. **Phone pop-ups:** a Supabase **Database Webhook** on `notifications`
   inserts calls `POST /api/notifications/push`, which checks a shared
   secret and sends Web Push to that person's registered devices, using the
   `web-push` package and our own VAPID keys. No third-party notification
   service is involved. If the webhook isn't set up, the bell still works
   fully; only pop-ups are missing.

## Options Considered

### A: App code creates notifications (a helper called from each server action)
| Dimension | Assessment |
|---|---|
| Complexity | Low per event, but spread over ~10 actions |
| Cost | Free |
| Reliability | Misses any path that doesn't call the helper (DB functions, scripts, future features) |
| Familiarity | High |

**Pros:** Plain TypeScript; easy to debug.
**Cons:** Easy to forget. Visibility rules would be re-implemented in
TypeScript next to the RLS policies, risking drift between the two.

### B: Database triggers create notifications; webhook sends push (recommended)
| Dimension | Assessment |
|---|---|
| Complexity | Medium: SQL triggers, one API route |
| Cost | Free (Supabase triggers, Realtime, webhooks; Web Push is free) |
| Reliability | Can't be skipped: every insert, from any path, is covered |
| Familiarity | Medium: the project already uses triggers and security-definer functions |

**Pros:** One place, next to the RLS rules it must mirror; testable with the
existing PGlite suite. The bell works even without push configured.
**Cons:** Logic lives in SQL. The webhook is a manual Supabase dashboard step
per environment, documented in the README.

### C: A third-party service (OneSignal, Firebase Cloud Messaging, Novu)
| Dimension | Assessment |
|---|---|
| Complexity | Low to medium |
| Cost | Free tiers exist; paid at scale; another vendor and data processor (POPIA) |
| Reliability | High |
| Familiarity | Low |

**Pros:** Delivery dashboards, retries.
**Cons:** Sends member data to another processor; vendor lock-in; overkill
for in-app plus Web Push.

## Trade-off Analysis

B puts the "who may be told" logic in the same place as the "who may see"
logic, the RLS policies, and it's the only option that can't miss an event
regardless of which code path created it. The SQL is more work than a
TypeScript helper, but the existing database test suite can prove each
trigger notifies exactly the right people. That's the property that matters
most for a church app handling prayer and counseling.

**`web-push` package:** MPL-2.0, very widely used. The last release was
January 2024: the Web Push protocol hasn't changed since, and the package is
feature-complete rather than abandoned. Writing VAPID signing and payload
encryption ourselves would be riskier than using it. We'll pin the version
and revisit if a security advisory appears.

## Consequences

- **Easier:** adding a new notification is one trigger plus one test. The
  bell works with zero setup.
- **Harder:** push requires three env vars (VAPID keys) and a Database
  Webhook in each Supabase project. iPhones only get pop-ups when the app is
  added to the Home Screen (iOS 16.4+).
- **Privacy:** push payloads are encrypted end to end by the Web Push
  standard, so Google, Apple and Mozilla relay them without being able to
  read them. Even so, payloads carry no message text, prayer text or
  counseling details: just "New message from Ann", "A pastor is needed in
  counseling", and a link.
- **Revisit:** the Realtime free tier allows 200 concurrent connections
  across all churches (chat and the bell share it). Upgrade the Supabase
  plan before that's reached.

## Action Items

1. [ ] Migration #28 `notifications.sql`: tables, RLS, triggers, cleanup function
2. [ ] RLS and trigger tests (exactly the right recipients, never the sender, muted/blocked respected)
3. [ ] Bell, live badge, notifications page
4. [ ] Web Push: subscriptions, service worker handlers, `/api/notifications/push`, settings
5. [ ] Nightly cleanup of notifications older than 90 days (existing cron)

## Update (migration #48, `chat_notifications_v2.sql`): message previews

The church asked for notifications that work like WhatsApp's, so the "no
message text" rule above is relaxed **for chat messages only**:

- Message pop-ups and bell items show the latest message ("Alice: See you at
  6"; voice notes and photos as "🎤 Voice message" / "📷 Photo"), cut to 140
  characters. Prayer, counselling and care notifications still never carry
  their content.
- Each person can turn this off (My account → Notifications → "Show message
  text"); then they get the old "Sent you a message" wording. Recommended for
  shared phones and lock screens others can see.
- The text lives only in the recipient's own notification rows (private by
  RLS, deleted after 90 days), and in the encrypted Web Push payload. A message
  deleted or edited before it's read has its preview replaced.
- The webhook now also sends UPDATEs, so each new message in a chat updates
  that chat's one pop-up ("Alice (3 messages)"), with a "Mark as read" button.
