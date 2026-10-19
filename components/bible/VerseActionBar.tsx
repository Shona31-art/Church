"use client";

import { Bookmark, BookmarkCheck, Copy, Eraser, NotebookPen, Share2, X } from "lucide-react";
import { HIGHLIGHT_COLORS, HIGHLIGHT_LABELS, type HighlightColor } from "@/lib/bible/annotations";
import { HIGHLIGHT_BG } from "./highlight-styles";

/**
 * Appears at the bottom of the screen while verses are selected: highlight
 * colours, bookmark, note, copy, share. `annotationsReady` is false when
 * highlights couldn't load (offline, error) — those buttons are then
 * disabled with the reason given, while copy and share still work.
 */
export function VerseActionBar({
  label,
  annotationsReady,
  unavailableReason,
  activeColor,
  anyHighlighted,
  allBookmarked,
  onHighlight,
  onBookmark,
  onNote,
  onCopy,
  onShare,
  onClear,
}: {
  label: string;
  annotationsReady: boolean;
  unavailableReason?: string;
  /** The colour shared by every selected verse, if they all have the same one. */
  activeColor: HighlightColor | null;
  anyHighlighted: boolean;
  allBookmarked: boolean;
  onHighlight: (color: HighlightColor | null) => void;
  onBookmark: () => void;
  onNote: () => void;
  onCopy: () => void;
  onShare: () => void;
  onClear: () => void;
}) {
  return (
    // Outer: position. Full-width bar on phones; on desktop a floating panel
    // centred over the content area (right of the 16rem sidebar).
    <div className="fixed inset-x-0 bottom-0 z-40 md:bottom-4 md:left-[calc(50%+8rem)] md:right-auto md:w-[min(40rem,calc(100%-18rem))] md:-translate-x-1/2">
      {/* Inner: look and entry animation (kept separate so its transform doesn't fight the centring). */}
      <div
        // "region", not "toolbar": a toolbar promises arrow-key navigation; these are plain Tab stops.
        role="region"
        aria-label={`Actions for ${label}`}
        className="flex flex-col gap-3 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-pop backdrop-blur motion-safe:animate-modal-in md:rounded-2xl md:border md:pb-3"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold" aria-live="polite">
            {label}
          </p>
          <button type="button" onClick={onClear} className="btn-ghost btn-sm h-8 w-8 p-0" aria-label="Clear selection">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <fieldset disabled={!annotationsReady} className="flex items-center gap-2 disabled:opacity-50" title={!annotationsReady ? unavailableReason : undefined}>
            <legend className="sr-only">Highlight colour</legend>
            {HIGHLIGHT_COLORS.map((color) => {
              const active = activeColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => onHighlight(active ? null : color)}
                  aria-pressed={active}
                  aria-label={active ? `Remove ${HIGHLIGHT_LABELS[color].toLowerCase()} highlight` : `Highlight ${HIGHLIGHT_LABELS[color].toLowerCase()}`}
                  className={`h-8 w-8 rounded-full border-2 ${HIGHLIGHT_BG[color]} ${active ? "border-ink ring-2 ring-surface ring-offset-0" : "border-line-strong"}`}
                />
              );
            })}
            {anyHighlighted && (
              <button type="button" onClick={() => onHighlight(null)} className="btn-ghost btn-sm h-8 w-8 p-0" aria-label="Remove highlight">
                <Eraser aria-hidden className="h-4 w-4" />
              </button>
            )}
          </fieldset>

          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={onBookmark} disabled={!annotationsReady} aria-pressed={allBookmarked} className="btn-ghost btn-sm" title={!annotationsReady ? unavailableReason : undefined}>
              {allBookmarked ? <BookmarkCheck aria-hidden className="h-4 w-4" /> : <Bookmark aria-hidden className="h-4 w-4" />}
              {allBookmarked ? "Bookmarked" : "Bookmark"}
            </button>
            <button type="button" onClick={onNote} disabled={!annotationsReady} className="btn-ghost btn-sm" title={!annotationsReady ? unavailableReason : undefined}>
              <NotebookPen aria-hidden className="h-4 w-4" />
              Note
            </button>
            <button type="button" onClick={onCopy} className="btn-ghost btn-sm">
              <Copy aria-hidden className="h-4 w-4" />
              Copy
            </button>
            <button type="button" onClick={onShare} className="btn-ghost btn-sm">
              <Share2 aria-hidden className="h-4 w-4" />
              Share
            </button>
          </div>
        </div>
        {!annotationsReady && unavailableReason && <p className="text-xs text-ink/60">{unavailableReason}</p>}
      </div>
    </div>
  );
}
