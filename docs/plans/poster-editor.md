# Plan: Poster editor (Poster Studio v2)

Status: **built 2026-10-17** (steps 1–5 on `dev`; awaiting real-device testing). Decision record:
[`docs/adr/0003-poster-editor.md`](../adr/0003-poster-editor.md).

## Agreed scope

- **Templates:** about 16 original church designs (list below), each with a
  square and a portrait layout.
- **Editing:** move, resize, rotate, layer order, duplicate, delete, lock;
  undo/redo; snapping guides; zoom.
- **Text:** any number of text boxes; about 16 fonts; size, weight, colour,
  alignment, line and letter spacing, shadow, outline.
- **Speakers:** a speaker block (photo in a circle, name, title). Add as
  many as needed.
- **Images:** upload photos and logos, search free stock photos, use any
  photo as the background with a darkness or colour overlay.
- **Elements:** shapes (rectangles, circles, lines, banners) and original
  Christian icons (cross, dove, crown, flame, open Bible, praying hands,
  church…).
- **Sizes:** Square 1080×1080, Instagram portrait 1080×1350, Story/WhatsApp
  status 1080×1920, A4 print (300 dpi, 2480×3508).
- **Download:** PNG (best quality) or JPG (smaller), at full size.
- **Premium only.** The current simple posters stay viewable.

### Templates

| # | Template | Feel |
|---|---|---|
| 1 | Sunday Service | Calm, photo background, big service time |
| 2 | Guest Speaker | Large speaker photo, name and title |
| 3 | Revival / Crusade | Bold, high-energy, flame motif |
| 4 | Youth Night | Bright, playful type |
| 5 | Worship Night | Dark, concert-style, light beams |
| 6 | Prayer Night / Vigil | Quiet, candle-light tones |
| 7 | Conference | Multi-speaker lineup, dates, venue |
| 8 | Women's Conference | Elegant serif, floral accents |
| 9 | Men's Breakfast | Strong type, warm tones |
| 10 | Baptism Sunday | Water motif, fresh blues |
| 11 | Easter | Cross and sunrise, "He is risen" |
| 12 | Christmas / Carols | Star, warm night palette |
| 13 | Kids / Holiday Club | Colourful, rounded shapes |
| 14 | Bible Study Series | Clean, editorial, series title |
| 15 | Thanksgiving / Harvest | Earthy, golden |
| 16 | General Announcement | Simple, flexible, uses church colours |

All are original designs: shapes, gradients, type and placeholder photo
slots. No copied artwork. Photo slots invite the user to add their own or
a stock photo.

## Architecture

| Part | Where | Why |
|---|---|---|
| Editor | Client component, loaded only on the editor page (`next/dynamic`, no server rendering) | Konva needs the browser; keeps the ~150 KB library off every other page |
| Design document | Versioned JSON, validated by a Zod schema shared by client and server | One source of truth; rejects malformed or oversized designs |
| Save / load | Server actions → `posters` table (RLS) | Same pattern as today |
| Uploads | Browser resizes, then uploads to the private `poster-assets` bucket via a signed upload URL from a server action | The service key never reaches the browser; small files |
| Stock search | `GET /api/posters/stock?q=` → Pexels (key on server, 1-day cache, per-person rate limit) | Hides the key; stays well inside Pexels' limits |
| Fonts | `public/fonts/poster/*.woff2`, loaded with the FontFace API before drawing | No third party; identical export |
| Export | `stage.toDataURL()` at full resolution in the browser | No server cost |
| Thumbnail | Small JPEG generated on save, stored in the bucket | Fast posters list |

**Editor layout:**
- **Desktop:** left rail (Templates, Text, Speakers, Photos, Elements,
  Background, Layers); canvas in the centre; properties panel on the right
  for the selected item; top bar with size, undo/redo, zoom, Save and
  Download.
- **Phone:** canvas on top, a bottom tab bar for the same tools, and
  properties in a bottom sheet.

## Data model (migration #29 `supabase/poster_editor.sql`)

**`posters`: new columns** (old ones kept for existing simple posters)

| Column | Notes |
|---|---|
| `design` | jsonb, the editor document (null for old posters). Size limit by check constraint (~200 KB) |
| `design_version` | integer, so the format can evolve |
| `width`, `height` | pixels |
| `thumbnail_path` | storage path of the list thumbnail |
| `title` | poster name in the list (falls back to `event_title`) |

**`poster_assets`**: `id`, `church_id`, `uploaded_by`, `storage_path`,
`kind` (`photo` | `logo`), `width`, `height`, `bytes`, `created_at`,
`updated_at`.
- RLS: visible to the church's poster makers. Insert into your own church
  only. Delete your own, or any as pastor/admin.

**Storage bucket `poster-assets`**: private, 5 MB limit, images only, path
`<church_id>/<uuid>.<ext>`. Policies match the table: the church's poster
roles can read and upload in their own church folder.

**POPIA:** uploads are listed in the member data export and can be deleted
from the photo library. Deleting a church deletes its folder.

