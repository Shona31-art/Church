# ADR-0003: Poster editor built on Konva, with self-hosted fonts, Pexels stock photos and private Supabase Storage for uploads

**Status:** Accepted (2026-10-17)
**Date:** 2026-10-17
**Deciders:** Product owner (Vishona)

## Context

Poster Studio today fills one of three fixed layouts from a form. Churches
want something closer to Canva or PosterMyWall:

- Start from a **template** for common church occasions.
- **Move, resize, rotate and edit** anything on the poster.
- Add **several text boxes and fonts**, several **speakers with photos**,
  and photos as backgrounds.
- **Download** the finished poster.

Already decided with the product owner (2026-10-17): about 16 original church
templates (PosterMyWall's templates and photos are copyrighted and can't be
copied), free stock photos plus uploads, an open-source canvas library rather
than a paid SDK, and **Premium only** (Poster Studio is already a Premium
feature, `ai_poster`).

Constraints: React 18 and Next.js 14; no recurring licence fees; storage on
Supabase's free tier (1 GB across all churches); POPIA (uploaded speaker
photos are personal information); must work on phones as well as desktop.

## Decisions

### 1. Canvas engine: Konva + react-konva

| | Konva + react-konva (chosen) | Fabric.js | Polotno SDK |
|---|---|---|---|
| Licence / cost | MIT, free | MIT, free | Commercial licence, recurring fee |
| Fit with React | Declarative components (`<Text>`, `<Image>`, `<Transformer>`) | Imperative; needs a wrapper | Ships its own React UI |
| Move / resize / rotate | Built-in Transformer | Built-in | Built-in |
| Maintenance | Releases this month | Active | Active |
| Control over look | Full | Full | Limited to SDK theming |

`react-konva`'s newest version needs React 19, so we pin the React 18 line
(`react-konva@18.2.16`, tagged "legacy") with `konva@10`. Upgrading React
later means moving to `react-konva@19`, a contained change.

### 2. Photo library: Pexels API (not Unsplash)

| | Pexels (chosen) | Unsplash |
|---|---|---|
| Cost | Free | Free |
| Limits | 200 requests/hour, 20,000/month | 50/hour until approved for production (5,000/hour after) |
| Terms we must follow | Show "Photos provided by Pexels" with a link; credit the photographer where possible | Hotlink their URLs; call a "download tracking" endpoint whenever a photo is used; attribution |
| Export to PNG | Images allow CORS, so the canvas can export them | Same |

Pexels has fewer obligations, so less code to get wrong. Searches go through
our own server route (`/api/posters/stock`) so the API key stays on the
server, results are cached for a day, and each person is rate-limited.

### 3. Uploads: private Supabase Storage bucket, resized in the browser

Speaker photos and logos are resized in the browser before upload (≤ 2000 px,
WebP or JPEG, metadata stripped; `lib/image-resize.ts` already does this
for profile photos). They're stored in a private `poster-assets` bucket
under the church's folder and shown through short-lived signed URLs. A
`poster_assets` table lists each church's uploads so they can be reused, and
deleting a speaker photo is one click (POPIA).

### 4. Fonts: about 16 open-licence fonts, self-hosted

Fonts are served from the app (`public/fonts/poster/`, SIL Open Font
Licence), not from Google's servers. That way no visitor IP addresses go to
a third party (POPIA/GDPR), fonts render identically in the PNG export, and
the editor doesn't depend on another service.

### 5. Saved format: versioned JSON design + thumbnail

A poster is saved as a JSON "design" (size, background, list of elements),
validated with Zod on the server, plus a small thumbnail for the posters
list. The finished PNG is generated in the browser on demand, so full-size
images aren't stored and storage stays small. Existing simple posters keep
working as they are.

## Consequences

- **Easier:** templates are just data, so adding one is a JSON file; full
  control over the look; no fees.
- **Harder:** we build the editor UI ourselves (properties panel, layers,
  undo, snapping), which takes several sessions. Canvas editors are hard to
  make fully accessible, so every element is also listed in a
  keyboard-accessible Layers panel with form fields for its properties.
- **New packages:** `konva`, `react-konva`. **New env var:** `PEXELS_API_KEY`
  (optional; without it, the stock photo tab is hidden).
- **Legal:** templates and decorative artwork are original. Stock photos
  follow Pexels' licence, and the editor reminds people not to imply that
  someone in a stock photo endorses the event.
- **Revisit:** PDF export (would add a PDF library), more templates, and a
  landscape (projector screen) layout family.
