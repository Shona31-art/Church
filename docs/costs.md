# Running costs

Free-first: every external service is optional or on a free tier until real
usage needs more. **Prices change — every figure marked "verify" must be
checked on the provider's pricing page before you rely on it.** Amounts are in
the provider's currency; convert to rand at the day's exchange rate.

## Inventory

| Service | What it's used for | Can it be removed? | Free option / limit | When it starts costing | Cheaper alternative |
|---|---|---|---|---|---|
| **Supabase** (Postgres, Auth, Storage, Realtime) | All data, logins, RLS, support screenshots, live chat | No — it's the backend | Free plan: small database and storage quotas, limited monthly active users, projects pause after a week idle, no self-serve backups (**verify current limits**) | When the database/storage outgrows the free quota, or you need daily backups for real church data → Pro plan, about US$25/month per project (**verify**) | Self-host Supabase (open source) on a VPS — cheaper at scale, more ops work |
| **Vercel** (hosting) | Runs the Next.js app | Replaceable | Hobby plan is free **but is for non-commercial use** (**verify terms**) | As soon as churches pay you, Vercel's terms expect the Pro plan, about US$20 per team member/month (**verify**) | Cloudflare Workers/Pages free tier (via OpenNext), Netlify, or a small VPS with Docker. The app has no Vercel-only features, so it moves without code changes. |
| **Anthropic API** (AI writer, sermon notes, counseling, Bible study, taglines, quiz) | Optional AI features | Yes — leave `ANTHROPIC_API_KEY` blank; every feature has a non-AI fallback | Pay per token; no free tier for production (**verify**) | From the first AI request | Set `ANTHROPIC_MODEL` to a smaller, cheaper model; lower `AI_CALLS_PER_USER_PER_HOUR`; switch AI off per feature |
| **Stripe** (church subscriptions, member giving) | Card payments | Yes — without it, Billing and Giving show "not set up" and plans are managed by the platform admin | No monthly fee; per-transaction fees (**verify ZA rates**) | Only when money moves | **Verify Stripe accepts South African merchants for your entity**; Paystack (Stripe-owned) and PayFast are common SA options and would replace `lib/stripe.ts` + the webhook |
| **Email** (invites, password resets) | Sent by Supabase Auth | No (needed for invites/resets) | Supabase's built-in sender is free but heavily rate-limited — fine for development only | Real churches need custom SMTP: Brevo, Resend and Amazon SES all have free/low tiers (**verify limits**) | Any SMTP provider — configured in Supabase, not in this code |
| **Notifications** (crisis alerts, booking decisions) | Optional webhook | Yes — default is in-app only | Make.com and n8n Cloud have free tiers (**verify operation limits**); n8n self-hosted is free | If alert volume exceeds the free tier | Self-hosted n8n |
| **bible-api.com** | Bible text (World English Bible) | Replaceable | Free, no key, public domain text | Never (rate-limited; the app degrades gracefully) | Bundle the WEB text in the database |
| **GitHub Actions** (CI) | Type-check, lint, tests, build on every push | No (it's the safety net) | Free for public repos; private repos get free minutes each month (**verify**). One CI run takes a few minutes | Only with very frequent pushes on a private repo | Run checks locally before pushing |
| **Domain name** | Your address | — | — | Yearly registration (a `.co.za` is typically a low annual fee — **verify with a registrar**) | — |
| Fonts (Google Fonts), icons (emoji) | UI | — | Free | Never | — |

Not used, on purpose: paid analytics, paid monitoring, maps, AI image
generation (posters are drawn in the browser from templates at no cost),
document-generation services (CSV/JSON exports are built in).

## What each plan costs you to run

**Basic is designed to cost you nothing per church** beyond your fixed
hosting (it stays inside the free tiers until you have many churches):

| On Basic (no running cost) | Not on Basic (costs per use) |
|---|---|
| Members (up to 50), Announcements, Calendar, Pastoral care, Prayer board & wall, Journal, Bible reader, Bible games, Service planner, Pastor booking, text chat with profile photos, Giving (Stripe's fee comes out of each gift), Support | AI writing help (`ai_assist`), Sermon AI, AI counseling, Bible study AI, Poster AI, chat voice notes (`chat_voice`, Storage), chat photos (`chat_photos`, off everywhere by default) |

On Basic the prayer board still suggests verses, from a built-in keyword
list instead of AI. A Super admin can switch any of these on for one church
(e.g. a pilot) from the platform console.

## Cost by stage

| Stage | Expected cost | Notes |
|---|---|---|
| **Development** | **R0/month** | Supabase free project, Vercel Hobby (non-commercial), Stripe test mode, AI off or a few test calls, built-in Supabase email. |
| **Early church usage (pilot, not yet charging)** | **≈ R0/month** + domain | Same as above plus a free SMTP tier for real emails. Turn AI on only if a church will use it; the hourly cap bounds the bill. |
| **Charging churches** | Hosting plan (Vercel Pro **or** a free/cheap alternative) + Supabase Pro once you need backups + payment fees + AI usage | Upgrade one service at a time, when its usage requires it. Supabase Pro is the most important upgrade for real data (daily backups). |
| **Growth** | Scales with database size, storage, AI usage and payment volume | Watch the Supabase usage page and the Anthropic console monthly. |

## Built-in safeguards against surprise bills

- **AI**: per-person hourly cap stored in Postgres (`AI_CALLS_PER_USER_PER_HOUR`,
  default 30); inputs are truncated before sending (transcripts to ~30k
  characters, counseling to the last 20 turns); 30-second timeout with one
  retry; AI is never called for crisis messages.
- **Uploads**: support screenshots limited to 5 MB PNG/JPEG/WebP/GIF by the
  storage bucket itself; no other uploads exist.
- **Lists**: every list that can grow is paginated server-side (25 per page);
  nothing loads a whole table into the browser.
- **Stripe webhook**: idempotent (each event processed once) and returns an
  error only when a retry is actually useful.
- **Realtime**: only open chat threads subscribe; no polling anywhere.
- **Notifications**: one webhook call per event, 5-second timeout, no retries.
