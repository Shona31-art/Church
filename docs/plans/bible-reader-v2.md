# Plan: Bible reader v2

Status: **built 2026-10-17** (steps 1–7 on `dev`; awaiting device testing). Decision record:
[`docs/adr/0001-bible-text-hosting-and-offline.md`](../adr/0001-bible-text-hosting-and-offline.md).

## Agreed scope

- **Versions:** KJV, World English Bible (WEB), American Standard (ASV),
  Young's Literal (YLT), all public domain. Designed so licensed versions
  can be added later; no application for them is made now.
  *Bible in Basic English (BBE) left out:* it's public domain in the US
  but still under Cambridge University Press copyright elsewhere.
- **Navigation like a Bible app:** book → chapter → verse picker, a "go
  to" box that understands `John 3:16`, `jn 3`, `1 cor 13:4-7`, and
  Prev/Next that crosses books (Malachi 4 → Matthew 1).
- **Offline:** a "Download for offline" button per version (about 4 MB
  each, about 1.3 MB to download). Once downloaded, it reads with no data.
- **Highlights & notes:** tap verses to highlight (5 colours), bookmark,
  add a private note, copy or share.
- **Compare versions** side by side.
- **Word search** across a whole version.
- **Reading comfort:** font size, line spacing, and remembering the last
  place read on each device.
- Stays on the **Basic plan**: no running cost (see ADR).

## Architecture

| Part | Server or client | Why |
|---|---|---|
| Bible text | Static JSON files in `public/bibles/` (Vercel CDN) | Free, fast, cacheable offline |
| `/dashboard/bible` home | Server component | Needs the member's saved verses; normal app page |
| `/dashboard/bible/read` | Server shell (sign-in and plan check) + client `BibleReader` | Chapter changes are instant and work offline; the shell holds no personal data, so caching it for offline is safe |
| Highlights / bookmarks / notes | Server actions (Zod-validated) → Supabase with RLS | Same pattern as the rest of the app; RLS is the real guard |
| Search | Client, in a Web Worker | Searching ~31,000 verses without freezing the screen; no server cost |
| Offline downloads | Service worker (`public/sw.js`, hand-written, no new package) | Keeps the text files on the phone |
| Preferences, last place read | `localStorage` on the device | Per-device conveniences; work offline. Not synced between devices in v1 |

**Data flow for reading:** the browser asks for `/bibles/kjv/43-john.json`.
The service worker answers from the phone's copy if there is one;
otherwise it fetches from the CDN and keeps a copy. `BibleReader` shows the
chapter, then asks the server for this member's highlights, bookmarks and
notes on that chapter. **Offline:** the text still shows, and the
highlight and note buttons say "Needs a connection" rather than failing
silently.

**File format** (one per book per version):
`{"book":"John","chapters":[["In the beginning was the Word…", …], …]}`.
Verse 1 is index 0, which keeps files small.

## Data model

New table, migration #27 `supabase/bible_reader_v2.sql`:

| `bible_highlights` | |
|---|---|
| `id` | uuid primary key |
| `user_id` | → `app_users`, cascade delete (POPIA erasure) |
| `book`, `chapter`, `verse` | reference only, never the text |
| `color` | one of `yellow`, `green`, `blue`, `pink`, `purple` |
| `created_at`, `updated_at` | |
| unique `(user_id, book, chapter, verse)` | one colour per verse; picking another colour replaces it |

- **RLS:** owner-only select/insert/update/delete, with **no admin
  bypass**. Same rule as notes and the journal: pastors and admins never
  see a member's highlights.
- **Sensitive columns:** none hold sensitive personal information, but
  highlights and notes reveal someone's private devotional life, so
  they're treated as private.
- **Existing tables** `bible_bookmarks` and `bible_notes` are kept
  unchanged. `bible_bookmarks` gets an `updated_at` column to meet the
  table standard.
- **Not stored:** which version someone was reading. A reference such as
  "John 3:16" means the same verse in all four versions.
- **POPIA:** `bible_highlights` is added to the member data export and to
  the erasure list in `app/api/members/[id]/export/route.ts`.

## Who can do what

| Action | Member | Pastor / Church admin | Super admin | Signed out | Church without the Bible feature |
|---|---|---|---|---|---|
| Read, compare, search, download | Yes | Yes | Yes | No (sign-in page) | No (upgrade message) |
| Own highlights / bookmarks / notes | Yes | Yes | Yes | No | No |
| See **someone else's** highlights / bookmarks / notes | No | No | No | No | No |
| Fetch the raw text files `/bibles/*` | Yes | Yes | Yes | Yes: public-domain text, no personal data | Yes |

The text files being public is intentional. They contain only public-domain
Scripture, and requiring sign-in would break offline caching.

## Workflows

1. **Go to a verse:** tap the reference title (e.g. "John 3") → pick book
   (Old/New Testament tabs, filter box) → pick chapter → pick verse → the
   reader scrolls to that verse and briefly marks it. Or type `jn 3:16`
   in the go-to box. Unrecognised input shows "Try something like John
   3:16".
