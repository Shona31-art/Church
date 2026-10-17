# ADR-0001: Self-host public-domain Bible text as static files, with a service worker for offline

**Status:** Accepted (2026-10-17)
**Date:** 2026-10-17
**Deciders:** Product owner (Vishona)

## Context

The Bible reader fetches every chapter live from bible-api.com when a page
is requested. That worked for a prototype, but the new requirements need
more:

- **Several versions**, all public domain: KJV, World English Bible (WEB),
  ASV and Young's Literal (YLT). Licensed versions (NIV, ESV, Afrikaans,
  Zulu…) may be added later, once permission is granted.
- **Offline reading:** a member downloads a whole version once, then reads
  it with no data, like the YouVersion app.
- **Word search** across the whole Bible, **comparing versions** side by
  side, and **instant chapter-to-chapter navigation**.
- **Basic plan must stay free to run**: no feature on it may add a
  per-use cost.

Problems with today's approach:

- bible-api.com allows about 15 requests per 30 seconds **per IP address**.
  Every member's request leaves through our Vercel server, so the whole
  platform shares one limit. A busy Sunday would break the reader for
  everyone.
- There's no way to search, to download a version, or to read offline.
- It's an uptime dependency on a free, volunteer-run service.

## Decision

Convert the public-domain texts once, with a script in the repo, into one
small JSON file per book per version. Commit them under `public/bibles/`
so Vercel's CDN serves them. A hand-written service worker caches those
files: on demand as people read, or all 66 books at once when they press
"Download for offline". The reader becomes a client component that reads
the files directly, so changing chapter needs no server round trip.
Search runs in the browser, in a Web Worker, over the chosen version.

Personal data (highlights, bookmarks, notes) stays in Supabase under
owner-only Row Level Security, exactly like today's bookmarks and notes.

## Options Considered

### Option A: Keep bible-api.com, add caching
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Cost | Free |
| Scalability | Poor: one shared rate limit for the whole platform |
| Team familiarity | High (already in place) |

**Pros:** No new files; smallest change.
**Cons:** Offline can't work: the text lives on someone else's server.
Search can't work: the API has no search. Still rate-limited, and still
dependent on a third party's uptime.

### Option B: Static JSON files on Vercel's CDN, plus a service worker (recommended)
| Dimension | Assessment |
|---|---|
| Complexity | Medium (conversion script, service worker) |
| Cost | Free: static files count only toward Vercel bandwidth (one full version ≈ 1.3 MB compressed) |
| Scalability | Excellent: served from the CDN, nothing to rate-limit |
| Team familiarity | Medium: service workers are new to this codebase |

**Pros:** Offline, search, compare and instant navigation all become
possible. No running cost, so it stays on Basic. No third-party dependency.
**Cons:** Adds about 18 MB of text files to the repo. Service worker bugs
can serve stale files, so it's scoped narrowly (see Consequences).

### Option C: Load the text into Supabase Postgres
| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost | ~31,000 rows per version. Fits the free tier, but every chapter read becomes a database query and uses Supabase egress |
| Scalability | Good, but takes database capacity away from real app data |
| Team familiarity | High |

**Pros:** Server-side full-text search with Postgres `tsvector`.
**Cons:** Doesn't help offline: we'd still need to ship the files to the
phone. Puts load on the paid-tier resource for content that never changes.

### Option D: Files in Supabase Storage
| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost | Uses Supabase egress (5 GB on the free plan) instead of Vercel's larger allowance |
| Scalability | Good |
| Team familiarity | High |

**Pros:** Keeps the repo small.
**Cons:** Same offline work as B, but slower to reach and with a tighter
free allowance, and it needs an upload step for each environment.

## Trade-off Analysis

Offline reading and whole-Bible search mean the text has to reach the
phone as files, whatever we choose. Once that's true, the best place for
those files is the CDN that already serves the app (B). A database (C) or
a second storage service (D) adds cost and moving parts without enabling
anything new. The real cost of B is repo size and service-worker care. We
limit that by keeping the service worker to the Bible files and the
reader page only.

## Consequences

- **Easier:** offline, search, compare, instant navigation, and adding
  another public-domain version (run the script, commit the files).
- **Harder:** the service worker must be versioned and narrowly scoped,
  so a bad deploy can't keep serving an old app. It only touches
  `/bibles/*`, the reader page and its static assets. It can be removed
  by deploying an empty worker.
- **Repo size** grows by about 18 MB, a one-time cost: the text never changes.
- **Licensed versions later** (NIV etc.) would come through a licensed API
  and be online-only. The reader's version list is designed to hold both
  kinds.
- **Revisit:** iPhones may clear website storage after weeks of non-use
  unless the app is added to the home screen. The download screen will
  say so.

## Action Items

1. [ ] `scripts/build-bibles.mjs`: download and convert KJV, ASV, YLT
       (scrollmapper/bible_databases) and WEB (eBible.org) to per-book JSON
2. [ ] Verify verse counts per version against a known total (≈31,102 verses)
3. [ ] Service worker + web app manifest, scoped to the Bible reader
4. [ ] Switch the daily verse and AI study tool off bible-api.com
