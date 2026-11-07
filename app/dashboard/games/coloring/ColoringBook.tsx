"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Download, Eraser, Paintbrush, Sparkles, Undo2, X } from "lucide-react";
import { COLORING_PALETTE, COLORING_PICTURES, coloringPicture, type ColoringPicture } from "@/lib/coloring/pictures";
import { saveBlob } from "@/lib/save-file";
import { showToast } from "@/components/ui/Toaster";
import { haptic } from "@/lib/haptics";
import type { ColoringPage } from "@/lib/coloring/pages";
import { PageCanvas, type PageCanvasHandle } from "./PageCanvas";

// A fill is a colour ("#e53935"), glitter in a colour ("glitter:#e53935") or "rainbow".
type Fills = Record<string, string>;
type Tool = "crayon" | "glitter" | "rainbow";
const STORE = "grace-coloring";
const WHITE = "#ffffff";

function loadAll(): Record<string, Fills> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}");
  } catch {
    return {};
  }
}
function saveAll(all: Record<string, Fills>) {
  try {
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch {
    /* full or private mode: colouring still works, it just isn't kept */
  }
}

const glitterId = (c: string) => `glitter-${c.replace("#", "")}`;

/** SVG <defs> for the glitter and rainbow fills a picture uses. */
function defsFor(fills: Fills): string {
  const glitters = [...new Set(Object.values(fills).filter((f) => f.startsWith("glitter:")).map((f) => f.slice(8)))];
  const sparkle = (x: number, y: number, r: number, o: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`;
  return [
    `<linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e53935"/><stop offset=".2" stop-color="#fb8c00"/><stop offset=".4" stop-color="#fdd835"/><stop offset=".6" stop-color="#43a047"/><stop offset=".8" stop-color="#1e88e5"/><stop offset="1" stop-color="#8e24aa"/></linearGradient>`,
    ...glitters.map(
      (c) =>
        `<pattern id="${glitterId(c)}" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="${c}"/>${sparkle(3, 4, 1.4, 0.9)}${sparkle(11, 2, 0.9, 0.7)}${sparkle(8, 9, 1.6, 0.8)}${sparkle(14, 13, 1.1, 0.9)}${sparkle(2, 13, 0.8, 0.6)}<circle cx="12" cy="7" r="1" fill="#000" opacity=".12"/></pattern>`
    ),
  ].join("");
}

function paint(fill: string | undefined): string {
  if (!fill) return WHITE;
  if (fill === "rainbow") return "url(#rainbow)";
  if (fill.startsWith("glitter:")) return `url(#${glitterId(fill.slice(8))})`;
  return fill;
}

/** The picture as an SVG string, for saving as a PNG. */
function pictureSvg(p: ColoringPicture, fills: Fills, size = 400): string {
  const shapes = p.regions.map((r) => `<path d="${r.d}" fill="${paint(fills[r.id])}" stroke="#222" stroke-width="4" stroke-linejoin="round"/>`).join("");
  const lines = (p.lines ?? []).map((d) => `<path d="${d}" fill="none" stroke="#222" stroke-width="4" stroke-linecap="round"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 400 400"><defs>${defsFor(fills)}</defs>${shapes}${lines}</svg>`;
}

function Drawing({ picture, fills, onTap }: { picture: ColoringPicture; fills: Fills; onTap?: (id: string) => void }) {
  return (
    <svg viewBox="0 0 400 400" className="block h-full w-full" role={onTap ? "group" : "img"} aria-label={picture.title}>
      <defs dangerouslySetInnerHTML={{ __html: defsFor(fills) }} />
      {picture.regions.map((r) => (
        <path
          key={r.id}
          d={r.d}
          fill={paint(fills[r.id])}
          stroke="#222"
          strokeWidth={4}
          strokeLinejoin="round"
          onClick={onTap ? () => onTap(r.id) : undefined}
          className={onTap ? "cursor-pointer" : undefined}
        />
      ))}
      {(picture.lines ?? []).map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#222" strokeWidth={4} strokeLinecap="round" pointerEvents="none" />
      ))}
    </svg>
  );
}

