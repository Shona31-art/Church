"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { Plus, Search } from "lucide-react";
import { POSTER_SIZES, POSTER_SIZE_KEYS, type PosterSize } from "@/lib/posters/design";
import { OCCASIONS, POSTER_TEMPLATES, templateDesign, type Occasion } from "@/lib/posters/templates";
import { fontsInDesign, loadFonts } from "@/lib/posters/fonts";
import { POSTER_STYLES, applyStyle, type PosterStyleKey } from "@/lib/posters/styles";

const EditorCanvas = dynamic(() => import("./editor/EditorCanvas").then((m) => m.EditorCanvas), { ssr: false });

/**
 * Choose a size and a template (or start blank). Previews are drawn live with
 * the same renderer as the editor, so what you pick is exactly what opens —
 * each one only when it scrolls into view, to keep phones responsive.
 */
export function TemplateGallery({ initialOccasion = "All" }: { initialOccasion?: Occasion | "All" } = {}) {
  const [size, setSize] = useState<PosterSize>("square");
  const [occasion, setOccasion] = useState<Occasion | "All">(initialOccasion);
  const [fontVersion, setFontVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [style, setStyle] = useState<PosterStyleKey | "original">("original");

  // Load every font the templates use once, then redraw the previews.
  useEffect(() => {
    const names = [
      ...POSTER_TEMPLATES.flatMap((t) => fontsInDesign(templateDesign(t.key, "square").elements)),
      ...POSTER_STYLES.flatMap((s) => [s.titleFont, s.bodyFont]),
    ];
    loadFonts(names).then(() => setFontVersion((n) => n + 1));
  }, []);

  const words = query.trim().toLowerCase().split(/s+/).filter(Boolean);
  const shown = POSTER_TEMPLATES.filter(
    (t) =>
      (occasion === "All" || t.occasion === occasion) &&
      words.every((w) => `${t.name} ${t.description} ${t.occasion}`.toLowerCase().includes(w)),
  );
  const { width, height } = POSTER_SIZES[size];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <fieldset>
          <legend className="label">Size</legend>
          <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface-raised p-1">
            {POSTER_SIZE_KEYS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={size === s}
                onClick={() => setSize(s)}
                className={`rounded-lg px-3 py-1.5 text-left text-sm ${size === s ? "bg-surface font-semibold text-ink shadow-xs" : "text-ink/60 hover:text-ink"}`}
              >
                {POSTER_SIZES[s].label}
                <span className="block text-xs font-normal text-ink/60">{POSTER_SIZES[s].hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="sr-only">Occasion</legend>
          <div className="flex flex-wrap gap-1.5">
            {(["All", ...OCCASIONS] as const).map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={occasion === o}
                onClick={() => setOccasion(o)}
                className={`rounded-full border px-3 py-1 text-sm [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:px-4 ${occasion === o ? "border-ember bg-ember text-on-ember" : "border-line bg-surface text-ink/70 hover:border-line-strong"}`}
              >
                {o}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset>
        <legend className="label">Style</legend>
        <div className="flex flex-wrap gap-1.5">
          {([{ key: "original", name: "Original", description: "As designed" }, ...POSTER_STYLES] as const).map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={style === s.key}
              onClick={() => setStyle(s.key)}
              title={s.description}
              className={`rounded-full border px-3 py-1 text-sm [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:px-4 ${style === s.key ? "border-ember bg-ember text-on-ember" : "border-line bg-surface text-ink/70 hover:border-line-strong"}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="relative max-w-md">
        <label htmlFor="template-search" className="sr-only">
          Search templates
        </label>
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/60" />
        <input
          id="template-search"
          type="search"
          className="input pl-9"
          placeholder="Search templates, e.g. Easter, youth, concert"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <p className="text-sm text-ink/60" role="status">
        {shown.length} {shown.length === 1 ? "template" : "templates"}
        {occasion !== "All" || words.length ? " match" : ""}
      </p>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <li>
          <Link href={`/dashboard/posters/editor/new?size=${size}`} className="card-interactive flex h-full flex-col rounded-xl p-2">
            <span
              className="flex items-center justify-center rounded-lg border-2 border-dashed border-line-strong bg-surface text-ink/60"
              style={{ aspectRatio: `${width} / ${height}` }}
            >
              <Plus aria-hidden className="h-8 w-8" />
            </span>
            <span className="mt-2 px-1 text-sm font-semibold">Blank poster</span>
            <span className="px-1 text-xs text-ink/60">Start from scratch</span>
          </Link>
        </li>
        {shown.map((t) => (
          <li key={t.key}>
            <Link href={`/dashboard/posters/editor/new?size=${size}&template=${t.key}${style !== "original" ? `&style=${style}` : ""}`} className="card-interactive flex h-full flex-col rounded-xl p-2">
              <TemplatePreview templateKey={t.key} size={size} style={style} fontVersion={fontVersion} />
              <span className="mt-2 px-1 text-sm font-semibold">{t.name}</span>
              <span className="px-1 text-xs text-ink/60">{t.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TemplatePreview({ templateKey, size, style, fontVersion }: { templateKey: string; size: PosterSize; style: PosterStyleKey | "original"; fontVersion: number }) {
  const box = useRef<HTMLSpanElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [visible, setVisible] = useState(false);
  const [boxWidth, setBoxWidth] = useState(0);
  const design = useMemo(() => {
    const base = templateDesign(templateKey, size);
    return style === "original" ? base : applyStyle(base, style);
  }, [templateKey, size, style]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { rootMargin: "200px" });
    io.observe(el);
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    ro.observe(el);
    setBoxWidth(el.clientWidth);
    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  return (
    <span
      ref={box}
      aria-hidden
      className="pointer-events-none block overflow-hidden rounded-lg bg-surface-raised"
      style={{ aspectRatio: `${design.width} / ${design.height}` }}
    >
      {visible && boxWidth > 0 && (
        <EditorCanvas
          design={design}
          scale={boxWidth / design.width}
          selectedId={null}
          editingId={null}
          readOnly
          fontVersion={fontVersion}
          stageRef={stageRef}
          onSelect={() => undefined}
          onChange={() => undefined}
          onStartEditText={() => undefined}
        />
      )}
    </span>
  );
}
