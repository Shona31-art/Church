"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus, RefreshCw, Share2, Sparkles, Wand2, X, BookmarkPlus } from "lucide-react";
import { toCompressedImage } from "@/lib/image-resize";
import { shareContent } from "@/lib/share";
import { createClient } from "@/lib/supabase/client";
import { Alert } from "@/components/ui/Alert";
import { showToast } from "@/components/ui/Toaster";
import { POSTER_SIZES, type ImageInput, type PosterSize } from "@/lib/ai-image-sizes";
import { createAiPoster } from "./actions";
import { registerPosterAsset, requestPosterUpload } from "../asset-actions";

const MAX_PHOTOS = 3;
const EXAMPLES = [
  "Youth night this Friday 7pm at the church hall. Theme: 'Unshakeable'. Speaker Pastor James. Pizza and worship. Bright, energetic, purple and gold.",
  "Easter Sunday service, 20 April, 9am. 'He is risen'. Sunrise over an empty tomb, warm and hopeful, elegant gold lettering.",
  "Women's conference 'Daughters of Destiny', 14–15 March, R150 per person, registration on WhatsApp 082 123 4567. Soft pink and gold, classy.",
];

interface Photo {
  url: string;
  input: ImageInput;
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrl(image: ImageInput) {
  return `data:${image.mimeType};base64,${image.data}`;
}

async function toBlob(image: ImageInput): Promise<Blob> {
  return (await fetch(dataUrl(image))).blob();
}

/** Shrink an image for sending to the AI (keeps requests small and fast). */
async function shrink(blob: Blob, maxDimension: number, maxBytes: number): Promise<ImageInput> {
  const file = blob instanceof File ? blob : new File([blob], "image", { type: blob.type });
  const small = await toCompressedImage(file, maxDimension, maxBytes);
  return { mimeType: small.blob.type as ImageInput["mimeType"], data: await toBase64(small.blob) };
}

/**
 * Describe the poster, add photos if you like, and the AI designs the whole
 * thing. Then ask for changes ("make the title bigger"), try again, download,
 * share, or save it to the church's poster photos.
 */
export function AiPosterStudio({ hasLogo }: { hasLogo: boolean }) {
  const [description, setDescription] = useState("");
  const [size, setSize] = useState<PosterSize>("portrait");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [includeLogo, setIncludeLogo] = useState(hasLogo);
  const [busy, setBusy] = useState<null | "create" | "refine" | "save">(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [poster, setPoster] = useState<ImageInput | null>(null);
  const [refine, setRefine] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (busy !== "create" && busy !== "refine") return;
    setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  async function addPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])].slice(0, MAX_PHOTOS - photos.length);
    event.target.value = "";
    setError(null);
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const input = await shrink(file, 1024, 700 * 1024);
        setPhotos((list) => [...list, { url: URL.createObjectURL(file), input }].slice(0, MAX_PHOTOS));
      } catch {
        setError("Couldn't read one of those photos. Try a JPG or PNG.");
      }
    }
  }

  async function run(mode: "create" | "refine") {
    setError(null);
    if (mode === "refine" && !refine.trim()) return setError("Say what you'd like changed, e.g. “make the title bigger”.");
    setBusy(mode);
    try {
      // The poster goes back to the AI (as a smaller JPEG) so it can change it.
      const previous = mode === "refine" && poster ? await shrink(await toBlob(poster), 1280, 900 * 1024) : undefined;
      const result = await createAiPoster({
        description,
        size,
        photos: photos.map((p) => p.input),
        includeLogo,
        previous,
        refine: mode === "refine" ? refine : undefined,
      });
      if (!result.ok) return setError(result.error);
      setPoster(result.image);
      if (mode === "refine") setRefine("");
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setError("Lost the connection while the AI was working. Check your internet and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function posterFile() {
    const blob = await toBlob(poster!);
    const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
    return new File([blob], `poster.${ext}`, { type: blob.type });
  }

  async function download() {
    const file = await posterFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function share() {
    const result = await shareContent({ title: "Poster", file: await posterFile() });
    if (result === "copied") showToast("Your phone can't share images from here — use Download instead.");
    if (result === "failed") showToast("Couldn't open sharing — use Download instead.", "error");
  }

  async function saveToLibrary() {
    setBusy("save");
    try {
      const small = await toCompressedImage(await posterFile(), 2048, 4.5 * 1024 * 1024);
      const bitmap = await createImageBitmap(small.blob);
      const { width, height } = bitmap;
      bitmap.close();
      const ticket = await requestPosterUpload({ contentType: small.blob.type, bytes: small.blob.size });
      if (!ticket.ok) return showToast(ticket.error, "error");
      const { error: uploadError } = await createClient().storage.from("poster-assets").uploadToSignedUrl(ticket.data.path, ticket.data.token, small.blob, { contentType: small.blob.type });
      if (uploadError) throw uploadError;
      const saved = await registerPosterAsset({ path: ticket.data.path, width, height, bytes: small.blob.size, kind: "photo", label: "AI poster" });
      if (!saved.ok) return showToast(saved.error, "error");
      showToast("Saved to your poster photos — it's in Photos when you edit a design.", "success");
    } catch {
      showToast("Couldn't save it — check your connection and try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  const working = busy === "create" || busy === "refine";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card-elevated space-y-5 rounded-2xl p-5 sm:p-6" aria-labelledby="describe-heading">
        <div>
          <h2 id="describe-heading" className="font-semibold">
            1. Describe your poster
          </h2>
          <p className="mt-1 text-sm text-ink/60">Include the event, date, time, place and any wording you want — and the look or colours you like.</p>
        </div>
        <div>
          <label htmlFor="ai-description" className="sr-only">
            Poster description
          </label>
          <textarea
            id="ai-description"
            rows={6}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Sunday service this week at 9am, theme 'Walking in faith', guest speaker Pastor Mary. Warm, golden, welcoming."
            className="input"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((example, i) => (
              <button key={i} type="button" onClick={() => setDescription(example)} className="rounded-full border border-line px-3 py-1 text-xs text-ink/70 hover:border-gold hover:text-ink">
                Example {i + 1}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-semibold">2. Add photos (optional)</h2>
          <p className="mt-1 text-sm text-ink/60">A speaker, your building, a past event — up to {MAX_PHOTOS}. The AI builds the poster around them.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {photos.map((photo, i) => (
              <div key={photo.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                <img src={photo.url} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-xl border border-line object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((list) => list.filter((p) => p !== photo))}
                  className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-ink text-parchment shadow"
                  aria-label={`Remove photo ${i + 1}`}
                >
                  <X aria-hidden className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button type="button" onClick={() => fileRef.current?.click()} className="grid h-20 w-20 place-items-center rounded-xl border-2 border-dashed border-line text-ink/60 hover:border-gold hover:text-ink">
                <ImagePlus aria-hidden className="h-6 w-6" />
                <span className="sr-only">Add a photo</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={addPhotos} aria-label="Add photos" />
          </div>
          {hasLogo ? (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeLogo} onChange={(e) => setIncludeLogo(e.target.checked)} className="h-4 w-4" /> Put our church logo on it
            </label>
          ) : (
            <p className="mt-3 text-xs text-ink/60">Tip: upload your church logo in Church settings → Church profile and the AI can add it.</p>
          )}
        </div>

        <div>
          <h2 className="font-semibold">3. Size</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(Object.keys(POSTER_SIZES) as PosterSize[]).map((key) => (
              <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${size === key ? "border-ember bg-ember/10 font-semibold" : "border-line"}`}>
                <input type="radio" name="size" value={key} checked={size === key} onChange={() => setSize(key)} className="sr-only" />
                <span aria-hidden className="grid h-6 w-6 place-items-center">
                  <span className="block rounded-sm border-2 border-current" style={{ aspectRatio: POSTER_SIZES[key].aspectRatio.replace(":", "/"), height: "100%" }} />
                </span>
                {POSTER_SIZES[key].label}
              </label>
            ))}
          </div>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <button type="button" onClick={() => run("create")} disabled={busy !== null || description.trim().length < 10} className="btn-primary w-full">
          <Sparkles aria-hidden className="h-4 w-4" /> {busy === "create" ? `Designing your poster… ${seconds}s` : poster ? "Design a new one" : "Create my poster"}
        </button>
        <p className="text-center text-xs text-ink/60">Takes about 10–30 seconds. Always check names, dates and spelling before you share.</p>
      </section>

      <section ref={resultRef} className="card-elevated scroll-mt-24 rounded-2xl p-5 sm:p-6" aria-labelledby="result-heading" aria-busy={working}>
        <h2 id="result-heading" className="font-semibold">
          Your poster
        </h2>
        <div className="mt-4 grid place-items-center overflow-hidden rounded-xl border border-line bg-parchment" style={{ aspectRatio: POSTER_SIZES[size].aspectRatio.replace(":", "/") }}>
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element -- AI image held in memory
            <img src={dataUrl(poster)} alt="Your AI-designed poster" className={`h-full w-full object-contain transition-opacity ${working ? "opacity-40" : ""}`} />
          ) : (
            <div className="p-6 text-center text-sm text-ink/60">
              {working ? (
                <>
                  <Sparkles aria-hidden className="mx-auto mb-3 h-8 w-8 animate-pulse text-gold" />
                  Designing your poster… {seconds}s
                </>
              ) : (
                <>
                  <Wand2 aria-hidden className="mx-auto mb-3 h-8 w-8 text-gold" />
                  Your poster will appear here.
                </>
              )}
            </div>
          )}
        </div>

        {poster && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={download} disabled={working} className="btn-primary">
                <Download aria-hidden className="h-4 w-4" /> Download
              </button>
              <button type="button" onClick={share} disabled={working} className="btn-secondary">
                <Share2 aria-hidden className="h-4 w-4" /> Share
              </button>
              <button type="button" onClick={saveToLibrary} disabled={busy !== null} className="btn-secondary">
                <BookmarkPlus aria-hidden className="h-4 w-4" /> {busy === "save" ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => run("create")} disabled={busy !== null} className="btn-ghost">
                <RefreshCw aria-hidden className="h-4 w-4" /> Try again
              </button>
            </div>
            <div>
              <label htmlFor="ai-refine" className="label">
                Change something
              </label>
              <div className="flex gap-2">
                <input
                  id="ai-refine"
                  value={refine}
                  onChange={(e) => setRefine(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !busy && run("refine")}
                  maxLength={1000}
                  placeholder="e.g. make the title bigger, use blue instead of purple"
                  className="input min-w-0 flex-1"
                />
                <button type="button" onClick={() => run("refine")} disabled={busy !== null || !refine.trim()} className="btn-primary shrink-0">
                  {busy === "refine" ? `${seconds}s…` : "Update"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
