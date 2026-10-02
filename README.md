# Grace-bound — church operating system

A multi-church web app (Next.js 14 App Router + Supabase + Vercel) for pastoral
care, prayer, sermons, the Bible and everyday church admin. It merges the
earlier web build with the features of the Android "Church OS" prototype
(`Downloads/church-os`), which was local-only and had no real accounts.

> ⚠ **If you already have a Supabase database running an earlier version of
> this app, run `supabase/security_fix_app_users.sql` on it now.** It closes a
> privilege-escalation hole (any member could make themselves church admin or
> platform super admin). Then run `supabase/church_os_features_schema.sql`
> and `supabase/booking_security_fix.sql` (members could submit a booking
> that was already "approved").

---

## Quick start (local)

Prerequisites: Node 20+, pnpm (`corepack enable` picks up the pinned version),
a free Supabase project.

```bash
pnpm install
cp .env.example .env.local      # then fill in the values — see table below
pnpm dev                        # http://localhost:3000
```

Then set up the database (next section), open http://localhost:3000 and click
**Start free trial** to create your church and admin login.

### Database setup (Supabase SQL Editor)

Run these files **in this exact order** (the test suite runs the same order —
`tests/db/harness.ts` — so if it passes in CI, this order works):

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
| 14 | `storage_policies.sql` | Support-ticket uploads (create the bucket first — step below) |
| 15 | `bible_games_schema.sql` | Quiz + 40 seed questions |
| 16 | `bible_games_v2_schema.sql` | Church-specific questions, game types |
| 17 | `giving_schema.sql` | Giving records (**was missing from the old README**) |
| 18 | `church_os_features_schema.sql` | Pastoral care log, birthdays, prayer wall, verse puzzle, AI rate limiting, member deletion fixes |
| 19 | `booking_security_fix.sql` | **Required.** Booking requests must start "pending"; availability blocks locked to your own church and pastors |

Two manual dashboard steps:

1. **Storage → New bucket** named `attachments`, marked Public — *before* step 14.
2. **Database → Replication**: enable `chat_messages` (or run
   `alter publication supabase_realtime add table chat_messages;`). Without it,
   chat works but only updates on refresh.

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
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **Server only.** Registration, invites, member deletion, audit log, POPIA export |
| `JOURNAL_ENCRYPTION_KEY` | for Journal | 64 hex chars (`openssl rand -hex 32`). Losing it = journals unreadable |
| `ANTHROPIC_API_KEY` | no | Enables AI features; each has a non-AI fallback |
| `ANTHROPIC_MODEL` | no | Model override (default `claude-opus-5-5`) |
| `AI_CALLS_PER_USER_PER_HOUR` | no | Per-person AI cap (default 30) — protects the API bill |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PREMIUM` | no | Billing (Stripe test mode is free) |
| `NEXT_PUBLIC_APP_URL` | yes in prod | Base URL for Stripe redirects |

### Stripe (optional)

Stay in Test mode. Create "Basic" and "Premium" products with monthly prices →
copy price IDs into `STRIPE_PRICE_*`; copy the secret key; add a webhook to
`https://<your-domain>/api/stripe/webhook` (locally:
`stripe listen --forward-to localhost:3000/api/stripe/webhook`). Without Stripe
the Billing page shows "not configured"; nothing else depends on it. Change
plans only via the app or Super Admin — the webhook relies on `plan_key`
metadata that edits made directly in the Stripe dashboard won't carry.

### Creating a Super Admin

Deliberately not public. Create an auth user, then in the SQL Editor:

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

`pnpm test` includes **database tests that run every migration against real
Postgres** (PGlite — Postgres compiled to WebAssembly, no Docker needed) and
then act as real signed-in users with RLS enforced: privilege escalation,
cross-church access, pastoral-note confidentiality, prayer-wall visibility,
journal privacy, audit-log integrity, member erasure, and booking requests
that can't skip approval. GitHub Actions
(`.github/workflows/ci.yml`) runs all four checks on every push.

---

## Deploying (Vercel)

1. Push to GitHub, import the repo in Vercel (framework auto-detected; it
   uses pnpm from `packageManager`).
2. Add every env var from the table under Project → Settings → Environment
   Variables. Use **separate Supabase projects** for Preview and Production if
   you can — see "Environments" below.
3. Branches: work on `dev` (each push gets a Vercel Preview URL); merge
   `dev` → `main` only when a change is approved for Production.
4. Supabase → Authentication → URL Configuration: set the Site URL and add the
   Vercel URLs to Redirect URLs (needed for invite and password-reset emails).
5. Before real users: configure custom SMTP (Supabase's built-in email is
   heavily rate-limited), confirm backups (Pro plan has daily backups; the free
   plan has none you can restore yourself), and set up a log drain / error
   tracking (see Known gaps).

**Environments:** I couldn't check whether your Preview and Production point at
the same Supabase project. If they do, any test (including `pnpm seed`) touches
live data — ask the Supabase org owner for a second project for dev/preview.

---

## Roles — who can do what

| | Member | Dept. leader | Pastor | Church admin | Super admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Own prayer board, journal, games, Bible, giving | ✓ | ✓ | ✓ | ✓ | – |
| Share to / comment on prayer wall | ✓ | ✓ | ✓ | ✓ | – |
| Remove items from prayer wall | – | – | ✓ | ✓ | – |
| Post announcements | – | own dept. | ✓ | ✓ | – |
| Create events / posters | – | ✓ | ✓ | ✓ | – |
| Pastoral care log, birthdays, follow-ups | – | – | ✓ | ✓ | **no** (by design) |
| Edit members' role / status / department | – | – | ✓ (not admins) | ✓ | – |
| Grant or remove church admin | – | – | – | ✓ | ✓ |
| Permanently delete member / POPIA export | – | – | – | ✓ | – |
| Read anyone's journal | – | – | – | – | – (never) |
| Billing | – | – | – | ✓ | – |
| All churches, plans, module overrides | – | – | – | – | ✓ |