/** A crayon in the box; the chosen one slides out. */
function Crayon({ colour, chosen, onPick }: { colour: string; chosen: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      aria-label={`Colour ${colour}`}
      onClick={onPick}
      className={`shrink-0 transition-transform duration-150 ${chosen ? "-translate-y-3 lg:-translate-x-4 lg:translate-y-0" : ""}`}
    >
      {/* Standing up in the box on a phone; lying down, tip out, beside the picture on a wide screen. */}
      <svg viewBox="0 0 28 90" className="h-20 w-7 lg:hidden" aria-hidden>
        <path d="M 6 26 L 14 2 L 22 26 Z" fill={colour} stroke="rgb(0 0 0 / 0.25)" />
        <rect x="4" y="24" width="20" height="64" rx="3" fill={colour} stroke="rgb(0 0 0 / 0.25)" />
        <rect x="4" y="34" width="20" height="6" fill="rgb(0 0 0 / 0.18)" />
        <rect x="4" y="72" width="20" height="6" fill="rgb(0 0 0 / 0.18)" />
        <rect x="8" y="26" width="4" height="60" rx="2" fill="#fff" opacity=".35" />
      </svg>
      <svg viewBox="0 0 90 28" className="hidden h-7 w-24 lg:block" aria-hidden>
        <path d="M 26 6 L 2 14 L 26 22 Z" fill={colour} stroke="rgb(0 0 0 / 0.25)" />
        <rect x="24" y="4" width="64" height="20" rx="3" fill={colour} stroke="rgb(0 0 0 / 0.25)" />
        <rect x="34" y="4" width="6" height="20" fill="rgb(0 0 0 / 0.18)" />
        <rect x="72" y="4" width="6" height="20" fill="rgb(0 0 0 / 0.18)" />
        <rect x="26" y="8" width="60" height="4" rx="2" fill="#fff" opacity=".35" />
      </svg>
    </button>
  );
}