2. **Highlight:** tap a verse (or several) → an action bar appears →
   choose a colour → saved, with the colour shown on the verse. Tap the
   same colour again to remove it. Fails offline or on error: the
   highlight is undone on screen and a message says it wasn't saved.
3. **Note:** select verse(s) → Note → a popup for the text → saved →
   a small note icon appears by the verse; tap it to read, edit or
   delete. Delete asks for confirmation.
4. **Copy / share:** select verses → Copy gives
   `"…text…" John 3:16 (KJV)`. Share opens the phone's share sheet;
   desktops fall back to copying.
5. **Compare:** reader menu → Compare with… → choose a second version →
   verses interleaved on phones, in two columns on desktop.
6. **Search:** search box → type `shepherd` → results grouped by book,
   with the word highlighted. Shows the first 100 results, then
   "Show more". Filter by Old/New Testament. Tap a result to open it in
   the reader. If the version isn't downloaded, it says "Searching needs
   about 1.3 MB of data" before starting.
7. **Download for offline:** Bible home → Versions → Download (progress
   shows books saved out of 66) → "Available offline ✓", with a Remove
   button and the storage used. On iPhone, a tip says to add the app to
   the home screen so iOS doesn't clear the download.
8. **Signing out** clears the cached reader page but keeps the downloaded
   Bible text, which isn't personal.

## Files

```
scripts/build-bibles.mjs           one-off: download + convert texts (documents sources & licences)
public/bibles/versions.json        list of versions: id, name, year, licence note, size
public/bibles/{kjv,web,asv,ylt}/   66 files each: 01-genesis.json … 66-revelation.json
public/sw.js                       service worker (Bible files + reader page only)
app/manifest.ts                    web app manifest so "Add to Home Screen" works

lib/bible/books.ts                 book names, abbreviations, testament, chapter counts
lib/bible/reference.ts             parse/format "John 3:16"-style references (unit tested)
lib/bible/versions.ts              version list shared by server and client
lib/bible/text.ts                  server: read a verse/chapter from the local files (daily verse, AI study)
lib/bible/offline.ts               client: download / remove / check status
lib/bible/search.worker.ts         search running in the background
lib/bible.ts                       becomes lib/bible/index.ts re-exporting the above (nothing else breaks)

app/dashboard/bible/page.tsx       redesigned: continue reading, go-to box, versions & downloads, saved verses & highlights
app/dashboard/bible/read/page.tsx  server shell
app/dashboard/bible/read/actions.ts  server actions: chapter annotations, highlight, bookmark, note (Zod)
app/dashboard/bible/search/page.tsx

components/bible/BibleReader.tsx   the reader
components/bible/PassagePicker.tsx book → chapter → verse
components/bible/VerseActionBar.tsx highlight / bookmark / note / copy / share
components/bible/ReaderSettings.tsx font size, spacing, compare
components/bible/BibleSearch.tsx
components/bible/OfflineDownloads.tsx

supabase/bible_reader_v2.sql       migration #27, with a plain-language explanation
tests/unit/bible-reference.test.ts
tests/unit/bible-text.test.ts      the files are complete (verse counts per version)
tests/db/bible.test.ts             RLS: owner-only, no admin bypass
```

**Also changes:** the daily verse on the dashboard home and the AI Bible
study tool read from the local files instead of bible-api.com. That
removes the third-party dependency completely. README: migration #27, the
`build-bibles` script, and the offline behaviour.

## Build order and check-ins

1. **Text files:** script, conversion, verse-count checks. *Report sizes.*
2. **Reader + picker + go-to box.** **Stop for your review:** it's the new
   reading screen and sets the pattern.
3. **Highlights, bookmarks, notes + migration #27 + RLS tests.** **Stop:**
   personal data.
4. **Compare + reading settings.** *Batch report.*
5. **Search.** *Batch report.*
6. **Offline downloads + service worker + manifest.** **Stop:** test it on
   your phone.
7. **Bible home redesign, daily verse and AI study switched to local
   text.** **Stop:** a page members see first.

## Risks and trade-offs

- **Repo grows by about 18 MB** (text files, one-time). Accepted for zero
  running cost and no third-party dependency.
- **Service worker:** a buggy one can serve stale files. Mitigation: it's
  scoped to `/bibles/*` and the reader route, the cache is versioned, and
  it can be switched off by deploying an empty worker.
- **Offline needs one visit online first** on each phone, before the
  reader can open without data. It also opens only for someone already
  signed in on that phone.
- **iPhone storage eviction:** Safari may clear website data after weeks
  of non-use unless the app is on the home screen. Shown as a tip on the
  download screen.
- **Verse numbering** differs slightly between versions in a few places
  (e.g. 3 John 14–15). Highlights follow the reference, so in those rare
  spots a highlight may sit one verse off in another version.
- **Search on low-end phones:** loading a whole version (about 4 MB of
  text) is fine on most phones. Very old ones may take a few seconds;
  a progress message covers it.
- **Data quality of the sources** is checked by the verse-count test.
  Any version that fails is dropped from v1 rather than shipped wrong.
- **Not in v1:** highlights and notes offline (they need a connection),
  syncing the last place read between devices, reading plans, audio Bible.
