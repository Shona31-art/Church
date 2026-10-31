"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type Konva from "konva";
import { ChevronLeft, Download, ImageIcon, Layers, Plus, Redo2, SlidersHorizontal, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { showToast } from "@/components/ui/Toaster";
import { requestThumbnailUpload, savePosterDesign, setPosterThumbnail } from "@/app/dashboard/posters/editor-actions";
import { createClient } from "@/lib/supabase/client";
import { POSTER_SIZES, POSTER_SIZE_KEYS, PosterDesignSchema, type PosterDesign, type PosterElement, type PosterSize, type TextElement } from "@/lib/posters/design";
import { addElement, createIcon, createShape, createSpeaker, createText, duplicateElement, findElement, newId, removeElement, reorderElement, updateChild, updateElement } from "@/lib/posters/elements";
import { createHistory, recordCoalesced, redo, undo } from "@/lib/posters/history";
import { resizeDesign } from "@/lib/posters/layout";
import { applyStyle, posterStyle } from "@/lib/posters/styles";
import { DEFAULT_FONT, fontsInDesign, loadFonts } from "@/lib/posters/fonts";
import { EditorCanvas } from "./EditorCanvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { InsertPanel, LayersPanel } from "./SidePanels";
import { PhotosPanel, type PhotoChoice } from "./PhotosPanel";
import { TextEditOverlay } from "./TextEditOverlay";
import { playOnStage } from "./animate-stage";
import { animateAll, clearAnimations, pickVideoType, VIDEO_FPS, videoSize } from "@/lib/posters/animation";
import { jpegToPdf, pdfPageSize } from "@/lib/posters/pdf";
import { shareContent } from "@/lib/share";

// Unsaved work is kept on this device so a closed tab, crash or expired
// session never loses a poster. Keyed by poster (or "new"); a draft is only
// offered back if it was based on the version that's being opened.
interface Draft {
  design: unknown;
  title: string;
  baseUpdatedAt: string | null;
  savedAt: number;
}
const draftKey = (posterId: string | null) => `poster-draft:${posterId ?? "new"}`;
function readDraft(posterId: string | null): Draft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey(posterId)) ?? "null") as Draft | null;
    return draft && typeof draft.title === "string" && typeof draft.savedAt === "number" ? draft : null;
  } catch {
    return null;
  }
}
function writeDraft(posterId: string | null, draft: Draft) {
  try {
    localStorage.setItem(draftKey(posterId), JSON.stringify(draft));
  } catch {
    // storage full or blocked: recovery is a safety net, not required
  }
}
function clearDraft(posterId: string | null) {
  try {
    localStorage.removeItem(draftKey(posterId));
  } catch {
    // ignore
  }
}

type Panel = "add" | "photos" | "layers" | "edit";
type RailTab = "add" | "photos" | "layers";
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/**
 * The poster editor. Holds the design (with undo history), the selection,
 * zoom, saving and downloading. Desktop: tools left, canvas centre,
 * properties right. Phones: canvas on top, the same tools in tabs below.
 *
 * Keyboard: Delete removes, ⌘/Ctrl+Z undo, ⌘/Ctrl+Shift+Z or Ctrl+Y redo,
 * ⌘/Ctrl+D duplicate, ⌘/Ctrl+S save, arrows nudge (Shift = 10px), Esc deselect.
 */
