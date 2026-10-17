# Plan: Poster Studio v2: landscape, style variations, animated video

Status: **approved 2026-10-17**, in progress. Builds on
[`poster-editor.md`](poster-editor.md) and ADR 0003. Choices made with the
product owner: all three features; animation = simple video export; styles =
Minimal, Midnight, Neon, Vintage, Pastel.

## 1. Landscape 16:9 (1920 × 1080)

For projector and TV screens, YouTube thumbnails, Facebook covers and event
images.

- **New size** `landscape` (1920 × 1080) in the size picker and gallery.
- **Every template gets a landscape layout automatically.** The template's
  content is laid out in a centred column at the poster's height. Anything
  designed edge to edge (backgrounds, bands, full-photo slots) stretches to
  the full width, so nothing looks like a square pasted onto a wide canvas.
  This needs one change in the template toolkit (`kit.ts`), and no template
  is rewritten.
- **Hand-tuned split layouts** (text on one side, photo or artwork on the
  other) for the 10 templates most likely to go on a screen: Sunday Service,
  Worship Night, Guest Speaker, Conference, Sermon Series, Watch Online,
  Verse of the Week, General Announcement, Easter and Christmas.
- The existing template tests (valid design, nothing off the poster, readable
  contrast) automatically cover the new size.

## 2. Style variations

Five styles on top of each template's original look: **Minimal** (white,
near-black, one accent), **Midnight** (navy, white, gold, serif titles),
**Neon** (black, pink and cyan glow, bold capitals), **Vintage** (cream,
brown, classic serif) and **Pastel** (lavender, plum, gentle script).

- A **style is a re-theme, not a separate design.** It swaps the background,
  text colours and fonts by role (titles, labels, body), and shape and
  overlay colours. So 42 templates × 6 looks = 252 combinations, from one set
  of templates.
- **Automatic readability:** after re-colouring, each text is checked
  against what's behind it. If contrast falls short (for example text on a
  sticker shape), the style uses its light or dark text colour instead.
- **Where people use it:**
  - **Gallery:** a "Style" row of chips changes all the previews at once.
  - **Editor:** "Apply a style" re-themes the current poster. It's undoable,
    and photos and your text are kept.
- **Tests:** every template × style × size must pass the WCAG AA contrast
  check and the fit check (about 1,500 combinations, still fast).

## 3. Animated posters (video export)

For WhatsApp status, Instagram Reels and TikTok.

- **Each element can have an entrance:** None, Fade, Slide up, Slide in from
  the left or right, Zoom, Pop. Each has a start delay, so the title can
  arrive first, then the date, and so on.
  - **Quick option:** "Animate everything" applies a tasteful staggered
    sequence in one click.
  - Templates stay still unless animation is switched on.
- **Preview:** a Play button in the editor runs the animation on the canvas.
- **Download video:** about 6 seconds (the animation plus a hold at the
  end), recorded in the browser from the canvas with the built-in
  MediaRecorder:
  - MP4 where the browser supports it (Safari/iPhone, newer Chrome).
  - Otherwise WebM. WhatsApp accepts both from Android, and the download
    screen says which format you got.
  - Story/portrait sizes are the natural fit. All sizes work.
- **No new packages and no server cost.** Encoding happens on the device.
  Low-memory phones record at 720p if 1080p fails.
- **Saved format:** design version 2 adds an optional `animation` per
  element. Version 1 posters keep working (read as "no animation").
- **Accessibility:** the editor preview respects "reduce motion". The video
  file is the person's own choice to export.

## Build order and check-ins

1. **Landscape:** size, toolkit change, 10 hand-tuned layouts. *Batch report.*
2. **Styles:** theme engine with automatic readability, gallery and editor
   pickers, combination tests. **Stop:** visual review.
3. **Animation:** schema v2, entrance controls, preview, video export.
   **Stop:** test the video on your phone.

## Risks and trade-offs

- **Automatic re-theming** can't match a hand-designed look every time. The
  original style is always one tap away, and anything can be edited after.
- **Browser video support varies.** MP4 isn't available everywhere on
  Android Chrome, so some phones get WebM. Recording takes as long as the
  video plays (about 6 seconds) and needs the tab to stay open.
- **Animated GIF** isn't included (large files, poor quality). Video is
  better for every platform named.
- **The automatic landscape layout** is good but not bespoke for the
  remaining 32 templates. Hand-tune more later if people use them on screens.
