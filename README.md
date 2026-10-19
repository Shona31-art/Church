# Grace-bound — church operating system

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
| `NEXT_PUBLIC_APP_URL` | yes in prod | Base URL for invite/reset emails and Stripe redirects |
| `JOURNAL_ENCRYPTION_KEY` | for Journal | 64 hex chars (`openssl rand -hex 32`). Losing it = journals unreadable |
| `NEXT_PUBLIC_APP_TIMEZONE` | no | Timezone for showing/entering times (default `Africa/Johannesburg`) |
| `ANTHROPIC_API_KEY` | no | Enables AI features; each has a non-AI fallback |
| `ANTHROPIC_MODEL` | no | Model override (default `claude-opus-5-5`) — a smaller model costs less |
| `AI_CALLS_PER_USER_PER_HOUR` | no | Per-person AI cap (default 30) — protects the API bill |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PREMIUM` | no | Billing and giving (Stripe test mode is free) |
| `NOTIFY_WEBHOOK_URL`, `NOTIFY_WEBHOOK_SECRET` | no | Send alerts via a Make.com/n8n webhook; blank = in-app only |
| `CRON_SECRET` | yes in production | Lets Vercel Cron call `/api/cron/expire-chat-media` (deletes voice notes after 90 days). Blank = the job refuses to run |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | no | Phone/computer pop-ups for the notification bell (Web Push). Blank = bell only. See below |
| `NOTIFICATIONS_WEBHOOK_SECRET` | with pop-ups | Secret the Supabase Database Webhook sends to `/api/notifications/push` |
| `PEXELS_API_KEY` | no | Free stock photo search in the poster editor (free key from pexels.com/api). Blank = uploads only |

### Stripe (optional)

Stay in Test mode. Create "Basic" and "Premium" products with monthly prices →
copy the price IDs into `STRIPE_PRICE_*`; copy the secret key; add a webhook to
`https://<your-domain>/api/stripe/webhook` (locally:
`stripe listen --forward-to localhost:3000/api/stripe/webhook`) for these
events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`,
`invoice.payment_succeeded`, `invoice.payment_failed`,
`customer.subscription.updated`, `customer.subscription.deleted`. Without
Stripe, Billing shows "not set up" and plan changes go through Super Admin.
Plan prices shown in the app come from the `plans` table — keep them equal to
the Stripe prices.

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
   `notifications`, event **Insert** only, type HTTP Request, method POST,
   URL `https://<your-domain>/api/notifications/push`, add header
   `x-webhook-secret` = your `NOTIFICATIONS_WEBHOOK_SECRET`.

Then on a phone: open the live site (HTTPS) → My account → Notifications →
Turn on → Send a test. On iPhone, add the app to the Home Screen first (iOS 16.4+).
Pop-ups don't work in `pnpm dev` (the service worker is production-only).

### Creating a Super Admin

Deliberately not possible from the app. Create an auth user, then in the SQL Editor:

```sql
insert into app_users (id, church_id, name, email, role)
values ('<auth-user-id>', null, 'Platform Owner', 'owner@example.com', 'super_admin');
```

---

## Checks & tests

```bash
pnpm typecheck   # TypeScript strict
pnpm lint        # ESLint (next/core-web-vitals)
pnpm test        # unit tests + database/RLS tests
pnpm build       # production build
```

`pnpm test` runs every migration against real Postgres (PGlite — Postgres
compiled to WebAssembly, no Docker needed), then acts as real signed-in users
with RLS enforced: privilege escalation, cross-church access, DM privacy,
deactivated accounts, plan-catalogue tampering, counseling escalation, RSVP
scope, draft visibility, booking cancellation, pastoral-note confidentiality,
journal privacy, audit-log integrity and member erasure. Unit tests cover
permissions, feature gating, navigation, timezone conversion, journal
encryption storage, money parsing, CSV safety and Stripe status mapping.
GitHub Actions (`.github/workflows/ci.yml`) runs all four checks on every push.

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
| Product logo, photo placeholders, sign-in layout | `components/brand/` (`BrandMark`, `PhotoPlaceholder`, `AuthShell`) |
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
| Billing / Stripe webhook | `app/dashboard/billing/`, `app/api/stripe/webhook/route.ts`, `lib/billing.ts` |
| Giving, giving report & CSV | `app/dashboard/giving/`, `app/api/giving/export/route.ts`, `lib/giving.ts` |
| Journal encryption | `lib/encryption.ts` (tested) |
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
  Postgres. **Before real users, walk through every role with the seeded demo
  logins**, and add Playwright E2E tests once a test Supabase project exists.
- **Journal storage fix is reasoned, not observed.** The old code stored the
  JSON text of a Buffer in `bytea` columns; new code writes hex and reads both
  formats (unit-tested). Confirm by saving and reading one entry after deploying.
- **Brand assets (placeholders):** the product logo is a gold square drawn in one
  place (`components/brand/BrandMark.tsx`), and labelled "Awaiting church photo"
  boxes (`components/brand/PhotoPlaceholder.tsx`) mark the landing hero and the
  sign-in brand panel. The dashboard sidebar shows the church's initials in place
  of a church logo. Supply a real logo (SVG) and photos before launch.
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
- **Member email changes** aren't supported in the app (email is the sign-in;
  a church admin or super admin would change it in Supabase Auth).
- **Moving someone to another church** (Super Admin) leaves their old prayers,
  messages and gifts with the old church.
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
  The web app manifest has **no icons yet** (brand placeholder): add
  192×192 and 512×512 PNGs of the logo before launch.
- **Poster editor**: built and type-checked, but not yet used on real phones or against real Supabase Storage/Pexels. No PDF export (PNG/JPG only) or landscape/projector size yet. A canvas can't be fully screen-reader friendly; the Layers list and properties panel give keyboard access to every element. Unsaved work is kept on the device that was editing (not synced). Stock photo search needs `PEXELS_API_KEY`; its per-person limit is per server instance.
- **Error tracking:** only server `console.error` logs. Add a Vercel log drain
  (or a free Sentry tier) before launch.
- **Stripe** is unverified against a real test account.
- `support_ticket_messages.attachment_url` is unused but kept so no data is lost.

Running costs and when each service would start costing money: see
[`docs/costs.md`](docs/costs.md).
