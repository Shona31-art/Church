# Plan: notification bell and phone pop-ups

Status: **approved 2026-10-17**, in progress. Decision record:
[`docs/adr/0002-notifications.md`](../adr/0002-notifications.md).

## Agreed scope

- A **bell** in the app header (sidebar on desktop, top bar on phones) with
  a red unread count. Tapping it opens a panel of recent notifications;
  "See all" opens a full page.
- **Phone pop-ups** (Web Push) on phones and computers, switched on per
  device. On iPhone, this only works once the app is added to the Home Screen.
- Events: church news, messages, prayer & care, pastor/admin alerts (table
  in the ADR).
- Every plan (it costs nothing to run).

## Architecture

| Part | Where | Why |
|---|---|---|
| Creating notifications | Postgres triggers (security definer) | Can't be skipped; uses the same visibility rules as RLS |
| Bell + badge | Client component in `DashboardChrome`; first load from the server, live updates via Supabase Realtime | Count is right on first paint and updates without refreshing |
| Panel and page | Panel: client; `/dashboard/notifications`: server page, paginated | The page can be long; the panel shows the latest 15 |
| Mark read / read all / clear | Server actions (Zod) → RLS (own rows only) | Same pattern as the rest of the app |
| Push delivery | Supabase Database Webhook → `POST /api/notifications/push` (secret header) → `web-push` | No background worker needed on Vercel's free plan |
| Push on the device | `public/sw.js` gains `push` and `notificationclick` handlers | The service worker already exists (offline Bible) |
| Preferences | `notification_preferences` table, edited on My Account | Follows the person across devices |

**Flow, e.g. an announcement:** admin publishes → the trigger on
`announcements` inserts one notification for each member who can see it
(not the author) → Realtime pushes the row to anyone online, and their badge
goes up → the Database Webhook calls `/api/notifications/push` → it looks up
the person's devices and preferences and sends "New announcement: Youth camp"
→ tapping the pop-up opens the announcement and marks it read.

## Data model (migration #28 `supabase/notifications.sql`)

**`notifications`**

| Column | Notes |
|---|---|
| `id`, `user_id` → app_users (cascade), `church_id` | |
| `category` | `church_news`, `messages`, `prayer_care`, `alerts` (drives preferences) |
| `type` | e.g. `announcement.published`, `chat.message`, `booking.decided` |
| `title`, `body` | Short. **Never** message text, prayer text or counseling details |
| `link` | In-app path, e.g. `/dashboard/announcements/…` |
| `group_key` | Chats only: one live row per person per chat |
| `count` | How many events this row stands for (chat) |
| `actor_id` | Who caused it (for "from Ann"); null for system events |
| `read_at`, `created_at`, `updated_at` | |

- **RLS:** a person can select and mark-read their own rows, and delete
  them. There is **no insert policy**: only the triggers create
  notifications, so nobody can fake one through the API.
- Index on `(user_id, read_at, created_at desc)` for the badge and list.
- **Retention:** rows older than 90 days are deleted nightly by the existing
  cron route.

**`push_subscriptions`**: `id`, `user_id`, `endpoint` (unique), `p256dh`,
`auth`, `user_agent`, `created_at`, `last_used_at`. Own rows only. Deleted
automatically when a push service reports the device is gone (HTTP 404/410).

**`notification_preferences`**: `user_id` (primary key), and per category
`push_church_news`, `push_messages`, `push_prayer_care`, `push_alerts`
(default on). The bell always shows everything, so turning a category off
only stops pop-ups. (Chats can already be muted individually; muted chats
create nothing.)

**POPIA:** all three tables are added to the member data export and are
deleted with the member.

## Who gets what (enforced in the triggers)

