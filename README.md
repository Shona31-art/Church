# Grace — by Grace-bound Ventures

A multi-church web app (Next.js 14 App Router + Supabase + Vercel) for church
admin, pastoral care, prayer, sermons, the Bible and giving. Each church's data
is isolated from every other church's by Postgres Row Level Security.

> ⚠ **Upgrading an existing database?** Run `supabase/platform_hardening.sql`
> now (after the files you already ran). It closes several real holes: anyone
> could join any direct-message conversation; any member could rewrite the plan
> catalogue and unlock paid features for every church; deactivated members kept
> full read access; and crisis escalations in AI counseling were silently never
> recorded. Older upgrades, if you haven't run them: `security_fix_app_users.sql`,
> `booking_security_fix.sql`, `support_security_fix.sql`.

---

## Quick start (local)

Prerequisites: Node 20+, pnpm (`corepack enable` picks up the pinned version),
a free Supabase project.

```bash
pnpm install
cp .env.example .env.local      # then fill in the values — see table below
pnpm dev                        # http://localhost:3000
```

Set up the database (next section), open http://localhost:3000 and click
**Start free trial** to create your church and admin login.

### Database setup (Supabase SQL Editor)

Run these files **in this exact order** (the test suite runs the same order —
`tests/db/harness.ts` — so if CI passes, this order works):