export function Editor({
  initialDesign,
  initialTitle,
  posterId: initialPosterId,
  initialUpdatedAt,
  imageUrls,
}: {
  initialDesign: PosterDesign;
  initialTitle: string;
  posterId: string | null;
  initialUpdatedAt: string | null;
  imageUrls?: Record<string, string>;
}) {
  const [history, setHistory] = useState(() => createHistory(initialDesign));
  const design = history.present;
  const [title, setTitle] = useState(initialTitle);
  const [posterId, setPosterId] = useState(initialPosterId);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(0.4);
  const [panel, setPanel] = useState<Panel>("add");
  const [railTab, setRailTab] = useState<RailTab>("add");
  // Signed links for the church's uploaded photos (from the server, then the Photos panel).
  const [urls, setUrls] = useState<Record<string, string>>(imageUrls ?? {});
  const addUrls = useCallback((more: Record<string, string>) => setUrls((prev) => ({ ...prev, ...more })), []);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [fontVersion, setFontVersion] = useState(0);
  // An animation playing on the canvas: a preview, or a video being recorded.
  const [animating, setAnimating] = useState<"preview" | "video" | null>(null);
  const saved = useRef({ design: initialDesign, title: initialTitle });
  const [recoverable, setRecoverable] = useState<{ design: PosterDesign; title: string; savedAt: number } | null>(null);
  const lastChange = useRef({ key: "", at: 0 });
  // The latest preview maker (it reads the current zoom), for use inside the memoised save.
  const makeThumbnail = useRef<(id: string) => void>(() => undefined);
  const stageRef = useRef<Konva.Stage>(null);
  const canvasArea = useRef<HTMLDivElement>(null);

  const scale = fit * zoom;
  const selected = findElement(design, selectedId);
  const dirty = design !== saved.current.design || title !== saved.current.title;

  /** Apply a change. Same `key` within a second merges into one undo step (typing, sliders). */
  const change = useCallback((fn: (d: PosterDesign) => PosterDesign, key = "") => {
    const now = Date.now();
    const last = lastChange.current;
    lastChange.current = { key, at: now };
    setHistory((h) => recordCoalesced(h, fn(h.present), key, last, now));
  }, []);

  // Fit the poster to the space available, and keep it fitted when the window changes.
  useLayoutEffect(() => {
    const el = canvasArea.current;
    if (!el) return;
    const measure = () => {
      const pad = 32;
      setFit(Math.max(0.05, Math.min((el.clientWidth - pad) / design.width, (el.clientHeight - pad) / design.height)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [design.width, design.height]);

  // Load the fonts this design uses, then redraw so text is measured with them.
  const fontKey = fontsInDesign(design.elements).sort().join("|");
  useEffect(() => {
    let cancelled = false;
    loadFonts(fontKey ? fontKey.split("|") : []).then(() => !cancelled && setFontVersion((n) => n + 1));
    return () => {
      cancelled = true;
    };
  }, [fontKey]);

  // Offer back unsaved work from a previous visit (only if it's based on this version).
  useEffect(() => {
    const draft = readDraft(initialPosterId);
    if (!draft || draft.baseUpdatedAt !== initialUpdatedAt) return;
    const design = PosterDesignSchema.safeParse(draft.design);
    if (!design.success) return clearDraft(initialPosterId);
    if (JSON.stringify(design.data) === JSON.stringify(initialDesign) && draft.title === initialTitle) return clearDraft(initialPosterId);
    setRecoverable({ design: design.data, title: draft.title, savedAt: draft.savedAt });
    // Only when the editor opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dirty || recoverable) return;
    const timer = setTimeout(() => writeDraft(posterId, { design, title, baseUpdatedAt: updatedAt, savedAt: Date.now() }), 800);
    return () => clearTimeout(timer);
  }, [dirty, design, title, posterId, updatedAt, recoverable]);

  // Don't lose work by closing the tab.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setPanel("edit");
  }, []);

  function updateSelected(changes: Partial<PosterElement>, key: string) {
    if (selectedId) change((d) => updateElement(d, selectedId, changes), key);
  }

  function deleteSelected() {
    if (!selectedId) return;
    change((d) => removeElement(d, selectedId));
    setSelectedId(null);
  }

  function duplicateSelected() {
    if (!selectedId) return;
    const result = duplicateElement(design, selectedId);
    change(() => result.design);
    setSelectedId(result.newId);
  }

  function addAndSelect(element: PosterElement) {
    change((d) => addElement(d, element));
    select(element.id);
  }

  /** A chosen photo fills the selected photo or speaker photo; otherwise it's added as a new photo. */
  function usePhoto(choice: PhotoChoice) {
    const target = selected;
    if (target?.type === "image" && !target.locked) {
      change((d) => updateElement(d, target.id, { src: choice.src } as Partial<PosterElement>));
      return;
    }
    if (target?.type === "group") {
      const slot = target.children.find((c) => c.type === "image");
      if (slot) {
        change((d) => updateChild(d, target.id, slot.id, { src: choice.src } as Partial<PosterElement>));
        return;
      }
    }
    addAndSelect(photoElement(design, choice));
  }

  function setBackgroundPhoto(choice: PhotoChoice) {
    change((d) => ({ ...d, background: { ...d.background, image: { src: choice.src, overlay: d.background.image?.overlay ?? { color: "#000000", opacity: 0.35 } } } }));
    setSelectedId(null);
    showToast("Background photo set. Adjust the darkness under Background.", "info");
  }

  const photoTarget =
    selected?.type === "image"
      ? "Clicking a photo replaces the selected photo."
      : selected?.type === "group" && selected.children.some((c) => c.type === "image")
        ? "Clicking a photo sets the selected speaker's photo."
        : "Clicking a photo adds it to the poster. Select a photo slot first to fill it.";

  function changeSize(size: PosterSize) {
    change((d) => resizeDesign(d, size));
    setZoom(1);
  }

  const save = useCallback(
    async (asCopy = false) => {
      if (saving) return;
      setSaving(true);
      const snapshot = design;
      const res = await savePosterDesign({
        id: asCopy ? undefined : posterId ?? undefined,
        title: asCopy ? `${title} (copy)`.slice(0, 120) : title,
        expectedUpdatedAt: asCopy ? undefined : updatedAt ?? undefined,
        design: snapshot,
      }).catch(() => null);
      setSaving(false);
      if (!res) return showToast("Couldn't save. Check your connection and try again; your work is still here.", "error");
      if (!res.ok) {
        setConflict(Boolean(res.conflict));
        return showToast(res.error, "error");
      }
      const newTitle = asCopy ? `${title} (copy)`.slice(0, 120) : title;
      saved.current = { design: snapshot, title: newTitle };
      setTitle(newTitle);
      setPosterId(res.id);
      setUpdatedAt(res.updatedAt);
      setConflict(false);
      clearDraft(posterId);
      clearDraft(res.id);
      makeThumbnail.current(res.id);
      // Give a new poster its own address without reloading the editor.
      if (res.id !== posterId) window.history.replaceState(null, "", `/dashboard/posters/editor/${res.id}`);
      showToast(asCopy ? "Saved as a copy." : "Poster saved.");
    },
    [saving, design, posterId, title, updatedAt],
  );

  /**
   * Small JPEG preview for the posters list, made after each save. Best effort:
   * a failure only means the list shows the poster's name instead.
   */
  async function updateThumbnail(id: string) {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      const handles = stage.findOne(".transformer");
      handles?.hide();
      const dataUrl = stage.toDataURL({ pixelRatio: 480 / (design.width * scale), mimeType: "image/jpeg", quality: 0.8 });
      handles?.show();
      const blob = await (await fetch(dataUrl)).blob();
      const ticket = await requestThumbnailUpload(id);
      if (!ticket.ok) return;
      const { error } = await createClient().storage.from("poster-assets").uploadToSignedUrl(ticket.path, ticket.token, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      await setPosterThumbnail(id, ticket.path);
    } catch (error) {
      console.error("[posters] preview image failed:", error);
    }
  }

  makeThumbnail.current = updateThumbnail;

  /** File name from the poster's title, e.g. "Easter Sunday" → "easter-sunday". */
  function fileName(): string {
    return (title.trim() || "poster").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "poster";
  }

  /** Clears the selection and waits two frames so the handles are gone from the canvas. */
  async function readyStage(): Promise<Konva.Stage | null> {
    setSelectedId(null);
    setEditingId(null);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return stageRef.current;
  }

  function saveFile(url: string, name: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  }

  /** Full-size image of the poster; very large posters fall back to half size on low-memory devices. */
  function renderImage(stage: Konva.Stage, type: "png" | "jpeg"): { url: string; ratio: number } | null {
    const render = (ratio: number) => stage.toDataURL({ pixelRatio: ratio, mimeType: `image/${type}`, quality: 0.92 });
    try {
      return { url: render(1 / scale), ratio: 1 };
    } catch (error) {
      try {
        // Very large posters (A4 at 300 dpi) can exceed a phone's memory: fall back to half resolution.
        const url = render(1 / scale / 2);
        showToast("Your device couldn't make the full-size file, so this one is half size (fine for screens).", "info");
        return { url, ratio: 0.5 };
      } catch {
        console.error("[posters] export failed:", error);
        showToast("Couldn't create the image. If the poster uses a photo from another site, remove it and try again.", "error");
        return null;
      }
    }
  }

  async function download(type: "png" | "jpeg") {
    const stage = await readyStage();
    if (!stage) return;
    const image = renderImage(stage, type);
    if (image) saveFile(image.url, `${fileName()}.${type === "png" ? "png" : "jpg"}`);
  }

  async function downloadPdf() {
    const stage = await readyStage();
    if (!stage) return;
    const image = renderImage(stage, "jpeg");
    if (!image) return;
    const jpeg = new Uint8Array(await (await fetch(image.url)).arrayBuffer());
    const pdf = jpegToPdf(jpeg, pdfPageSize(design.size, design.width, design.height), title.trim() || "Poster");
    const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
    saveFile(url, `${fileName()}.pdf`);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  /** Sends the poster image to the phone's share sheet (WhatsApp, etc.); downloads it where sharing files isn't supported. */
  async function sharePoster() {
    const stage = await readyStage();
    if (!stage) return;
    const image = renderImage(stage, "jpeg");
    if (!image) return;
    const blob = await (await fetch(image.url)).blob();
    const file = new File([blob], `${fileName()}.jpg`, { type: "image/jpeg" });
    if (!navigator.canShare?.({ files: [file] })) {
      saveFile(image.url, file.name);
      return showToast("Sharing images isn't supported in this browser, so it was downloaded instead.", "info");
    }
    const result = await shareContent({ title: title.trim() || "Poster", file });
    if (result === "failed") showToast("Couldn't share on this device. Use Download instead.", "error");
  }

  /** Plays the entrances on the canvas (the editor's preview). */
  async function previewAnimation() {
    if (!design.elements.some((e) => e.animation && e.animation.entrance !== "none")) {
      return showToast("Nothing is animated yet. Choose “Animate everything”, or pick an entrance for an element.", "info");
    }
    const stage = await readyStage();
    if (!stage || animating) return;
    setAnimating("preview");
    await playOnStage(stage, design);
    setAnimating(null);
  }

  /**
   * Records the animation to a video in the browser (MediaRecorder): MP4
   * where supported, otherwise WebM. Nothing is uploaded. If the poster has
   * no animation yet, "Animate everything" is used for this video only.
   */
  async function downloadVideo() {
    if (animating) return;
    const type = typeof MediaRecorder === "undefined" ? null : pickVideoType((t) => MediaRecorder.isTypeSupported(t));
    const probe = document.createElement("canvas");
    if (!type || typeof probe.captureStream !== "function") {
      return showToast("This browser can't record video. Try Chrome, Edge or Safari, or download a PNG instead.", "error");
    }
    const animated = design.elements.some((e) => e.animation && e.animation.entrance !== "none")
      ? design
      : { ...design, elements: animateAll(design.elements, design.height) };
    const stage = await readyStage();
    if (!stage) return;
    setAnimating("video");
    try {
      const blob = await recordVideo(stage, animated, type.mimeType, false).catch((error) => {
        // Low-memory phones: try again at 720p.
        console.error("[posters] full-size video failed, retrying smaller:", error);
        return recordVideo(stage, animated, type.mimeType, true);
      });
      const url = URL.createObjectURL(blob);
      saveFile(url, `${fileName()}.${type.extension}`);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      showToast(type.extension === "mp4" ? "Video saved (MP4)." : "Video saved (WebM). WhatsApp on Android and most sites accept it.", "success");
    } catch (error) {
      console.error("[posters] video export failed:", error);
      showToast("Couldn't record the video on this device. If the poster uses a photo from another site, remove it and try again.", "error");
    } finally {
      setAnimating(null);
    }
  }

  async function recordVideo(stage: Konva.Stage, animated: PosterDesign, mimeType: string, lowMemory: boolean): Promise<Blob> {
    const size = videoSize(animated.width, animated.height, lowMemory);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D canvas");
    const ratio = size.width / (animated.width * scale);
    const draw = () => {
      const frame = stage.toCanvas({ pixelRatio: ratio });
      ctx.drawImage(frame, 0, 0, size.width, size.height);
    };
    draw();
    const recorder = new MediaRecorder(canvas.captureStream(VIDEO_FPS), { mimeType, videoBitsPerSecond: lowMemory ? 4_000_000 : 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = (e) => reject((e as unknown as { error?: Error }).error ?? new Error("Recording failed"));
    });
    recorder.start(250);
    await playOnStage(stage, animated, { onFrame: draw });
    recorder.stop();
    await stopped;
    if (!chunks.length) throw new Error("Empty recording");
    return new Blob(chunks, { type: mimeType.split(";")[0] });
  }

  const animationControls = {
    playing: Boolean(animating),
    onPreview: previewAnimation,
    onAnimateAll: () => {
      change((d) => ({ ...d, elements: animateAll(d.elements, d.height) }));
      showToast("Everything now animates in, top to bottom. Press Play to watch.", "info");
    },
    onClear: () => change((d) => ({ ...d, elements: clearAnimations(d.elements) })),
  };

  // Keyboard shortcuts (not while typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = target.closest("input, textarea, select, [contenteditable]");
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (typing || editingId) return;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setHistory((h) => (e.shiftKey ? redo(h) : undo(h)));
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        setHistory(redo);
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected && !selected.locked) {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "Escape") {
        setSelectedId(null);
      } else if (selected && !selected.locked && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        change((d) => updateElement(d, selected.id, { x: selected.x + dx, y: selected.y + dy }), `${selected.id}:nudge`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const editing = editingId ? (findElement(design, editingId) as TextElement | undefined) : undefined;

  return (
    <div className="-mx-4 -my-6 flex flex-col sm:-mx-8 sm:-my-8 lg:-mx-12 lg:-my-10 lg:h-[calc(100dvh-0px)]">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <Link href="/dashboard/posters" className="btn-ghost btn-sm" aria-label="Back to Poster Studio">
          <ChevronLeft aria-hidden className="h-4 w-4" />
          <span className="hidden sm:inline">Posters</span>
        </Link>
        <label htmlFor="poster-title" className="sr-only">
          Poster name
        </label>
        <input
          id="poster-title"
          className="input w-40 py-1.5 font-semibold sm:w-56"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label htmlFor="poster-size" className="sr-only">
          Size
        </label>
        <select id="poster-size" className="input w-auto py-1.5 text-base sm:text-sm" value={design.size} onChange={(e) => changeSize(e.target.value as PosterSize)}>
          {POSTER_SIZE_KEYS.map((s) => (
            <option key={s} value={s}>
              {POSTER_SIZES[s].label} ({POSTER_SIZES[s].hint})
            </option>
          ))}
        </select>

        <div className="flex items-center gap-0.5">
          <ToolbarButton label="Undo (Ctrl+Z)" icon={Undo2} disabled={!history.past.length} onClick={() => setHistory(undo)} />
          <ToolbarButton label="Redo (Ctrl+Shift+Z)" icon={Redo2} disabled={!history.future.length} onClick={() => setHistory(redo)} />
        </div>
        <div className="hidden items-center gap-0.5 sm:flex">
          <ToolbarButton label="Zoom out" icon={ZoomOut} disabled={zoom <= ZOOM_STEPS[0]} onClick={() => setZoom((z) => [...ZOOM_STEPS].reverse().find((s) => s < z) ?? z)} />
          <button type="button" className="btn-ghost btn-sm tabular w-14" onClick={() => setZoom(1)} title="Fit to screen">
            {Math.round(zoom * 100)}%
          </button>
          <ToolbarButton label="Zoom in" icon={ZoomIn} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} onClick={() => setZoom((z) => ZOOM_STEPS.find((s) => s > z) ?? z)} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="sr-only text-xs text-ink/60 md:not-sr-only md:inline" role="status">
            {animating === "video" ? "Recording video…" : saving ? "Saving…" : dirty ? "Unsaved changes" : posterId ? "All changes saved" : ""}
          </span>
          {conflict && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => save(true)}>
              Save as a copy
            </button>
          )}
          <details className="relative">
            <summary className="btn-secondary btn-sm list-none">
              <Download aria-hidden className="h-4 w-4" />
              Download
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-line bg-surface p-1 shadow-pop">
              <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-raised" onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; sharePoster(); }}>
                <span className="block font-semibold">Share…</span>
                <span className="block text-xs text-ink/60">Send the image to WhatsApp and other apps</span>
              </button>
              <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-raised" onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; download("png"); }}>
                <span className="block font-semibold">PNG</span>
                <span className="block text-xs text-ink/60">Best quality, for print and sharing</span>
              </button>
              <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-raised" onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; download("jpeg"); }}>
                <span className="block font-semibold">JPG</span>
                <span className="block text-xs text-ink/60">Smaller file, for WhatsApp</span>
              </button>
              <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-raised" onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; downloadPdf(); }}>
                <span className="block font-semibold">PDF</span>
                <span className="block text-xs text-ink/60">{design.size === "a4" ? "A4 page, ready to print" : "One page, for email and printing"}</span>
              </button>
              <button type="button" disabled={Boolean(animating)} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-raised disabled:opacity-50" onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; downloadVideo(); }}>
                <span className="block font-semibold">Video</span>
                <span className="block text-xs text-ink/60">Animated, about 6 seconds, for status and Reels</span>
              </button>
            </div>
          </details>
          <button type="button" className="btn-primary btn-sm" onClick={() => save()} disabled={saving || !title.trim()}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {recoverable && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-info-line bg-info-tint px-4 py-2.5 text-sm text-info">
          <span>
            You have unsaved changes to this poster from {new Date(recoverable.savedAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}.
          </span>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              change(() => recoverable.design);
              setTitle(recoverable.title);
              setRecoverable(null);
            }}
          >
            Restore them
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              clearDraft(initialPosterId);
              setRecoverable(null);
            }}
          >
            Discard
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Desktop left rail */}
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-line bg-surface p-4 lg:block" aria-label="Poster tools">
          <div role="group" aria-label="Tools" className="mb-4 flex gap-1 rounded-xl border border-line bg-surface-raised p-1">
            {(
              [
                ["add", "Add"],
                ["photos", "Photos"],
                ["layers", "Layers"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={railTab === key}
                onClick={() => setRailTab(key)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-sm ${railTab === key ? "bg-surface font-semibold shadow-xs" : "text-ink/60 hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {railTab === "add" && (
            <InsertPanel
              onAddText={(preset) => addAndSelect(createText(design, preset, DEFAULT_FONT))}
              onAddShape={(shape) => addAndSelect(createShape(design, shape))}
              onAddPhotoSlot={() => addAndSelect(photoSlot(design))}
              onAddSpeaker={() => addAndSelect(createSpeaker(design, DEFAULT_FONT))}
              onOpenPhotos={() => setRailTab("photos")}
              onAddIcon={(key) => addAndSelect(createIcon(design, key))}
            />
          )}
          {railTab === "photos" && <PhotosPanel targetLabel={photoTarget} onUse={usePhoto} onBackground={setBackgroundPhoto} onUrls={addUrls} />}
          {railTab === "layers" && <LayersPanel design={design} selectedId={selectedId} onSelect={select} />}
        </aside>

        {/* Canvas */}
        <div
          ref={canvasArea}
          className="relative flex min-h-[55vh] flex-1 items-center justify-center overflow-auto bg-surface-raised p-4 lg:min-h-0"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <div className="relative shadow-card" role="img" aria-label={`Poster preview: ${title}. Use the Layers and properties panels to edit with a keyboard.`}>
            <EditorCanvas
              design={design}
              scale={scale}
              selectedId={selectedId}
              editingId={editingId}
              fontVersion={fontVersion}
              imageUrls={urls}
              stageRef={stageRef}
              onSelect={select}
              onChange={(id, changes) => change((d) => updateElement(d, id, changes))}
              onStartEditText={(id) => setEditingId(id)}
            />
            {editing && (
              <TextEditOverlay
                element={editing}
                scale={scale}
                onChange={(text) => change((d) => updateElement(d, editing.id, { text }), `${editing.id}:text`)}
                onDone={() => setEditingId(null)}
              />
            )}
          </div>
        </div>

        {/* Desktop properties */}
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-line bg-surface p-4 lg:block" aria-label="Properties">
          <PropertiesPanel
            design={design}
            element={selected}
            onChange={updateSelected}
            onChildChange={(childId, changes, key) => selectedId && change((d) => updateChild(d, selectedId, childId, changes), key)}
            onBackgroundChange={(background, key) => change((d) => ({ ...d, background }), key)}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onReorder={(where) => selectedId && change((d) => reorderElement(d, selectedId, where))}
            onApplyStyle={(key) => {
              change((d) => applyStyle(d, key));
              showToast(`${posterStyle(key)?.name} style applied. Undo (Ctrl+Z) to go back.`, "info");
            }}
            animation={animationControls}
          />
        </aside>

        {/* Phones: tabs under the canvas */}
        <div className="border-t border-line bg-surface lg:hidden">
          {/* A simple toggle group (not ARIA tabs, which promise arrow-key navigation). */}
          <div role="group" aria-label="Editor tools" className="flex border-b border-line">
            {(
              [
                ["add", Plus, "Add"],
                ["photos", ImageIcon, "Photos"],
                ["layers", Layers, "Layers"],
                ["edit", SlidersHorizontal, selected ? "Edit" : "Background"],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={panel === key}
                onClick={() => setPanel(key)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium ${panel === key ? "border-b-2 border-ember text-ink" : "text-ink/60"}`}
              >
                <Icon aria-hidden className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <div className="max-h-[45vh] overflow-y-auto p-4">
            {panel === "add" && (
              <InsertPanel
                onAddText={(preset) => addAndSelect(createText(design, preset, DEFAULT_FONT))}
                onAddShape={(shape) => addAndSelect(createShape(design, shape))}
                onAddPhotoSlot={() => addAndSelect(photoSlot(design))}
                onAddSpeaker={() => addAndSelect(createSpeaker(design, DEFAULT_FONT))}
                onOpenPhotos={() => setPanel("photos")}
                onAddIcon={(key) => addAndSelect(createIcon(design, key))}
              />
            )}
            {panel === "photos" && <PhotosPanel targetLabel={photoTarget} onUse={usePhoto} onBackground={setBackgroundPhoto} onUrls={addUrls} />}
            {panel === "layers" && <LayersPanel design={design} selectedId={selectedId} onSelect={select} />}
            {panel === "edit" && (
              <PropertiesPanel
                design={design}
                element={selected}
                onChange={updateSelected}
                onChildChange={(childId, changes, key) => selectedId && change((d) => updateChild(d, selectedId, childId, changes), key)}
                onBackgroundChange={(background, key) => change((d) => ({ ...d, background }), key)}
                onDuplicate={duplicateSelected}
                onDelete={deleteSelected}
                onReorder={(where) => selectedId && change((d) => reorderElement(d, selectedId, where))}
                onApplyStyle={(key) => {
                  change((d) => applyStyle(d, key));
                  showToast(`${posterStyle(key)?.name} style applied. Undo (Ctrl+Z) to go back.`, "info");
                }}
                animation={animationControls}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A chosen photo as a new element: up to half the poster, keeping its shape, centred. */
function photoElement(design: PosterDesign, choice: PhotoChoice): PosterElement {
  const max = Math.min(design.width, design.height) * 0.5;
  const ratio = choice.width / choice.height || 1;
  const width = Math.round(ratio >= 1 ? max : max * ratio);
  const height = Math.round(ratio >= 1 ? max / ratio : max);
  return {
    id: newId("photo"),
    type: "image",
    name: "Photo",
    x: Math.round((design.width - width) / 2),
    y: Math.round((design.height - height) / 2),
    width,
    height,
    rotation: 0,
    opacity: 1,
    src: choice.src,
    fit: "cover",
    shape: "rect",
    cornerRadius: 0,
  };
}

function photoSlot(design: PosterDesign): PosterElement {
  const side = Math.round(Math.min(design.width, design.height) * 0.4);
  return {
    id: newId("photo"),
    type: "image",
    name: "Photo",
    x: Math.round((design.width - side) / 2),
    y: Math.round((design.height - side) / 2),
    width: side,
    height: side,
    rotation: 0,
    opacity: 1,
    src: { kind: "placeholder", label: "Add a photo" },
    fit: "cover",
    shape: "rect",
    cornerRadius: 0,
  };
}

function ToolbarButton({ label, icon: Icon, onClick, disabled }: { label: string; icon: typeof Undo2; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled} className="btn-ghost btn-icon h-9 w-9 disabled:opacity-30 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11">
      <Icon aria-hidden className="h-4 w-4" />
    </button>
  );
}