| Event | Recipients | Never |
|---|---|---|
| Announcement published (draft → published, or created published) | Active members of that church; for a department announcement, that department's members plus pastors/admins | The author; disabled accounts |
| Event added | Same rule using the event's department | The creator |
| Chat message | DM: the other person. Channel: everyone who can access it (members-only channels: members, plus pastors/admins) | The sender; anyone who muted the chat; anyone who blocked the sender |
| Someone prayed for / commented on your prayer | The prayer's owner | The owner themselves |
| Booking decided | The requester | |
| New booking request | The requested pastor, or every pastor/admin if "any pastor" | |
| Support ticket reply | The ticket's creator | The replier |
| Counseling crisis escalation | Pastors and church admins of the church | The member (no details in the text) |
| New member joins (becomes active) | Church admins | The new member |

| Action | Member | Pastor | Church admin | Super admin |
|---|---|---|---|---|
| See / read / clear **own** notifications | Yes | Yes | Yes | Yes |
| See anyone else's | No | No | No | No |
| Create a notification directly | No (triggers only) | No | No | No |
| Register this device for pop-ups; change own preferences | Yes | Yes | Yes | Yes |

## Screens

1. **Bell** (header): badge with the number (99+ above 99) and screen-reader
   text "Notifications, 3 unread".
2. **Panel:** the latest 15, unread ones marked with a dot and bold text,
   relative times ("5 min ago"), "Mark all as read", "See all". Tapping an
   item marks it read and opens its link. Empty state: "You're all caught up."
3. **`/dashboard/notifications`:** the full list, 30 per page, filter
   All / Unread, "Clear read notifications" (with confirmation).
4. **My Account → Notifications:** "Phone pop-ups on this device" (Turn on
   asks the browser for permission; it explains if permission was blocked
   or the device can't do it, e.g. iPhone not on the Home Screen), plus the
   four category switches.

## Files

```
supabase/notifications.sql                    migration #28 (tables, RLS, triggers, cleanup fn), plain-language header
tests/db/notifications.test.ts                recipients per event, sender/muted/blocked excluded, RLS
lib/notifications.ts                          types, category labels, relative time (unit tested)
app/dashboard/notifications/page.tsx          full list
app/dashboard/notifications/actions.ts        mark read, read all, clear (Zod)
components/notifications/NotificationBell.tsx bell + panel + Realtime
components/notifications/PushSettings.tsx     device switch + categories (My Account)
app/api/notifications/push/route.ts           webhook → web-push (secret-checked)
app/api/notifications/subscribe/route.ts      save / remove this device's subscription
public/sw.js                                  + push / notificationclick handlers
app/api/cron/expire-chat-media/route.ts       + delete notifications older than 90 days
```

**New package:** `web-push` (pinned), for VAPID signing and payload
encryption. See the ADR for the maintenance check.

**New environment variables** (documented in `.env.example`):
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
(mailto:), and `NOTIFICATIONS_WEBHOOK_SECRET`. I'll give you a one-line
command to generate the VAPID keys.

**Manual setup per Supabase project:** Database → Webhooks → on
`notifications` INSERT → POST to `https://<site>/api/notifications/push`
with header `x-webhook-secret`. Step-by-step instructions go in the README.

## Build order and check-ins

1. **Migration #28 + trigger and RLS tests.** **Stop:** run it in Supabase;
   these are the who-gets-told rules.
2. **Bell, panel, page, live badge.** **Stop:** a new pattern on every
   screen, so review the look.
3. **Phone pop-ups:** package, keys, subscriptions, worker, API routes,
   settings. **Stop:** needs an HTTPS link (Vercel Preview) to test on a
   phone, the same blocker as offline Bible.
4. **Cleanup cron, README, data export.** *Batch report.*

## Risks and trade-offs

- **Big churches and busy channels:** grouping means one row per person per
  chat, but a church-wide channel with 500 members still writes about 500
  rows on the first message after everyone has read. That's fine for
  Postgres; revisit above roughly 2,000 members.
- **Push needs setup** (keys and webhook) and HTTPS. Without them, everything
  except pop-ups works.
- **iPhone:** pop-ups only for Home Screen apps, iOS 16.4+, and the app
  icon is still a placeholder (no logo yet).
- **Realtime connection limit** on Supabase's free tier (see ADR).
- **Not in this round:** email/WhatsApp (possible later via the existing
  Make.com webhook), per-chat push settings beyond mute, a quiet-hours
  setting, and birthday reminders.
