# Premium polish & button audit — plan

Status: **APPROVED** (2026-10-19).

## Decisions taken (from the 2026-10-19 audit questions)

- **Visual direction:** keep and refine the existing navy & brass system
  (ivory parchment, navy actions, champagne-gold accent, Playfair Display +
  Manrope, light/dark). No palette or font change. The job is consistency,
  not a rebrand.
- **Brand assets:** none supplied yet. One `BrandMark` component and one
  labelled photo placeholder, so swapping in the real logo/photos later is a
  one-file change. Flagged again before anything ships.
- **Games and poster editor:** light touch only — icons, type, buttons and
  dialogs match; their own layouts stay.
- **Testing:** no Playwright for now. Verification = typecheck, lint, unit +
  database tests, a production build, and a static audit of every form and
  button. Signed-in click-throughs stay on the manual checklist.

## What does not change

No database schema, no migrations, no RLS policies, no permission rules, no
server-action logic beyond fixing a broken or missing behaviour found by the
audit (each such fix is called out in the step report).

## Steps

1. **Foundations** *(batch)*
   - `components/ui/ConfirmDialog.tsx`: a styled, promise-based
     `useConfirm()` built on the same native `<dialog>` as
     `ConfirmSubmitButton`. Replaces the two `window.confirm` calls
     (`RouteModal` discard-changes, Bible `NoteDialog` discard-note).
   - Replace emoji used as icons (⚠ 🔒 📌 ✨ 🙏 📎 ✓ ○) in ~20 files with
     lucide icons; error lines move to the existing `Alert` component.
     Emoji that *are* content (the emoji Bible game, chat emoji picker) stay.
   - One heading scale: every page title through `PageHeader`; the 5 ad-hoc
     `h1` sizes go. Card radius standardised on `rounded-2xl`.
2. **Public, branded screens** *(STOP for your review)* — landing, login,
   register, forgot/reset password, 404.
   - Fixes the dark-mode contrast bug (white text on champagne buttons,
     ~1.5:1) on the landing page and 404 by using the shared `.btn-*` classes.
   - Landing gets a proper hero with a labelled "awaiting church photo —
     1600×900" placeholder; auth pages get a split layout (form + brand panel)
     on desktop, form-only on phones.
3. **Dashboard home and app shell** *(STOP for your review)* — sidebar,
   mobile nav, profile menu, the home summary cards; spacing and hierarchy
   only, same data.
4. **Remaining screens** *(batch)* — move the pages that skip `PageHeader`
   (prayer request, support ticket, Bible study, add game question) onto it;
   section-specific loading skeletons for the heavier lists (members, chat,
   Bible, posters) instead of the one generic dashboard skeleton.
5. **Button & workflow audit** *(batch, reported as a table)* — every form
   and action in `app/`: has a pending/disabled state, shows server errors,
   destructive actions confirm and name the record, edit forms pre-fill,
   Cancel/Back go to the right place, multi-step flows validate before Next,
   search/filter/pagination reset correctly, server action re-checks
   permission. Anything missing is fixed; anything that needs Supabase or an
   external service to verify is listed, not claimed.
6. **QA & handover** — typecheck, lint, tests, `next build` (with your dev
   server stopped — 8 GB RAM), `design:design-system` audit for stray values,
   README "Known gaps" updated, and a manual walkthrough checklist per role.

## Risks / trade-offs

- **No in-browser verification of signed-in screens** in this session; visual
  review of steps 2 and 3 needs you to look at them in `pnpm dev`.
- Touching ~60 files for consistency carries regression risk; mitigated by
  keeping each step a separate commit and not changing logic in steps 1–4.
- Placeholders for logo/photos must not survive to launch.