| # | File | What it adds |
|---|------|--------------|
| 1 | `schema.sql` | Churches, users, roles, plans, modules, audit log, core RLS |
| 2 | `security_fix_app_users.sql` | **Required.** Blocks role/church escalation; freezes `church_id` on all tables |
| 3 | `counseling_schema.sql` | AI counseling + crisis escalation |
| 4 | `personal_growth_schema.sql` | Prayer board + encrypted journal |
| 5 | `announcements_schema.sql` | Announcements |
| 6 | `events_schema.sql` | Calendar + RSVPs |
| 7 | `sermons_schema.sql` | Sermons + private sermon notes |
| 8 | `departments_policies.sql` | Department write policies |
| 9 | `service_booking_schema.sql` | Service planner + pastor booking |
| 10 | `poster_bible_support_schema.sql` | Posters, Bible bookmarks/notes, support desk |
| 11 | `chat_schema.sql` | Church & department chats |
| 12 | `dm_schema.sql` | Direct messages |
| 13 | `billing_schema.sql` | Stripe billing fields |
| 14 | `storage_policies.sql` | Support-ticket uploads |
| 15 | `bible_games_schema.sql` | Quiz + 40 seed questions |
| 16 | `bible_games_v2_schema.sql` | Church-specific questions, game types |
| 17 | `giving_schema.sql` | Giving records |
| 18 | `church_os_features_schema.sql` | Pastoral care log, birthdays, prayer wall, verse puzzle, AI rate limiting, member deletion fixes |
| 19 | `booking_security_fix.sql` | **Required.** Booking requests must start "pending"; availability locked to own church |
| 20 | `support_security_fix.sql` | **Required.** Support screenshots: own-folder uploads, 5 MB image-only limit |
| 21 | `platform_hardening.sql` | **Required.** DM, plan-catalogue and deactivated-account fixes; counseling escalation; announcement drafts; event & booking cancellation; Stripe webhook idempotency; makes the attachments bucket private |
| 22 | `chat_v2.sql` | **Required for chat v2.** Profile photos & About; edit/delete (soft) messages; replies, reactions, voice notes, read receipts; per-chat settings; DM privacy & blocking; admin chat restrictions; private `avatars` and `chat-media` buckets; `chat_photos` feature switch (off for every church). Plain-language notes at the top of the file |
| 23 | `plan_basic_v2.sql` | Basic = 50 members and only features with no running cost: adds Bible reader, Service planner, Pastor booking and text chat to Basic; new `ai_assist` (AI writing help) and `chat_voice` (voice notes) switches kept on every other plan that had them |
| 24 | `bible_games_v3.sql` | Game levels and server-checked scores: `game_sessions` (answers kept server-side, no member access), scoreboard points/level/time, members can no longer post scores directly; empty content-bank and badge tables for upcoming games |
| 25 | `bible_games_content.sql` | 150 more original quiz questions (50 per level), Kids-mode flags. Safe to re-run (skips questions that already exist) |
| 26 | `chat_v3.sql` | Create/edit extra chat channels (open or members-only), church admins can delete department/extra channels (never General), delete a DM for both or hide it for yourself |
| 27 | `bible_reader_v2.sql` | Bible verse highlights (five colours, private to the member — no admin access), `updated_at` on bookmarks, 2,000-character limit on new Bible notes. Plain-language notes at the top of the file |
| 28 | `notifications.sql` | Notification bell: `notifications` (created only by database triggers for announcements, events, chat messages, prayers, bookings, support replies, counseling escalations and new members — exactly the people who can see each thing), device pop-up registrations and pop-up preferences, all private to each person. Plain-language notes at the top of the file |
| 29 | `poster_editor.sql` | Poster editor: editable designs on `posters` (size-limited), the church poster photo library `poster_assets` (poster makers only; delete own, pastors/admins any), and a private `poster-assets` bucket with no browser access (the server signs every upload/download). Plain-language notes at the top of the file |
| 30 | `eft_giving.sql` | Giving by bank transfer: `church_giving_details` (each church's bank account — readable by that church's members, changed only by its church admins; every change audit-logged and sent to every church admin's bell), new `givings` columns and statuses (`reported` → `succeeded`/`not_received`), members may only record their own transfer and delete it while waiting, admins confirm through `confirm_eft_gift()`. Plain-language notes at the top of the file. Why: `docs/adr/0004-giving-by-bank-transfer.md` |
| 31 | `paystack_card_giving.sql` | Card giving: `church_card_giving` (each church's Paystack subaccount — readable by its members, written only by the server after an admin check; paused automatically when bank details change), `givings.provider` / `provider_reference` (unique) / `fee_cents`. Plain-language notes at the top of the file |
| 32 | `church_move.sql` | When the platform admin moves someone to another church: their birthday moves with them, their shared prayers come off the old church's wall (kept privately), upcoming bookings with the old church are cancelled and RSVPs to its upcoming events removed; one audit entry. Gifts, care notes, counselling records and messages stay with the old church. Plan: `docs/plans/church-move-cleanup.md` |
| 33 | `email_sync.sql` | When a member's sign-in email changes (they confirm it from My account → Email address), copies it to `app_users.email` and audit-logs it with both addresses partly hidden. Plan: `docs/plans/email-change.md` |
| 34 | `paystack_billing.sql` | Online billing: Paystack customer/subscription codes on `church_subscriptions` (server-written only), `billing_payments` (each subscription payment; readable by the church's admins, written only by the server; each reference recorded once). Plan: `docs/plans/paystack-billing.md` |
| 35 | `church_logo.sql` | Church logo uploads: a public `church-logos` bucket; only a church admin can add or remove files in their church's folder. The logo shows in the app header (instead of the initials) and on posters; its link is saved in `churches.logo_url` |
| 36 | `songs.sql` | Songs: each church's song list (title, writer, key, lyrics) readable by the whole church; pastors, church admins and the chosen worship-team department can add, edit and delete; one song per title per church |
| 37 | `counseling_delete.sql` | Members can delete their own counseling conversations (with all messages); not while a safety flag is still waiting for a pastor's follow-up |
| 38 | `games_jigsaw.sql` | Lets the scoreboard record the Bible jigsaw game; keeps each finished game's answers so a past game can be opened again |
| 39 | `jigsaw_pictures.sql` | Each church's own jigsaw pictures (AI-painted or uploaded): members play them, pastors and church admins add/remove; files in a private `jigsaw-pictures` bucket that only the server reads |
| 40 | `sermon_audio.sql` | Sermon recordings uploaded from a phone: a `sermon-audio` bucket (50 MB per file); uploads only through one-time links the server issues to sermon editors |
| 41 | `plans_v3.sql` | Plans: Basic unchanged (R299, 50 members); Premium for 50–150 members (R799); Unlimited (the Enterprise slot) R1,300 with unlimited members and every feature, payable online |
| 42 | `activity_log.sql` | Audit log: records every add/edit/delete people make in every church (field names only, never private content), for the platform Audit log page |
| 43 | `pastor_alerts.sql` | Pastor alerts for shared counseling conversations and new prayer requests, plus each pastor's WhatsApp alert setting |
| 44 | `member_children.sql` | Members' children: names and optional birthdays, added by the parent (My account → My children) or by pastors/church admins on the member's profile. Seen only by the parent and their church's pastors/admins; children's birthdays show in "Birthdays this week"; they move with the parent to a new church; changes are audit-logged |
| 45 | `games_differences.sql` | Lets the scoreboard record the new Spot the difference game |
| 46 | `sermon_video.sql` | Sermon videos uploaded from a phone or computer: a public `sermon-video` bucket (MP4, MOV, M4V or WebM, up to 1 GB per file); uploads only through one-time links the server issues to sermon editors. **Also raise Supabase's project-wide upload limit** (Storage → Settings; 50 MB on the Free plan) or larger videos are refused |
| 47 | `video_calls.sql` | Voice and video calls from private chats, group chats and approved pastor appointments, with ringing. A plan feature (`video_calls`: trial, Premium, Unlimited, Sponsored — not Basic). `video_calls` table: visible only to people who can see that chat or appointment; written only by the server |
| 48 | `chat_notifications_v2.sql` | WhatsApp-style message notifications: pop-ups and bell items show the message text ("Alice: See you at 6"; voice notes and photos as 🎤/📷), one pop-up per chat that updates with each new message, previews replaced if the message is deleted or edited before it's read. Each person can hide message text (`notification_preferences.show_previews`). **Add the Update event to the notifications webhook** (see "Notification pop-ups") |
| 49 | `chat_v4.sql` | More WhatsApp features: online & last seen in private chats (`user_presence`, both people must share it; hide yours under My account → Chat privacy), forwarded messages, private starred messages, @mentions in groups (notify even when muted), polls with live votes (`chat_polls`, `chat_poll_votes`, made and voted on only through `create_chat_poll()` / `vote_chat_poll()`), archive (per person), disappearing messages (24 h / 7 d / 90 d; DMs either person, groups pastors/admins; hidden at once, deleted by the nightly job). Message search needs no change. Plain-language notes at the top of the file |
| 50 | `calls_v2.sql` | Built-in calls (no outside call service): phones connect directly (WebRTC) after meeting on a private Supabase Realtime channel per call; this locks that channel to the call's people while it's open. Optional free TURN relay for strict mobile networks: `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` |
| 51 | `calls_v3.sql` | WhatsApp-style calls: `video_calls.connected_at` (call length) and `end_reason` (ended / declined / no_answer), written by the server; private chats get "📞 Voice call · 2:34" or "📞 Missed voice call" |
| 52 | `chat_v5.sql` | Delete messages "for me", like WhatsApp: long-press (or ⌄ → Select messages) to choose several, then Delete for me (hidden from your own view, search and starred; everyone else still sees them) or Delete for everyone (your own messages). `chat_hidden_messages`, one small row per hidden message |
| 53 | `android_devices.sql` | Android app: each phone's push address (Firebase token) against the person signed in on it; server-only (no policies). Lets calls ring the phone full screen when Grace is closed |
| 54 | `calls_v4.sql` | Add people to a call, like WhatsApp: "Add" rings more church members into a call; they get into that call only (not its private chat or appointment); a two-person call becomes a group call (up to 6). `video_calls.invited_user_ids`, `invited_by`; rings the people added |
| 55 | `calls_v5.sql` | Group calls end when everyone has left: phones in a call check in every 20 s (`video_calls.presence`); the last one out — or everyone going quiet — ends the call, so "Join" disappears. `call_presence_write()` is server-only |
| 56 | `game_duels.sql` | Bible quiz duels: challenge someone from church to the same 10/20/30 questions against a 20 s clock; most right answers wins, a tie goes to the quicker player. Answers and the answer key are server-only (`game_duel_keys`, `game_duel_answers`); only the two players see a duel; live progress; notifications for the challenge, accept/decline and result |
| 57 | `church_challenges.sql` | Whole-church Bible challenges: a pastor/church admin starts one (title, level, 10/20/30 questions, open 1 h–1 week); everyone is notified and plays the same questions once; live leaderboard (most right, then quickest); results sent to everyone who played when it closes (also by the nightly job). Answer key and picks server-only |
| 58 | `member_children_v2.sql` | Children's mother and father (a member, or just a name for someone not in the app); both parents who are members can see and manage the child; pastors/admins see all children on Members → Children. Birthdays can be saved without a year (stored as 1904); the app never shows anyone's birth year or age to others |
| 59 | `billing_v4.sql` | Basic becomes R250/month (R2,500/year) with the everyday features; Service planner, Pastor booking and Pastoral care move to Premium and up. Billing emails: invoice numbers (GBV-1001 up) on payments, `receipt_sent_at`, and `church_subscriptions.reminder_sent_for` so each payment date is reminded once |
| 60 | `church_life.sql` | Eight church-life features: **Live Sunday** (livestream + order of service + lyrics + sermon notes), **sermon notes** (fill in the blanks, keep in your journal), **testimonies** (pastor approves first), **reading plans** (streaks; church-wide plans), **prayer chain** (book slots; reminder ~30 min before), **volunteer rosters** (teams, reminders the day before, swaps), **certificates** (baptism, dedication, membership, course; printable with the church logo) and the **Monday report** email. Basic gets the first five; Premium and up get all. Also sets the prices (Basic R250, Premium R500, Unlimited R1,000 a month; yearly = 10 months) and what each plan gets: Basic adds Sermons as links; Premium adds photos in chat and uploading sermon recordings; Unlimited adds priority support (tickets marked high, WhatsApp button) and church colours. Monthly AI allowance per church: `plans.ai_monthly_limit` (Premium 300, Unlimited 1,000, trial 50) Reminders run every 10 minutes with pg_cron (switched on by this file where available) and from the nightly job |
| 62 | `church_life_v2.sql` | Prayer chain: set prayer times each day (e.g. 05:00, 15:00, 18:00), pastors can put members into slots, and each person can add their prayer (typed or recorded; `prayer-audio` bucket). Certificates: "Other" with your own title and wording; five designs (Modern, Banner, Ribbon, Classic, Original) in eight colours; the church remembers its style. Monday report on/off per church (`churches.weekly_report_enabled`). (#61 is the optional song seed) |
| 63 | `record_members.sql` | Record-only members: older members kept on the church's records (name, phone, birthday, children, certificates) without an app login. `app_users.record_only`; no notifications; not in chats or calls; not counted towards the plan's member limit. "Give app access" on their profile turns them into an ordinary member. Also: everyone who books a prayer-chain slot is notified of its time and date, only pastors/admins can remove or move prayer times, and a verse-of-the-day notification every morning (`notification_preferences.daily_verse`; `/api/cron/daily-verse` at 07:00) |

`platform_hardening.sql` in plain language: every statement is safe to re-run;
nothing is deleted or rewritten; new data checks are added as `NOT VALID`, so
old rows that don't fit are left alone while new writes are checked.

One manual dashboard step: **Database → Replication**, enable `chat_messages`
(or run `alter publication supabase_realtime add table chat_messages;`).
Without it, chat works but only updates on refresh. (The `attachments` storage
bucket is created by step 20 if it doesn't exist.)

For local testing you can turn off email confirmation: Authentication →
Providers → Email → "Confirm email".

### Demo data (dev/test projects only)

```bash
SEED_CONFIRM=yes pnpm seed
```

Creates "Demo Community Church" with one login per role
(`admin@` / `pastor@` / `leader@` / `member@demo.church.test`, password
`DemoPassword!2026` or `SEED_PASSWORD`), plus a sample announcement, event,
shared prayer and care note. It refuses to run without `SEED_CONFIRM=yes` —
**never point it at production**.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public key; RLS limits what it can do |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **Server only.** Registration, invites, deletion, audit log, exports, webhooks |
| `NEXT_PUBLIC_APP_URL` | yes in prod | Base URL for invite/reset emails and returning from Paystack |
| `JOURNAL_ENCRYPTION_KEY` | for Journal | 64 hex chars (`openssl rand -hex 32`). Losing it = journals unreadable |
| `NEXT_PUBLIC_APP_TIMEZONE` | no | Timezone for showing/entering times (default `Africa/Johannesburg`) |
| `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` | no | Enables AI features (Claude, or Google Gemini if only that key is set; `GEMINI_MODEL` overrides the default `gemini-3.5-flash`); each has a non-AI fallback |
| `ANTHROPIC_MODEL` | no | Model override (default `claude-opus-5-5`) — a smaller model costs less |
| `AI_CALLS_PER_USER_PER_HOUR` | no | Per-person AI cap (default 30) — protects the API bill |
| `PAYSTACK_SECRET_KEY` | for card giving | **Server only.** Paystack secret key (`sk_test_…` while testing). Also verifies Paystack's webhook signatures. Blank = card giving hidden |
| `PAYSTACK_FEE_PERCENT`, `PAYSTACK_FEE_FLAT_CENTS` | no | Paystack's card fee (from their pricing page) so members can choose to add it. Blank = option hidden |
| `NOTIFY_WEBHOOK_URL`, `NOTIFY_WEBHOOK_SECRET` | no | Send alerts via a Make.com/n8n webhook; blank = in-app only |
| `CRON_SECRET` | yes in production | Lets Vercel Cron call `/api/cron/expire-chat-media` (deletes voice notes after 90 days). Blank = the job refuses to run |
| `MAKE_WEBHOOK_URL`, `MAKE_WEBHOOK_SECRET` | no | Pastor & admin alerts on WhatsApp, through a Make.com scenario. See "WhatsApp alerts" |
| `MAKE_EMAIL_WEBHOOK_URL` | no | Billing emails (payment reminders 3 days before, thank-you receipts with the invoice) sent from your Gmail through Make.com. See "Billing emails" |
| `BREVO_API_KEY` or `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | no | Alternative to Make for billing emails (free tiers). `EMAIL_FROM` e.g. `Grace-bound Ventures <you@gmail.com>` |
| `SUPPORT_WHATSAPP_NUMBER` | no | Your support WhatsApp number (e.g. `27821234567`): Unlimited churches get a "WhatsApp support" button on the Support page |
| `INVOICE_COMPANY_DETAILS` | no | Your business details printed on invoices (address, registration number; `\n` for new lines) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | no | Phone/computer pop-ups for the notification bell (Web Push). Blank = bell only. See below |
| `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_ANDROID_APP` | no | Android app: calls ring full screen and messages pop up when the app is closed (Firebase, free). See "Android app" |
| `NOTIFICATIONS_WEBHOOK_SECRET` | with pop-ups | Secret the Supabase Database Webhook sends to `/api/notifications/push` |
| `PEXELS_API_KEY` | no | Free stock photo search in the poster editor (free key from pexels.com/api). Blank = uploads only |

### Giving by bank transfer

The default way to give (ADR-0004). After migration #30: a church admin opens
**Church settings → Bank details for giving** and enters the church's bank
account and a reference prefix. Members then see those details on **Giving**
with their own reference (e.g. `KAMI-3F9A2C`), pay in their banking app, and
tap **I've made this transfer**. Church admins confirm each one under **Giving
report → Waiting for confirmation** (the dashboard shows how many are
waiting). Only confirmed gifts count in totals, the report and the CSV. No
payment provider, no fees, and the money goes straight to the church.

### Card giving (Paystack)

Optional, alongside bank transfers. Each church becomes a Paystack
*subaccount*, so card gifts are paid into that church's own bank account
(about two working days later). Grace-bound's share is 0 %; Paystack's fee
comes out of each gift unless the member ticks "add the card fee".
Plan: `docs/plans/paystack-card-giving.md`.

1. **Platform (once):** create a Paystack business account at paystack.com
   (country: South Africa). Test mode works immediately; live payments need
   Paystack to verify the business. Put the **secret key** in
   `PAYSTACK_SECRET_KEY` (`.env.local` locally, Vercel env vars when
   deployed). Optionally set `PAYSTACK_FEE_PERCENT` / `PAYSTACK_FEE_FLAT_CENTS`.
2. **Webhook (deployed app only):** Paystack dashboard → Settings → API Keys
   & Webhooks → Webhook URL `https://<your-domain>/api/paystack/webhook`.
   Locally there's no webhook: the app confirms each payment with Paystack
   when the member returns, which is enough for testing.
3. **Each church admin:** Church settings → Bank details for giving → choose
   the bank from the list → **Turn on card giving**. Changing the bank
   details later pauses card giving until it's turned on again.
4. **Test:** with the test key, give by card using one of Paystack's test
   cards (listed in their docs, "Test Payments"). The gift shows as received
   in the member's history and the giving report.

### Online billing (Paystack subscriptions, optional)

Churches can pay for Basic or Premium themselves from **Billing**: a monthly
card subscription, charged by Paystack to the platform's own account (not a
church subaccount). Without the settings below, billing stays manual (plan
changes through Super Admin). Plan: `docs/plans/paystack-billing.md`.

1. Run migration #34 (`paystack_billing.sql`).
2. In Paystack → Products → Plans, create two **monthly** plans in **ZAR**
   with exactly the prices of Basic and Premium in the `plans` table. Put
   their codes in `PAYSTACK_PLAN_BASIC` and `PAYSTACK_PLAN_PREMIUM`.
3. The webhook URL from card giving (step 2 above) also carries renewals,
   failed payments and cancellations — no second webhook.
4. Set `CRON_SECRET`: the nightly job ends cancelled subscriptions once the
   paid month is over.

What happens: Subscribe → Paystack checkout → the plan activates when Paystack
confirms (return page or webhook). Each monthly renewal extends the paid-up
date. A failed renewal gives 7 days' grace while Paystack retries. Cancel
stops future charges and keeps access until the end of the paid month.
Churches with a lifetime plan or a price override keep the manual route.
Stripe was removed (ADR-0004).

### Notification pop-ups (optional)

The bell works on its own (migration #28). Pop-ups need two things per
environment (dev and production each get their own keys and webhook):

1. **Keys.** Run `pnpm exec web-push generate-vapid-keys`. Put the public key
   in `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, the private key in `VAPID_PRIVATE_KEY`,
   `mailto:you@yourchurch.org` in `VAPID_SUBJECT`, and a random string in
   `NOTIFICATIONS_WEBHOOK_SECRET`. Add all four in Vercel → Settings →
   Environment Variables, then redeploy. **Don't change the keys later:**
   every device would have to turn pop-ups on again.
2. **Webhook.** Supabase → Database → Webhooks → Create: table
   `notifications`, events **Insert** and **Update**, type HTTP Request,
   method POST, URL `https://<your-domain>/api/notifications/push`, add
   header `x-webhook-secret` = your `NOTIFICATIONS_WEBHOOK_SECRET`. (Update
   lets every new chat message pop up, WhatsApp-style — migration #48. If your
   webhook only has Insert, only the first unread message in each chat pops up.)

Then on a phone: open the live site (HTTPS) → My account → Notifications →
Turn on → Send a test. On iPhone, add the app to the Home Screen first (iOS 16.4+).
Pop-ups don't work in `pnpm dev` (the service worker is production-only).

### WhatsApp alerts (optional)

Pastors and church admins get an alert (bell + pop-up) for: booking
requests, a counseling conversation shared with them or flagged for crisis,
new prayer requests on the wall, and new members. These can also go to their
WhatsApp, through **one Make.com scenario**. It uses the **same Supabase
webhook as pop-ups** (step 2 above), so set that up first. WhatsApp goes to
the phone number in each pastor's details; they can turn it off in
My account → Notifications.

1. Make → Create scenario → **Webhooks → Custom webhook** → copy its URL into
   `MAKE_WEBHOOK_URL` in Vercel, and a random string into `MAKE_WEBHOOK_SECRET`. Redeploy.
2. Add **WhatsApp Business Cloud → Send a Message** (connect your Meta WhatsApp
   Business account). To = `whatsapp_to`. Use an approved template with
   variables `title`, `body`, `link` (Meta requires a template when the person
   hasn't messaged your number in the last 24 hours).
3. Optional: a filter between them, header `X-Notify-Secret` = your secret.

Each call is for one person and carries: `name`, `church`, `title`, `body`,
`link`, `whatsapp_to` (e.g. `+27825550000`) and `whatsapp_text` (everything as one message).

### Billing emails (optional)

Grace-bound Ventures emails each church's pastors and admins **3 days before
a payment is due**, and a **thank-you receipt with the invoice** after each
payment (invoices are also on Billing → Payments, printable). Needs migration
#59 and `CRON_SECRET` (the nightly job sends them). Free, from your own Gmail:

1. Make → Scenarios → Create a new scenario → **⋯ → Import Blueprint** →
   `docs/make/grace-alerts.blueprint.json`.
2. Click the **Webhooks** circle → Add → name it "Grace" → Save → **Copy
   address to clipboard**. Put it in Vercel as `MAKE_EMAIL_WEBHOOK_URL`. Redeploy.
3. Click the **Gmail** circle → Add a connection → sign in with the Gmail the
   emails should come from.
4. In Make click **Run once**, then in Grace open Super Admin → **Send test
   emails to me**. Two emails arrive. Switch the scenario **ON** (bottom left).

If a module shows as unknown after import, delete it and add **Gmail → Send
an email** yourself: To = `to`, Subject = `subject`, Content = `html`, with
the filter `kind` = `email`. Keep the webhook address private.

### Creating a Super Admin

Deliberately not possible from the app. Create an auth user, then in the SQL Editor:

```sql
insert into app_users (id, church_id, name, email, role)
values ('<auth-user-id>', null, 'Platform Owner', 'owner@example.com', 'super_admin');
```

---

## Phones

Built mobile-first. On phones:

- **Tab bar** at the bottom (Home, Prayer, Chats, Bible, More — only what the
  person's plan and role include; `lib/navigation.ts` `buildTabBar`). Hidden in
  chat threads and the poster editor, and while the keyboard is open.
- **Home quick actions**: Request prayer, Give, Read today, Events & RSVP.
- **Share** to WhatsApp and other apps (the phone's share sheet, else copy):
  posters (as an image), the verse of the day, events and announcements
  (`lib/share.ts`, `components/ShareButton.tsx`). Prayer requests aren't
  shareable outside the app on purpose.
- **Chat keyboard**: threads size to the visible area above the keyboard,
  including iPhone (`components/KeyboardViewport.tsx`).
- **Gestures**: swipe a chat left to mark read or mute; swipe the Bible
  reader left/right for the next/previous chapter. Shortcuts only — every
  action is also a button.
- **Pull to refresh** in the installed app (browsers have their own).
- **Vibration** on "I prayed", RSVPs, sharing and completed payments, where
  supported; off with "reduce motion".
- **Offline writing**: journal entries and prayers written without signal
  are kept on the phone and sent when it reconnects (`lib/offline-queue.ts`).
  Until then the text sits unencrypted in the phone's storage; it's cleared
  on sign-out and kept if the session expires, so nothing is lost.
- **Display** (My account): text size (up to 125 %), high contrast, theme.
- **Notifications** are offered right after someone shares a prayer request,
  not as a cold permission popup.
- **Welcome tour** on a person's first visit (per device), skippable.
- **Loading placeholders** shaped like each main page.

## Android app

`android/` is a small native app (Kotlin) that shows Grace full screen and
adds what a web page can't do on Android: calls ring like a phone call
(full screen over the lock screen, the phone's ringtone at ringer volume,
Decline/Answer) even when the app is closed, a "call in progress"
notification so calls survive switching apps, earpiece/loudspeaker and
screen-off-at-your-ear for voice calls, and the unread number on the app icon
(including Huawei/Honor). Everything else is the website, so it updates
without reinstalling. Not in the Play Store: members install it from
**/android**, which links to the newest GitHub release.

**Building.** `.github/workflows/android.yml` builds it on GitHub (free) when
`android/` changes, or from Actions → Android app → Run workflow, and
publishes `grace.apk` as a release. Updates install over the old version only
if signed with the same key: `android/grace-release.p12`, unlocked by the
repository secret `ANDROID_KEYSTORE_PASSWORD`. Without the secret the build
still runs (as a check) but nothing is published. Never lose that password.

**Calls when the app is closed (Firebase, free).**
1. console.firebase.google.com → Add project (Analytics off).
2. Add app → Android → package name `stream.gracebound.grace` → Register app
   → download `google-services.json` (skip the remaining steps).
3. Project settings → Service accounts → Generate new private key.
4. Vercel → Environment Variables: `FIREBASE_ANDROID_APP` = the whole
   `google-services.json`; `FIREBASE_SERVICE_ACCOUNT` = the whole key file
   (secret). Redeploy.
5. Run `android_devices.sql` (#53). Phones register when the app is opened.

How it fits: `lib/fcm.ts` sends data-only messages (HTTP v1, a signed JWT,
no SDK); `lib/push.ts` sends every pop-up to both Web Push and the app;
ending a call sends `call_end` so the other phone stops ringing. The app's
side: `android/app/src/main/java/stream/gracebound/grace/` (`PushService`,
`Notifier`, `IncomingCallActivity`, `Bridge` = `window.GraceAndroid`,
see `lib/android.ts`).

## Checks & tests

```bash
pnpm typecheck   # TypeScript strict
pnpm lint        # ESLint (next/core-web-vitals)
pnpm test        # unit tests + database/RLS tests
pnpm build       # production build
pnpm test:e2e    # browser tests (Playwright; starts the app itself)
```

`pnpm test` runs every migration against real Postgres (PGlite — Postgres
compiled to WebAssembly, no Docker needed), then acts as real signed-in users
with RLS enforced: privilege escalation, cross-church access, DM privacy,
deactivated accounts, plan-catalogue tampering, counseling escalation, RSVP
scope, draft visibility, booking cancellation, pastoral-note confidentiality,
journal privacy, audit-log integrity and member erasure. Unit tests cover
permissions, feature gating, navigation, timezone conversion, journal
encryption storage, money parsing, CSV safety, card-gift settlement and Paystack webhook signatures.
`pnpm test:e2e` drives Chromium (desktop and phone sizes): `e2e/public.spec.ts`
checks the signed-out pages and access rules and needs no database;
`e2e/roles.spec.ts` signs in as each seeded demo login and walks that role's
menu and pages — run it against a test Supabase project after `pnpm seed`
with `E2E_SEEDED=1` (and `E2E_BASE_URL=<preview URL>` to test a deployment).
GitHub Actions (`.github/workflows/ci.yml`) runs all of these on every push
(the role walkthrough is skipped there until a test project is configured).

---

## Deploying (Vercel)

1. Push to GitHub, import the repo in Vercel (it uses pnpm from `packageManager`).
2. Add every env var from the table under Project → Settings → Environment
   Variables. Use **separate Supabase projects** for Preview and Production if
   you can — see "Environments" below.
3. Branches: work on `dev` (each push gets a Preview URL); merge `dev` → `main`
   only when a change is approved for Production.
4. Supabase → Authentication → URL Configuration: set the Site URL and add the
   app URLs plus `/reset-password` to Redirect URLs (needed for invite and
   password-reset emails). Locally, allow `http://localhost:3000/reset-password`.
5. Before real users: configure custom SMTP (Supabase's built-in email is
   heavily rate-limited), confirm backups (the free plan has none you can
   restore yourself), and set up a log drain / error tracking.

### Installing on a phone (home-screen app)

The app is installable (a PWA): it opens full screen from a home-screen icon,
keeps people signed in, and shows a branded offline page when there's no
connection. Installing **only works over HTTPS**, so it needs the deployed
Vercel URL (Preview or Production) — `localhost` on your PC can't be installed
from a phone. Vercel serves every deployment over HTTPS automatically.

**Icons:** `public/icons/` holds the Grace cross icon in every size the
manifest, page and notifications use, generated by `node scripts/build-brand.mjs`.

**Android (Chrome, Edge, Samsung Internet):**
1. Open the app's URL and sign in.
2. Tap **Install** on the banner on the home page, or go to **My account →
   Install the app**. (Before the icons exist: browser menu ⋮ → **Install app**
   / **Add to Home screen**.)
3. Confirm. The icon appears on the home screen and in the app list.

**iPhone / iPad (Safari; also Chrome and Edge on iOS 16.4+):**
1. Open the app's URL in Safari and sign in.
2. Tap **Share** (bottom of the screen on iPhone, top on iPad) → **Add to Home
   Screen** → **Add**. My account → Install the app shows the same steps.
3. Open it from the home screen. Phone pop-up notifications on iPhone only
   work from the installed app.

Links opened inside WhatsApp, Facebook or Instagram open a mini-browser that
can't install; the app tells people to open the page in Safari/Chrome first.

**Updates:** nothing to do — each deploy is picked up the next time the app
opens (or returns to the foreground), and people see a "has been updated"
notice. Pages are never cached, only the versioned script/style files, the
Bible text and the offline page.

**Checking an installed build:** in desktop Chrome/Edge open DevTools →
Application → Manifest (lists installability problems) and Service workers.

**Environments:** I couldn't check whether your Preview and Production point at
the same Supabase project. If they do, any test (including `pnpm seed`) touches
live data — ask the Supabase org owner for a second project for dev/preview.

---

## Roles — who can do what

| | Member | Dept. leader | Pastor | Church admin | Super admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Own prayer board, journal, games, Bible, giving, my account | ✓ | ✓ | ✓ | ✓ | – |
| Share to / comment on prayer wall; chats & DMs | ✓ | ✓ | ✓ | ✓ | – |
| Request a pastor; cancel own request | ✓ | ✓ | ✓ | ✓ | – |
| Post announcements / create events / make posters | – | own dept. | ✓ | ✓ | – |
| Pin announcements, post church-wide | – | – | ✓ | ✓ | – |
| Sermons, service plans, approve bookings | – | – | ✓ | ✓ | – |
| Pastoral care log, counseling review, prayer-wall & chat moderation | – | – | ✓ | ✓ | **no** (by design) |
| Create/edit chat channels (open or members-only) | – | – | ✓ | ✓ | – |
| Delete department or extra chat channels (never General) | – | – | – | ✓ | – |
| Delete own DM for both people, or hide it for yourself | ✓ | ✓ | ✓ | ✓ | – |
| Members: add, edit, deactivate (not church admins) | – | – | ✓ | ✓ | – |
| Grant/remove church admin; delete departments | – | – | – | ✓ | – |
| Permanently delete member / export their data (POPIA) | – | – | – | ✓ | – |
| Church profile, billing, giving report | – | – | – | ✓ | – |
| Read anyone's journal | – | – | – | – | – (never) |
| All churches, subscriptions, module overrides, platform users | – | – | – | – | ✓ |

Every rule lives in one place in code (`lib/permissions.ts`), is re-checked in
every server action, and is enforced again by Postgres RLS. Menus only hide links.

---

## Where things live

| To change… | Go to |
|---|---|
| Who may do what | `lib/permissions.ts` (+ the matching policy in `supabase/*.sql`) |
| The menu (grouping, which role/plan sees what) | `lib/navigation.ts` |
| Which plan includes which feature | `plan_modules` rows (SQL); gating in `lib/paywall.ts` + `lib/gate.tsx` |
| "Not on your plan" screen | `components/ui/Gates.tsx` |
| Buttons, inputs, cards, colours | `app/globals.css` (component classes + light/dark colour values), `tailwind.config.ts` (token names, shadows) |
| Light/dark theme switch | `lib/theme.ts`, `components/ui/ThemeSwitcher.tsx`; applied before paint in `app/layout.tsx` |
| Icons (menu + empty states) | `components/ui/NavIcon.tsx` (lucide-react) |
| Shared UI (page header, empty/error states, badges, confirm dialog, toasts) | `components/ui/`, `components/ConfirmSubmitButton.tsx` |
| "Are you sure?" from code (not a form) | `components/ui/ConfirmDialog.tsx` (`useConfirm`) |
| Calling a server action from a client component | wrap it in `callAction` (`lib/call-action.ts`) so a failed request shows an error instead of a stuck button |
| Loading skeletons | `components/ui/Skeleton.tsx`; per-section `loading.tsx` (dashboard, members, chat, posters) |
| Brand: logos, cross, intro, sign-in layout | `components/brand/` (`BrandMark`, `Cross`, `Ornament`, `AuthShell`), `components/entry/` (`EntryIntro`, `LightField`), `lib/brand/`, files in `public/brand/` (`scripts/build-brand.mjs`) |
| Installable app (PWA) | Manifest `app/manifest.ts`; iPhone metadata + viewport `app/layout.tsx`; install button/banner `components/install/` (device rules `lib/install.ts`, tested); service worker `public/sw.js` (registered by `components/ServiceWorker.tsx`); offline page `public/offline.html`. Plan: `docs/plans/installable-app.md` |
| Forms opening as popups | `components/ui/RouteModal.tsx`; one wrapper per form in `app/dashboard/@modal/(.)<route>/page.tsx`. A new form page needs a matching wrapper, or it opens as a full page |
| Dates, times, money formatting; timezone | `lib/format.ts` |
| Form error handling pattern | `lib/forms.ts` |
| Dashboard home | `app/dashboard/page.tsx` |
| Members (list, profile, invite, deactivate, POPIA) | `app/dashboard/members/` (`actions.ts` holds all writes) |
| Announcements / Calendar / Sermons | `app/dashboard/{announcements,calendar,sermons}/actions.ts` |
| Pastor booking rules | `lib/booking.ts` (tested), `app/dashboard/booking/` |
| AI counseling, crisis escalation | `lib/counseling.ts`, `app/dashboard/counseling/actions.ts`, `lib/crisis-detection.ts` |
| Outbound notifications (email/WhatsApp via webhook) | `lib/notify.ts` |
| Chat (rules, edit window, reactions, voice limits) | `lib/chat.ts` (tested); screen in `app/dashboard/chat/[id]/`; edit/delete in `app/dashboard/chat/actions.ts` |
| Nightly voice-note expiry | `app/api/cron/expire-chat-media/route.ts`, schedule in `vercel.json` |
| Bible game content (clues, emoji stories, quotes, books; quiz questions are in SQL) | `lib/games/content/*.ts` — every item has a Bible reference for checking; quiz questions in `supabase/bible_games_content.sql` |
| Bible reader | Text files: `public/bibles/` (built by `scripts/build-bibles.mjs`; book list `lib/bible/canon.json`). Reader: `components/bible/BibleReader.tsx` (verses `ChapterText.tsx`, picker `PassagePicker.tsx`, action bar, notes, settings). "Go to" parsing: `lib/bible/reference.ts`. Highlights/bookmarks/notes: `app/dashboard/bible/read/actions.ts`. Search: `lib/bible/search.ts` + `components/bible/BibleSearch.tsx`. Offline: `lib/bible/offline.ts` + `public/sw.js`. Why it's built this way: `docs/adr/0001-bible-text-hosting-and-offline.md` |
| Notifications | Who gets told: the triggers in `supabase/notifications.sql` (tests `tests/db/notifications.test.ts`). Bell, panel, live badge: `components/notifications/NotificationBell.tsx` (list rows `NotificationList.tsx`). Full page + mark read/clear: `app/dashboard/notifications/`. Pop-ups: `lib/push.ts`, webhook `app/api/notifications/push/route.ts`, device/preference settings `components/notifications/PushSettings.tsx` + `app/dashboard/account/notification-actions.ts`, display in `public/sw.js`. 90-day clean-up: `app/api/cron/expire-chat-media/route.ts`. Why: `docs/adr/0002-notifications.md` |
| Poster editor | Design format + validation: `lib/posters/design.ts`. Editor: `components/posters/editor/Editor.tsx` (canvas `EditorCanvas.tsx`, properties `PropertiesPanel.tsx`, add/layers `SidePanels.tsx`). Undo, element operations, resizing between sizes: `lib/posters/{history,elements,layout}.ts` (tested). Templates: the 42 designs in `lib/posters/templates/catalog.ts` and `catalog-more.ts`, written with the size-independent helpers in `kit.ts` (tests check validity, fit and contrast at every size); gallery `components/posters/TemplateGallery.tsx`. Fonts: list in `lib/posters/fonts.ts`, files + OFL licences in `public/fonts/poster/` (refresh with `node scripts/fetch-poster-fonts.mjs`). Save: `app/dashboard/posters/editor-actions.ts`. Pages: `app/dashboard/posters/editor/`. Why: `docs/adr/0003-poster-editor.md` |
| Bible games | Rules, levels, points and puzzle generators: `lib/games/` (tested). Starting/finishing/marking: `app/dashboard/games/actions.ts` + `engine.ts`. Shared intro/timer/results frame: `app/dashboard/games/GameShell.tsx`; which board each game uses: `GameScreen.tsx`. Daily challenge, streaks, badges: `lib/games/progression.ts` |
| Any AI behaviour, model, timeout | `lib/ai.ts`; rate limit `lib/ai-quota.ts` |
| Billing (plans; online via Paystack or manual) | page + subscribe/cancel actions `app/dashboard/billing/`; rules `lib/billing.ts` (tested); Paystack settlement, renewals, grace and cancellation `lib/subscription-billing.ts`; return `app/api/billing/paystack/return/route.ts`; webhook `app/api/paystack/webhook/route.ts`; database `supabase/paystack_billing.sql`; manual plan changes in `app/dashboard/super-admin/` |
| Giving, giving report & CSV | Bank transfers (EFT, the default): church bank details `app/dashboard/setup/giving/`; member page + "I've made a transfer" + confirm/delete actions `app/dashboard/giving/`; waiting list `app/dashboard/giving/report/WaitingGifts.tsx`; rules + references `lib/giving.ts`; database rules `supabase/eft_giving.sql` (tests `tests/db/eft-giving.test.ts`). CSV `app/api/giving/export/route.ts`. Card giving (Paystack): client `lib/paystack.ts`, settlement rules `lib/card-giving.ts` (tested), bank list `lib/banks-za.ts`, settings `app/dashboard/setup/giving/CardGivingSection.tsx`, return `app/api/giving/paystack/return/route.ts`, webhook `app/api/paystack/webhook/route.ts`, database `supabase/paystack_card_giving.sql`. Why: `docs/adr/0004-giving-by-bank-transfer.md` |
| Journal encryption | `lib/encryption.ts` (tested) |
| Changing sign-in email | `app/dashboard/account/EmailChangeForm.tsx`, `requestEmailChange` in `app/dashboard/account/actions.ts`, password check `lib/supabase/verify-password.ts`, link landing `app/auth/confirm-email/route.ts`, sync `supabase/email_sync.sql` |
| Registration & church creation | `app/register/actions.ts`, `lib/provision.ts` |
| Super admin | `app/dashboard/super-admin/` (`actions.ts` holds all writes) |
| Session refresh & sign-in redirects | `middleware.ts`, `app/login/`, `app/auth/signout/` |
| Audit log | `lib/audit.ts` |
| Database schema & RLS | `supabase/*.sql`; tests in `tests/db/` |

---

## Design system

Kept the navy/gold "Grace-bound" direction agreed in an earlier session (not
the Aperture default). Conventions every screen follows:

- **Page header**: back link · title · one-line description · actions at the
  right, with **one** primary action (e.g. "Add member").
- **Buttons**: `btn-primary` (create/save/publish), `btn-secondary`
  (cancel/view/filter), `btn-danger` / `btn-danger-outline` (delete/disable).
- **Destructive actions** always open a confirmation dialog that names the
  thing and explains the consequence ("Delete announcement?" … "Delete
  announcement"); permanent erasure also asks you to type DELETE.
- **Lists**: header → search/filters (server-side, in the URL) → result count
  → table (desktop) or cards (mobile) → pagination → a real empty state.
- **Forms**: labels on every input, red asterisk for required, inline field
  errors, typed values kept after an error, button disabled while saving,
  a toast on success.
- **Status** is always a word in a badge, never colour alone.
- **Contrast**: small grey text uses `text-ink/60` or darker (lighter fails
  WCAG AA on the light theme). `gold` is for hairlines and icons; gold *text*
  on a light surface uses `text-gold-deep`. The navy `panel` / `on-panel`
  tokens are for brand panels that stay dark in both themes.
- **Icons** come from lucide-react only — no emoji as icons.
- **Type sizes** come from the scale in `tailwind.config.ts` (`text-micro`,
  `text-eyebrow`, `text-lede`, `text-title-sm`, `text-title`, `text-title-lg`,
  `text-display`, `text-display-lg`) plus Tailwind's `text-xs`…`text-3xl` —
  not `text-[NNpx]`. Exceptions: Bible reading sizes, crossword numbers, kids mode.

---

## Known gaps & deliberate placeholders

- **Signed-in flows are not tested in a browser against real Supabase.** No
  Supabase project or Docker was available while building. Verified instead:
  type-check, lint, production build, and the database/RLS suite on real
  Postgres. Playwright role walkthroughs are written (`e2e/roles.spec.ts`) but
  have not run yet: **before real users, seed a test Supabase project and run
  `E2E_SEEDED=1 pnpm test:e2e`**.
- **Journal storage fix is reasoned, not observed.** The old code stored the
  JSON text of a Buffer in `bytea` columns; new code writes hex and reads both
  formats (unit-tested). Confirm by saving and reading one entry after deploying.
- **App icons** are generated from the Grace cross (`scripts/build-brand.mjs`).
- **Brand:** the app is **Grace**, by **Grace-bound Ventures**. The app's mark
  is a teal cross with a rose jewel (`components/brand/Cross.tsx`); teal and
  plum lead, rose is for small highlights. The company logo keeps its
  butterflies (`lib/brand/butterfly.json`). Names are in `lib/brand/index.ts`.
  Run `node scripts/build-brand.mjs` after changing either to regenerate the
  company logo, the app logo (light/dark) and every icon in `public/brand/`
  and `public/icons/`. The landing page opens with an animated intro
  (`components/entry/`) once per browser session; it's skippable and off for
  reduced motion. Photography is still to come.
- **Chat "typing…" uses an open Realtime broadcast** keyed by the chat's random ID.
  It carries only a user ID (never message text), but isn't permission-checked the
  way messages are. Supabase "private channels" (Realtime Authorization) would close
  this; worth enabling if chats become sensitive. Muting a chat stops its unread
  counts, bell items and pop-ups. Read ticks (✓✓) show in DMs only.
- **Notifications**: the bell (in-app) always works after migration #28. Phone
  pop-ups need VAPID keys and a Supabase Database Webhook (see "Notification
  pop-ups"), HTTPS, and on iPhone a Home Screen install; they're untested on a
  real device until a Vercel Preview exists. Email/WhatsApp only via the
  separate `NOTIFY_WEBHOOK_URL` (Make.com), which still covers crisis alerts.
  The Realtime free tier (200 concurrent connections, shared with chat) is the
  first limit a growing platform will hit.
- **One timezone per deployment** (`NEXT_PUBLIC_APP_TIMEZONE`). Per-church
  timezones would need a `churches.timezone` column.
- **Email changes** are self-service (My account → Email address; needs the
  current password and an emailed confirmation). Check Supabase → Authentication
  → Providers → Email → **Secure email change** is on, so the old address must
  confirm too, and add `<your-domain>/auth/confirm-email` (and
  `http://localhost:3000/auth/confirm-email`) to Authentication → URL
  Configuration → Redirect URLs. Someone who has lost their old inbox needs the
  platform admin to change it in Supabase Auth. A pending change can't be
  withdrawn in the app; its links simply expire.
- **Moving someone to another church** (Super Admin) keeps the old church's
  own records — gifts, pastoral care notes, counselling records, messages —
  with the old church on purpose. The person's birthday, shared prayers,
  upcoming bookings and RSVPs are tidied automatically (migration #32).
- **Crisis detection** is keyword matching — a tripwire, not a safety system.
  Review with a mental-health professional; helplines are South African.
- **Bible text**: the reader and search use public-domain KJV, WEB, ASV and
  YLT files shipped in `public/bibles/` (rebuild with
  `node scripts/build-bibles.mjs`); the daily verse and AI study tool read the
  same files on the server (`lib/bible/text.ts`). No outside Bible service is used.
  Licensed versions (NIV, ESV, Afrikaans…) would need a publisher licence and
  a licensed API, online-only.
- **Offline Bible** needs the service worker (`public/sw.js`), which is
  registered in **production builds only**. Test offline reading on a Vercel
  Preview URL, not `pnpm dev`. Highlights and notes need a connection.
  The manifest's icons are the Grace cross.
- **Poster editor**: built and type-checked, but not yet used on real phones or against real Supabase Storage/Pexels. Downloads: PNG, JPG, PDF (a true A4 page for A4 posters) and an animated video (Download → Video: entrances per element or "Animate everything", recorded in the browser — MP4 where supported, otherwise WebM; it plays in real time, so a slow phone gives a lower frame rate rather than a longer video). Video and PDF are verified in headless Chromium, not yet on real phones. A canvas can't be fully screen-reader friendly; the Layers list and properties panel give keyboard access to every element. Unsaved work is kept on the device that was editing (not synced). Stock photo search needs `PEXELS_API_KEY`; its per-person limit is per server instance.
- **Error tracking:** set `SENTRY_DSN` (Sentry's free plan, or any
  Sentry-compatible service) and every server `console.error`, unhandled
  rejection and browser error is sent there (`lib/error-reporting.ts`,
  `instrumentation.ts`, `/api/errors`), scrubbed of emails and phone numbers
  and rate-limited. No SDK is installed, so there are no source maps or
  performance traces; blank DSN = server logs only.
- **Card giving (Paystack) is untested against a real Paystack account** — built from Paystack's official API spec and unit-tested with mocked responses. Test it with a test key before going live; the webhook needs the deployed HTTPS URL. Online billing (Paystack subscriptions) is likewise built from the spec and tested with mocks: try a test-mode subscription, a cancellation and (with Paystack's failing test card) a failed renewal before going live. Stripe was removed (ADR-0004).
- **Bank-transfer gifts are confirmed by hand** — the app can't see the church's bank account. The year in the report follows when a gift was recorded, so a transfer made on 31 December and recorded in January counts in January (the paid date is shown and exported).
- `support_ticket_messages.attachment_url` is unused but kept so no data is lost.

Running costs and when each service would start costing money: see
[`docs/costs.md`](docs/costs.md).
