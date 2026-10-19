"use client";

import { Bookmark, NotebookPen } from "lucide-react";
import type { HighlightColor } from "@/lib/bible/annotations";
import type { ReaderSettings } from "@/lib/bible/reader-prefs";
import { HIGHLIGHT_BG } from "./highlight-styles";
import { VerseText } from "./VerseText";

const SIZE: Record<ReaderSettings["textSize"], string> = {
  small: "text-[15px]",
  medium: "text-[17px]",
  large: "text-[19px]",
  xlarge: "text-[22px]",
};
const SPACING: Record<ReaderSettings["lineSpacing"], string> = {
  compact: "leading-[1.55]",
  normal: "leading-[1.8]",
  relaxed: "leading-[2.05]",
};
const FONT: Record<ReaderSettings["font"], string> = { sans: "font-sans", serif: "font-serif" };

export interface CompareText {
  abbreviation: string;
  /** null while loading */
  verses: string[] | null;
  failed: boolean;
}

/**
 * A chapter's verses, laid out per the reader settings: verse by verse (with
 * an optional second version under each) or as continuous paragraph text.
 * Each verse is a toggle button for selection; highlights, bookmarks and
 * notes are shown on it, with screen-reader text so colour is never the only cue.
 */
export function ChapterText({
  verses,
  versionAbbreviation,
  settings,
  compare,
  highlights,
  bookmarks,
  notedVerses,
  selected,
  focused,
  onToggle,
}: {
  verses: string[];
  versionAbbreviation: string;
  settings: ReaderSettings;
  compare: CompareText | null;
  highlights: Record<number, HighlightColor>;
  bookmarks: number[];
  notedVerses: Set<number | null>;
  selected: number[];
  /** Verse range to mark, from a link or the "go to" box. */
  focused: [number, number] | null;
  onToggle: (verse: number) => void;
}) {
  const paragraph = settings.layout === "paragraph" && !compare;
  const textClass = `${SIZE[settings.textSize]} ${SPACING[settings.lineSpacing]} ${FONT[settings.font]} text-ink/90`;

  const verseProps = (n: number) => {
    const color = highlights[n];
    const isFocused = focused !== null && n >= focused[0] && n <= focused[1];
    const isSelected = selected.includes(n);
    return {
      id: `v${n}`,
      role: "button",
      tabIndex: 0,
      "aria-pressed": isSelected,
      onClick: () => onToggle(n),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle(n);
        }
      },
      className: `cursor-pointer scroll-mt-40 rounded-md ${color ? HIGHLIGHT_BG[color] : isFocused ? "bg-gold/15" : "hover:bg-ink/[0.04]"} ${
        isSelected ? "underline decoration-ember/70 decoration-dotted decoration-2 underline-offset-[5px]" : ""
      }`,
    } as const;
  };

  const inner = (n: number, text: string) => (
    <>
      <sup className="tabular mr-1 text-[0.68em] font-semibold text-gold">{n}</sup>
      {bookmarks.includes(n) && (
        <>
          <Bookmark aria-hidden className="mr-1 inline h-[0.8em] w-[0.8em] -translate-y-px fill-current text-gold" />
          <span className="sr-only">Bookmarked. </span>
        </>
      )}
      {highlights[n] && <span className="sr-only">Highlighted {highlights[n]}. </span>}
      {text ? (
        <VerseText text={text} />
      ) : (
        <span className="text-[0.88em] italic text-ink/60">
          This verse isn&apos;t in the {versionAbbreviation} text. Older versions such as the KJV include it.
        </span>
      )}
      {notedVerses.has(n) && (
        <>
          <NotebookPen aria-hidden className="ml-1.5 inline h-[0.8em] w-[0.8em] -translate-y-px text-ink/60" />
          <span className="sr-only"> Has a note.</span>
        </>
      )}
    </>
  );

  if (paragraph) {
    // Continuous text: inline spans, so a highlight wraps across lines cleanly.
    return (
      <p className={textClass}>
        {verses.map((text, i) => {
          const props = verseProps(i + 1);
          return (
            <span key={i} {...props} className={`${props.className} box-decoration-clone px-0.5`}>
              {inner(i + 1, text)}{" "}
            </span>
          );
        })}
      </p>
    );
  }

  return (
    <div className={`space-y-1.5 ${textClass}`}>
      {verses.map((text, i) => {
        const n = i + 1;
        const props = verseProps(n);
        if (!compare) {
          return (
            <p key={i} {...props} className={`${props.className} -mx-2 px-2 py-0.5`}>
              {inner(n, text)}
            </p>
          );
        }
        const other = compare.verses?.[i];
        return (
          <div key={i} {...props} className={`${props.className} -mx-2 px-2 py-1.5 md:grid md:grid-cols-2 md:gap-6`}>
            <p>{inner(n, text)}</p>
            <p className="mt-1 text-[0.92em] text-ink/65 md:mt-0">
              <span className="eyebrow mr-1.5 align-middle">{compare.abbreviation}</span>
              {compare.verses === null ? (
                compare.failed ? (
                  <span className="italic">Couldn&apos;t load.</span>
                ) : (
                  <span className="italic">Loading…</span>
                )
              ) : other ? (
                <VerseText text={other} />
              ) : (
                <span className="italic">Not in this version.</span>
              )}
            </p>
          </div>
        );
      })}
      {/* A version with more verses in this chapter than the main one (rare versification differences). */}
      {compare?.verses && compare.verses.length > verses.length && (
        <p className="text-[0.92em] text-ink/65">
          <span className="eyebrow mr-1.5">{compare.abbreviation}</span>
          {compare.verses.slice(verses.length).map((t, j) => (
            <span key={j}>
              <sup className="tabular mr-1 text-[0.68em] font-semibold text-gold">{verses.length + j + 1}</sup>
              <VerseText text={t} />{" "}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