## Who can do what (unchanged roles from today's Poster Studio)

| Action | Member | Department leader | Pastor | Church admin | Super admin |
|---|---|---|---|---|---|
| View and download the church's finished posters | Yes | Yes | Yes | Yes | Yes (support) |
| Create, edit and duplicate posters | No | Yes | Yes | Yes | No |
| Edit or delete someone else's poster | No | No | Yes | Yes | No |
| Upload photos to the church library | No | Yes | Yes | Yes | No |
| Delete a photo from the library | No | Own | Any | Any | No |
| Use stock photo search | No | Yes | Yes | Yes | No |
| All of the above require the Premium plan (`ai_poster`) | | | | | |

## Workflows

1. **New poster:** Posters → New → choose a size → a gallery of 16 template
   previews (filter by occasion) → pick one (or Blank) → the editor opens
   with the template loaded.
2. **Edit text:** tap a text box → its handles appear → double-tap to type
   on the poster, or edit in the properties panel (font, size, colour…).
3. **Add a speaker:** Speakers → Add speaker → upload a photo (or pick from
   the library) → type the name and title. The block is one group you can
   move and resize. Add more speakers the same way.
4. **Background photo:** Background → Photo → search stock or upload →
   adjust the darkness so text stays readable (a warning appears if text
   contrast is low).
5. **Save:** Save (also Ctrl/⌘+S). Unsaved changes are kept in the browser
   if the tab closes or the session expires, and offered back next time.
6. **Download:** Download → PNG or JPG → the full-size file is saved. A4
   downloads at print resolution.
7. **Change size:** switching the size reflows the template's layout. Items
   you placed yourself keep their relative positions.

## Files

```
supabase/poster_editor.sql                 migration #29 (+ plain-language header)
tests/db/poster-editor.test.ts             RLS for posters/design, assets table, storage policies
lib/posters/design.ts                      design document types + Zod schema + sizes (tested)
lib/posters/templates/*.ts                 16 templates (data), index with metadata
lib/posters/fonts.ts                       font list + loader
lib/posters/layout.ts                      reflow between sizes, snapping maths (tested)
lib/posters/history.ts                     undo/redo stack (tested)
app/dashboard/posters/editor/…             editor page (new and [id])
components/posters/editor/Editor.tsx       shell: rails, top bar, panels
components/posters/editor/Canvas.tsx       Konva stage, selection, transformer, guides
components/posters/editor/panels/*.tsx     Templates, Text, Speakers, Photos, Elements, Background, Layers, Properties
components/posters/TemplateGallery.tsx     template picker
app/dashboard/posters/editor-actions.ts    save/load/duplicate, signed upload URL, delete asset (Zod)
app/api/posters/stock/route.ts             Pexels proxy (auth, plan, rate limit, cache)
public/fonts/poster/                       self-hosted woff2 + OFL licence files
public/posters/elements/                   original SVG icons/shapes
```

**New packages:** `konva@10`, `react-konva@18.2.16` (MIT). **New env var:**
`PEXELS_API_KEY` (optional).

## Build order and check-ins (several sessions)

1. **Migration #29 + tests, design schema.** **Stop:** data and storage rules.
2. **Editor core:** canvas, select/move/resize/rotate, text editing,
   properties, layers, undo/redo, zoom, save/load, PNG/JPG download, one
   sample template. **Stop:** the new pattern; check the feel on phone and
   desktop.
3. **Fonts + all 16 templates + template gallery.** **Stop:** visual
   identity. I'll run the `design:design-critique` and
   `design:accessibility-review` skills here.
4. **Photos and speakers:** uploads library, speaker blocks, background
   photos with overlay, Pexels search with attribution. **Stop:** personal
   data (speaker photos).
5. **Elements and polish:** shapes and icons, snapping guides, keyboard
   shortcuts, duplicate poster, list thumbnails, unsaved-work recovery.
   *Batch report.*

## Risks and trade-offs

- **Size of the job:** this is the largest feature so far, several
  sessions. Each stop leaves something usable.
- **Accessibility:** a visual canvas can't be fully screen-reader friendly.
  The Layers panel and properties forms give keyboard access to every
  element. Flagged rather than claimed.
- **Low-memory devices:** A4 export at 300 dpi is about 9 megapixels. Older
  phones may struggle, so A4 export offers "standard" (150 dpi) if the full
  version fails.
- **Stock photos need CORS** to export. Pexels supports it; uploads are
  same-origin through signed URLs (bucket CORS configured).
- **Storage:** about 300 KB per uploaded photo and about 40 KB per
  thumbnail. 1 GB holds roughly 3,000 photos across all churches; revisit
  with the Supabase plan.
- **Font licensing:** only SIL OFL fonts; licence files ship with them.
- **Not in this round:** PDF export, landscape/projector layouts, team
  real-time co-editing, AI image generation, brand kits (saved church
  colours/logos). The AI tagline helper carries over.
