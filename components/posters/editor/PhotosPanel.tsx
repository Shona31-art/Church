"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/components/ui/Toaster";
import { deletePosterAsset, listPosterAssets, registerPosterAsset, requestPosterUpload, type LibraryPhoto } from "@/app/dashboard/posters/asset-actions";
import { toCompressedImage } from "@/lib/image-resize";
import type { ImageSource } from "@/lib/posters/design";
import type { StockPhoto } from "@/app/api/posters/stock/route";

const MAX_DIMENSION = 2000;
const MAX_BYTES = 4.5 * 1024 * 1024;

export interface PhotoChoice {
  src: ImageSource;
  width: number;
  height: number;
}

/**
 * Photos for the poster: the church's own library (upload, reuse, delete) and
 * free Pexels stock photos. Choosing a photo fills the selected photo slot or
 * speaker photo, or adds it as a new photo; "Background" fills the whole poster.
 */
export function PhotosPanel({
  targetLabel,
  onUse,
  onBackground,
  onUrls,
}: {
  /** What clicking a photo will do, e.g. "Replaces the selected photo". */
  targetLabel: string;
  onUse: (choice: PhotoChoice) => void;
  onBackground: (choice: PhotoChoice) => void;
  /** Hands signed URLs for library photos to the canvas. */
  onUrls: (urls: Record<string, string>) => void;
}) {
  const [tab, setTab] = useState<"library" | "stock">("library");
  return (
    <div className="space-y-4">
      <div role="group" aria-label="Photo source" className="flex gap-1 rounded-xl border border-line bg-surface-raised p-1">
        {(
          [
            ["library", "Your photos"],
            ["stock", "Free photos"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-sm ${tab === key ? "bg-surface font-semibold shadow-xs" : "text-ink/60 hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink/55">{targetLabel}</p>
      {tab === "library" ? <Library onUse={onUse} onBackground={onBackground} onUrls={onUrls} /> : <Stock onUse={onUse} onBackground={onBackground} />}
    </div>
  );
}

function Library({ onUse, onBackground, onUrls }: { onUse: (c: PhotoChoice) => void; onBackground: (c: PhotoChoice) => void; onUrls: (u: Record<string, string>) => void }) {
  const [photos, setPhotos] = useState<LibraryPhoto[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isLogo, setIsLogo] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setFailed(null);
    const res = await listPosterAssets().catch(() => null);
    if (!res?.ok) return setFailed(res && !res.ok ? res.error : "Couldn't load your photo library.");
    setPhotos(res.data);
    onUrls(Object.fromEntries(res.data.map((p) => [p.path, p.url])));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(file: File) {
    setUploading(true);
    try {
      // Logos keep their original PNG (transparency) when small enough; everything
      // else is resized and re-encoded in the browser, which also strips location data.
      const keepOriginal = isLogo && file.type === "image/png" && file.size <= 2 * 1024 * 1024;
      const blob = keepOriginal ? file : (await toCompressedImage(file, MAX_DIMENSION, MAX_BYTES)).blob;
      const bitmap = await createImageBitmap(blob);
      const { width, height } = bitmap;
      bitmap.close();
      if (keepOriginal && Math.max(width, height) > 4000) throw new Error("too large");

      const ticket = await requestPosterUpload({ contentType: blob.type, bytes: blob.size });
      if (!ticket.ok) return showToast(ticket.error, "error");
      const { error } = await createClient().storage.from("poster-assets").uploadToSignedUrl(ticket.data.path, ticket.data.token, blob, { contentType: blob.type });
      if (error) throw error;
      const saved = await registerPosterAsset({ path: ticket.data.path, width, height, bytes: blob.size, kind: isLogo ? "logo" : "photo" });
      if (!saved.ok) return showToast(saved.error, "error");
      setPhotos((list) => [saved.data, ...(list ?? [])]);
      onUrls({ [saved.data.path]: saved.data.url });
      onUse(toChoice(saved.data));
      showToast("Photo added.");
    } catch (error) {
      console.error("[posters] upload failed:", error);
      showToast("Couldn't upload that photo. Try a JPG or PNG under 10 MB.", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(photo: LibraryPhoto) {
    const res = await deletePosterAsset(photo.id).catch(() => null);
    setConfirmDelete(null);
    if (!res?.ok) return showToast(res && !res.ok ? res.error : "Couldn't delete the photo.", "error");
    setPhotos((list) => list?.filter((p) => p.id !== photo.id) ?? null);
    showToast("Photo deleted. Posters that used it now show an empty photo slot.");
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className={`btn-secondary w-full cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}>
          <ImagePlus aria-hidden className="h-4 w-4" />
          {uploading ? "Uploading…" : "Upload a photo"}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        <label className="flex items-center gap-2 text-xs text-ink/60">
          <input type="checkbox" checked={isLogo} onChange={(e) => setIsLogo(e.target.checked)} />
          It&apos;s a logo (keep a transparent background)
        </label>
        <p className="text-xs text-ink/50">Only use photos you have permission to use. Speaker photos can be deleted any time.</p>
      </div>

      {failed ? (
        <p className="text-sm text-danger" role="alert">
          {failed}{" "}
          <button type="button" className="link" onClick={load}>
            Try again
          </button>
        </p>
      ) : photos === null ? (
        <p className="text-sm text-ink/55" role="status">
          Loading your photos…
        </p>
      ) : !photos.length ? (
        <p className="text-sm text-ink/55">No photos yet. Upload speaker photos, your logo or church pictures to reuse them on any poster.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {photos.map((p) => (
            <li key={p.id} className="space-y-1">
              <button type="button" onClick={() => onUse(toChoice(p))} className="block w-full overflow-hidden rounded-lg border border-line hover:border-ember" aria-label={`Use ${p.label ?? (p.kind === "logo" ? "logo" : "photo")}`}>
                {p.url ? (
                  <Image src={p.url} alt="" width={240} height={Math.round((240 * p.height) / p.width)} unoptimized className="aspect-square w-full bg-surface-raised object-cover" />
                ) : (
                  <span className="flex aspect-square items-center justify-center bg-surface-raised text-xs text-ink/50">Unavailable</span>
                )}
              </button>
              <div className="flex items-center justify-between gap-1">
                <button type="button" className="text-xs font-medium text-ink/60 hover:text-ink" onClick={() => onBackground(toChoice(p))}>
                  Background
                </button>
                {p.canDelete &&
                  (confirmDelete === p.id ? (
                    <span className="flex gap-1">
                      <button type="button" className="text-xs font-semibold text-danger" onClick={() => remove(p)}>
                        Delete
                      </button>
                      <button type="button" className="text-xs text-ink/60" onClick={() => setConfirmDelete(null)}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button type="button" aria-label="Delete photo" title="Delete photo" className="text-ink/45 hover:text-danger" onClick={() => setConfirmDelete(p.id)}>
                      <Trash2 aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stock({ onUse, onBackground }: { onUse: (c: PhotoChoice) => void; onBackground: (c: PhotoChoice) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ q: string; photos: StockPhoto[]; page: number; hasMore: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(q: string, page = 1) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/posters/stock?q=${encodeURIComponent(q)}&page=${page}`);
      const body = await res.json();
      if (!res.ok) return setError(body.error ?? "Photo search isn't responding.");
      setResults((prev) => ({ q, page, hasMore: body.hasMore, photos: page > 1 && prev ? [...prev.photos, ...body.photos] : body.photos }));
    } catch {
      setError("Photo search isn't responding. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  const choice = (p: StockPhoto): PhotoChoice => ({
    src: { kind: "stock", provider: "pexels", url: p.url, photographer: p.photographer, photographerUrl: p.photographerUrl, pageUrl: p.pageUrl },
    width: p.width,
    height: p.height,
  });

  return (
    <div className="space-y-3">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 2) search(query.trim());
        }}
        className="flex gap-2"
      >
        <label htmlFor="stock-search" className="sr-only">
          Search free photos
        </label>
        <input id="stock-search" className="input py-2" placeholder="e.g. worship, cross, sunrise" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} />
        <button type="submit" className="btn-primary btn-sm shrink-0" aria-label="Search" disabled={busy}>
          <Search aria-hidden className="h-4 w-4" />
        </button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {["worship", "cross", "praying hands", "church", "sunrise", "bible", "crowd hands raised", "candles"].map((s) => (
          <button key={s} type="button" className="rounded-full border border-line px-2.5 py-1 text-xs text-ink/70 hover:border-line-strong" onClick={() => { setQuery(s); search(s); }}>
            {s}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {busy && !results && (
        <p className="text-sm text-ink/55" role="status">
          Searching…
        </p>
      )}
      {results && !results.photos.length && <p className="text-sm text-ink/55">No photos for “{results.q}”. Try a simpler word.</p>}
      {results && results.photos.length > 0 && (
        <>
          <ul className="grid grid-cols-2 gap-2">
            {results.photos.map((p) => (
              <li key={p.id} className="space-y-1">
                <button type="button" onClick={() => onUse(choice(p))} className="block w-full overflow-hidden rounded-lg border border-line hover:border-ember" style={{ backgroundColor: p.color }} aria-label={`Use photo: ${p.alt}, by ${p.photographer}`}>
                  <Image src={p.thumb} alt="" width={240} height={Math.round((240 * p.height) / p.width)} unoptimized className="aspect-square w-full object-cover" />
                </button>
                <div className="flex items-center justify-between gap-1">
                  <button type="button" className="text-xs font-medium text-ink/60 hover:text-ink" onClick={() => onBackground(choice(p))}>
                    Background
                  </button>
                  <a href={p.photographerUrl} target="_blank" rel="noopener noreferrer" className="truncate text-[11px] text-ink/45 hover:text-ink" title={`Photo by ${p.photographer} on Pexels`}>
                    {p.photographer}
                  </a>
                </div>
              </li>
            ))}
          </ul>
          {results.hasMore && (
            <button type="button" className="btn-secondary btn-sm w-full" disabled={busy} onClick={() => search(results.q, results.page + 1)}>
              {busy ? "Loading…" : "More photos"}
            </button>
          )}
        </>
      )}
      <p className="text-xs text-ink/50">
        <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="link">
          Photos provided by Pexels
        </a>
        . Don&apos;t suggest that people shown in stock photos endorse your event.
      </p>
    </div>
  );
}

function toChoice(p: LibraryPhoto): PhotoChoice {
  return { src: { kind: "asset", assetId: p.id, path: p.path }, width: p.width, height: p.height };
}