/** A big glossy round-cornered button, like a toy. */
function ToyButton({ label, onClick, tone = "blue", disabled, children, active }: { label: string; onClick: () => void; tone?: "blue" | "orange" | "purple" | "green"; disabled?: boolean; children: React.ReactNode; active?: boolean }) {
  const tones = {
    blue: "from-sky-300 to-sky-500 border-sky-600",
    orange: "from-orange-300 to-orange-500 border-orange-600",
    purple: "from-fuchsia-300 to-purple-500 border-purple-600",
    green: "from-lime-300 to-green-500 border-green-600",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-b-4 bg-gradient-to-b text-white shadow-lg transition active:translate-y-0.5 active:border-b-2 disabled:opacity-40 ${tones[tone]} ${active ? "ring-4 ring-white/90" : ""}`}
    >
      {children}
    </button>
  );
}

/** The playroom: a plank wall with grass along the bottom. */
function Playroom({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-3 pb-10 sm:p-5 sm:pb-12"
      style={{
        background: "repeating-linear-gradient(0deg, #6d3f26 0 54px, #5a321d 54px 57px), #6d3f26",
      }}
    >
      {children}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-8 sm:h-10" style={{ background: "radial-gradient(circle at 10px 6px, #fff 2px, transparent 3px) 0 0 / 46px 22px, linear-gradient(#5ee05a, #36b83a)" }} />
    </div>
  );
}

/**
 * Bible colouring: choose a picture, pick a crayon (or glitter, or rainbow),
 * tap a part of the picture to fill it. Undo, rub out, next picture, and save
 * the finished picture. Colouring is kept on the device.
 */
export function ColoringBook({ pages = [] }: { pages?: ColoringPage[] }) {
  const [all, setAll] = useState<Record<string, Fills>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [colour, setColour] = useState<string>(COLORING_PALETTE[0]);
  const [tool, setTool] = useState<Tool>("crayon");
  const [rubber, setRubber] = useState(false);
  const [history, setHistory] = useState<Fills[]>([]);
  // Uploaded pages are coloured on a canvas (PageCanvas), which keeps its own undo.
  const pageRef = useRef<PageCanvasHandle>(null);
  const [pageCanUndo, setPageCanUndo] = useState(false);
  const page = open?.startsWith("page:") ? pages.find((p) => `page:${p.id}` === open) : undefined;
  const order = [...COLORING_PICTURES.map((p) => p.key), ...pages.map((p) => `page:${p.id}`)];

  useEffect(() => setAll(loadAll()), []);
  const picture = open ? coloringPicture(open) : undefined;
  const fills = useMemo(() => (open ? all[open] ?? {} : {}), [all, open]);
  const crayons = COLORING_PALETTE.filter((c) => c !== WHITE);

  function update(next: Fills) {
    if (!open) return;
    setHistory((h) => [...h.slice(-49), fills]);
    const merged = { ...all, [open]: next };
    setAll(merged);
    saveAll(merged);
  }

  function tap(id: string) {
    const fill = rubber ? undefined : tool === "rainbow" ? "rainbow" : tool === "glitter" ? `glitter:${colour}` : colour;
    if (fills[id] === fill) return;
    haptic("tap");
    const next = { ...fills };
    if (fill) next[id] = fill;
    else delete next[id];
    update(next);
  }

  function undo() {
    if (page) return pageRef.current?.undo();
    const prev = history[history.length - 1];
    if (!open || !prev) return;
    setHistory((h) => h.slice(0, -1));
    const merged = { ...all, [open]: prev };
    setAll(merged);
    saveAll(merged);
  }

  function go(key: string | null) {
    setOpen(key);
    setHistory([]);
  }

  async function download() {
    if (page) {
      const blob = await pageRef.current?.toBlob();
      const ok = blob ? await saveBlob(blob, `${page.title}.png`) : false;
      return showToast(ok ? "Your picture is saved." : "Couldn't save the picture — try again.", ok ? "success" : "error");
    }
    if (!picture) return;
    try {
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pictureSvg(picture, fills, 1200))}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1200;
      canvas.getContext("2d")!.drawImage(img, 0, 0, 1200, 1200);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("no image");
      const ok = await saveBlob(blob, `${picture.title}.png`);
      showToast(ok ? "Your picture is saved." : "Update the app to save pictures.", ok ? "success" : "error");
    } catch {
      showToast("Couldn't save the picture — try again.", "error");
    }
  }

  if (!picture && !page) {
    return (
      <Playroom>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {COLORING_PICTURES.map((p) => {
            const started = Object.keys(all[p.key] ?? {}).length > 0;
            return (
              <button key={p.key} type="button" onClick={() => go(p.key)} className="group text-left transition-transform hover:-translate-y-0.5">
                <span className="block rounded-lg border-[6px] border-[#c8692a] bg-white p-1.5 shadow-[0_6px_0_#8a4318,0_10px_18px_rgb(0_0_0/0.35)]">
                  <span className="block aspect-square">
                    <Drawing picture={p} fills={all[p.key] ?? {}} />
                  </span>
                </span>
                <span className="mt-2 block text-center text-sm font-bold leading-snug text-white drop-shadow">
                  {p.title}
                  {started && <span className="block text-xs font-medium text-amber-200">Keep colouring</span>}
                </span>
              </button>
            );
          })}
          {pages.map((p) => (
            <button key={p.id} type="button" onClick={() => go(`page:${p.id}`)} className="group text-left transition-transform hover:-translate-y-0.5">
              <span className="block rounded-lg border-[6px] border-[#c8692a] bg-white p-1.5 shadow-[0_6px_0_#8a4318,0_10px_18px_rgb(0_0_0/0.35)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" loading="lazy" className="block aspect-square w-full object-contain" />
              </span>
              <span className="mt-2 block text-center text-sm font-bold leading-snug text-white drop-shadow">{p.title}</span>
            </button>
          ))}
        </div>
      </Playroom>
    );
  }

  const nextKey = order[(order.indexOf(open!) + 1) % order.length];
  const nextTitle = nextKey.startsWith("page:") ? pages.find((p) => `page:${p.id}` === nextKey)?.title : coloringPicture(nextKey)?.title;
  const canvasFill = { kind: rubber ? ("rubber" as const) : tool === "rainbow" ? ("rainbow" as const) : tool === "glitter" ? ("glitter" as const) : ("colour" as const), colour };

  return (
    <Playroom>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* The picture in its wooden frame */}
        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-[36rem] overflow-hidden rounded-xl border-[10px] border-[#c8692a] bg-white shadow-[0_8px_0_#8a4318,0_14px_24px_rgb(0_0_0/0.4)]">
            {page ? <PageCanvas ref={pageRef} id={page.id} url={page.url} title={page.title} fill={canvasFill} onHistory={setPageCanUndo} /> : <Drawing picture={picture!} fills={fills} onTap={tap} />}
          </div>
          <p className="mt-3 text-center text-sm font-bold text-white drop-shadow">
            {page ? page.title : picture!.title}
            {picture && <> · <span className="font-medium text-amber-200">{picture.reference}</span></>}
          </p>
        </div>

        {/* Tools */}
        <div className="flex flex-col gap-3 lg:w-48">
          <div className="flex items-center justify-center gap-2 lg:justify-between">
            <ToyButton label="Rubber" tone="blue" onClick={() => setRubber((r) => !r)} active={rubber}>
              <Eraser aria-hidden className="h-7 w-7" />
            </ToyButton>
            <ToyButton label="Back to all pictures" tone="orange" onClick={() => go(null)}>
              <X aria-hidden className="h-8 w-8" strokeWidth={3} />
            </ToyButton>
          </div>

          <div className="flex gap-3 rounded-2xl bg-white/90 p-2 shadow-inner lg:flex-col">
            {/* Crayon box */}
            <div className="flex flex-1 gap-1.5 overflow-x-auto pt-3 lg:max-h-[22rem] lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:pt-0" role="radiogroup" aria-label="Crayons">
              {crayons.map((c) => (
                <Crayon
                  key={c}
                  colour={c}
                  chosen={!rubber && tool !== "rainbow" && colour === c}
                  onPick={() => {
                    setColour(c);
                    setRubber(false);
                    if (tool === "rainbow") setTool("crayon");
                  }}
                />
              ))}
            </div>
            {/* Fill styles */}
            <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:justify-center">
              <ToyButton label="Crayon" tone="green" onClick={() => { setTool("crayon"); setRubber(false); }} active={!rubber && tool === "crayon"}>
                <Paintbrush aria-hidden className="h-6 w-6" />
              </ToyButton>
              <ToyButton label="Glitter" tone="orange" onClick={() => { setTool("glitter"); setRubber(false); }} active={!rubber && tool === "glitter"}>
                <Sparkles aria-hidden className="h-6 w-6" />
              </ToyButton>
              <ToyButton label="Rainbow" tone="purple" onClick={() => { setTool("rainbow"); setRubber(false); }} active={!rubber && tool === "rainbow"}>
                <span aria-hidden className="text-2xl leading-none">🌈</span>
              </ToyButton>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 lg:justify-between">
            <ToyButton label="Undo" tone="blue" onClick={undo} disabled={page ? !pageCanUndo : !history.length}>
              <Undo2 aria-hidden className="h-7 w-7" strokeWidth={2.5} />
            </ToyButton>
            <ToyButton label="Save picture" tone="green" onClick={download}>
              <Download aria-hidden className="h-7 w-7" strokeWidth={2.5} />
            </ToyButton>
            <ToyButton label={`Next picture: ${nextTitle ?? ""}`} tone="orange" onClick={() => go(nextKey)}>
              <ArrowRight aria-hidden className="h-8 w-8" strokeWidth={3} />
            </ToyButton>
          </div>
        </div>
      </div>
    </Playroom>
  );
}