Every rule is enforced server-side and in Postgres RLS; menus only hide links.

---

## Where things live

| To change… | Go to |
|---|---|
| Any AI behaviour, model, timeout | `lib/ai.ts` (single entry point); rate limit: `lib/ai-quota.ts` |
| Which roles see which menu items | `app/dashboard/layout.tsx` |
| Which plan includes which module | `plan_modules` rows (SQL); check in `lib/paywall.ts` |
| Dashboard home | `app/dashboard/page.tsx` |
| Prayer board / wall / AI prayer drafts | `app/dashboard/prayer-board/` (`actions.ts` holds all server logic) |
| Pastoral care log | `app/dashboard/pastoral-care/`, types in `lib/pastoral-care.ts` |
| Pastor booking: types, statuses, allowed approvals | `lib/booking.ts` (tested); input validation `lib/booking-schemas.ts`; actions in `app/dashboard/booking/**/actions.ts` |
| Birthday reminder logic | `lib/birthdays.ts` (tested) |
| Member edit, deletion, POPIA export | `app/dashboard/members/[id]/`, `app/api/members/[id]/export/route.ts` |
| Bible reader / study AI | `app/dashboard/bible/`, `lib/bible.ts` |
| Games (quiz, word search, verse puzzle) | `app/dashboard/games/`, `lib/verse-puzzle.ts` |
| Announcement AI writer | `app/dashboard/announcements/new/` |
| Session refresh & login redirects | `middleware.ts`, `app/login/` |
| Audit logging | `lib/audit.ts` |
| Crisis keywords & helplines | `lib/crisis-detection.ts` |
| Colours & fonts | `tailwind.config.ts`, `app/globals.css` |
| Database schema & RLS | `supabase/*.sql`; tests in `tests/db/` |

---

## What changed in this pass (merge with the Android app)

**Security fixes**
- 🔴 `app_users` privilege escalation (member → church admin / super admin /
  other church) — fixed by trigger + policy, proven by tests.
- Owners could move their rows into another church's tenant (`church_id` was
  writable) — frozen on every church-scoped table.
- Audit logging had silently never worked (no insert policy) — now written by
  trusted server code only.
- AI quiz generation had no role check — any member could spend AI credits.
- Game scores were unvalidated — anyone could post any score.
- Member role edits accepted any value from the form (a pastor could grant
  church admin); now validated to mirror the database rules.

**Bugs fixed**
- Landing page, dashboard home and games hub were all overwritten copies of
  other pages (landing showed "Not signed in.").
- Prayers could never be marked answered, so Testimonies was always empty.
- Pastors' member edits silently did nothing (RLS only allowed self-edits).
- "Permanently delete" failed for anyone who had posted, given or chatted
  (22 foreign keys had no delete rule); POPIA erasure was impossible.
- Chat re-subscribed to realtime on every keystroke, dropping messages.
- Word search "Play again" didn't reset; random games caused hydration errors.
- No session refresh middleware — people were signed out mid-task.
- Five copy-pasted AI calls with no timeout and an outdated model.

**Features ported from the Android app**
- Dashboard home: verse of the day, upcoming events, announcements,
  birthdays this week & follow-ups due (pastors/admins).
- Pastoral care log (confidential; hospital visits, counselling, follow-ups).
- Church prayer wall with "I prayed" and encouragement comments; mark
  answered → testimony.
- AI prayer writer, Bible study AI (explain / devotional / cross-references /
  7-day plan), AI announcement writer (app, WhatsApp, email, bulletin).
- Verse puzzle game; games hub with church scoreboard.
- Member birthdays; POPIA data export and erasure.

---

## Known gaps & deliberate placeholders

- **Signed-in flows are not tested end-to-end in a browser.** No Supabase
  project or Docker was available while building. Verified instead: type-check,
  lint, production build, public pages over HTTP, and 28 RLS tests on real
  Postgres. **Before real users, walk through the app with the seeded demo
  logins** — and add Playwright E2E tests once a test Supabase project exists.
- **Brand assets:** the landing page uses a plain square as a stand-in logo
  and no photography. Supply a real logo (SVG) and images before launch. The
  Android app's images were AI-generated (they carry Google C2PA
  "Generative AI" metadata) and weren't reused.
- **Crossword** from the Android app isn't built — generating valid
  interlocking crosswords is a real algorithm, not a template.
- **No notifications:** birthday alerts, crisis escalations and follow-ups
  show in the app only; no email/WhatsApp/push is sent. The standing plan is
  Make.com webhooks called from server actions.
- **Error tracking:** only server `console.error` logs. Add a Vercel log drain
  or Sentry before launch.
- **Design:** kept the existing navy/gold "Grace-bound" direction agreed in an
  earlier session (not the Aperture default). Older interior pages (booking,
  service planner, support) haven't had a visual pass.
- **Remaining silent failures:** older forms in service planner, posters,
  support and super admin still return silently on some errors. Booking is
  done and is the pattern to copy: Zod schema → `useFormState` + `{ error }`
  → audit log for approvals (`app/dashboard/booking/`).
- **Booking requesters can't cancel** their own request yet (by design in the
  original schema — it needs its own explicit "cancel" action).
- **Crisis detection** is keyword matching — a tripwire, not a safety system.
  Review with a mental-health professional; helplines are South African.
- **Bible text** comes live from bible-api.com (WEB, public domain). If that
  service is down, the reader and verse of the day show a fallback message.
- **Stripe** is unverified against a real test account.
