"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { createPictureWithAi, deletePicture, uploadPicture } from "./actions";
import { JIGSAW_PICTURE_IDEAS } from "@/lib/games/jigsaw";
import { toCompressedImage } from "@/lib/image-resize";
import { Alert } from "@/components/ui/Alert";
import { showToast } from "@/components/ui/Toaster";
import { useConfirm } from "@/components/ui/ConfirmDialog";

export interface PictureRow {
  id: string;
  title: string;
  reference: string | null;
  url: string | null;
  source: string;
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Create (AI), upload and delete the church's jigsaw pictures. */
export function PictureManager({ pictures, aiAvailable }: { pictures: PictureRow[]; aiAvailable: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState("");
  const [title, setTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, confirmDialog] = useConfirm();
  const have = new Set(pictures.map((p) => p.title.toLowerCase()));
  const missing = JIGSAW_PICTURE_IDEAS.filter((i) => !have.has(i.title.toLowerCase()));

  async function createAll() {
    setError(null);
    let made = 0;
    for (const [i, idea] of missing.entries()) {
      setBusy(`Painting ${i + 1} of ${missing.length}: ${idea.title}…`);
      const r = await createPictureWithAi(idea).catch(() => ({ ok: false as const, error: "Lost the connection — try again." }));
      if (!r.ok) {
        setError(`${idea.title}: ${r.error}`);
        break;
      }
      made++;
      router.refresh();
    }
    setBusy(null);
    if (made) showToast(`${made} ${made === 1 ? "picture" : "pictures"} added to the jigsaw.`, "success");
  }

  async function createOne() {
    setError(null);
    setBusy("Painting your picture… about 20 seconds");
    const r = await createPictureWithAi({ story, title: title || story.slice(0, 60) }).catch(() => ({ ok: false as const, error: "Lost the connection — try again." }));
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setStory("");
    setTitle("");
    showToast("Picture added to the jigsaw.", "success");
    router.refresh();
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy("Uploading…");
    try {
      const small = await toCompressedImage(file, 1600, 1.6 * 1024 * 1024);
      const r = await uploadPicture({ mimeType: small.blob.type, data: await toBase64(small.blob), title: file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "Picture" });
      if (!r.ok) setError(r.error);
      else {
        showToast("Picture added to the jigsaw.", "success");
        router.refresh();
      }
    } catch {
      setError("Couldn't read that picture. Try a JPG or PNG.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(p: PictureRow) {
    if (!(await confirm({ title: `Delete “${p.title}”?`, message: "It won't be used for new jigsaws any more. This can't be undone.", confirmLabel: "Delete picture" }))) return;
    const r = await deletePicture(p.id);
    if (!r.ok) return showToast(r.error, "error");
    showToast("Picture deleted.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && <Alert tone="error">{error}</Alert>}
      {busy && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-gold/10 px-4 py-3 text-sm font-medium">
          <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> {busy}
        </p>
      )}

      {aiAvailable ? (
        <section className="card-elevated space-y-4 rounded-2xl p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">Paint pictures with AI</h2>
            <p className="mt-1 text-sm text-ink/60">Rich, painted Bible scenes, made for your church. About 20 seconds each.</p>
          </div>
          {missing.length > 0 && (
            <button type="button" onClick={createAll} disabled={busy !== null} className="btn btn-amber w-full justify-center sm:w-auto">
              <Sparkles aria-hidden className="h-4 w-4" /> Create {missing.length === JIGSAW_PICTURE_IDEAS.length ? "all" : "the remaining"} {missing.length} Bible pictures
            </button>
          )}
          <details className="rounded-xl border border-line p-4">
            <summary className="cursor-pointer font-medium">Paint a different story</summary>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="label">What should it show?</span>
                <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={3} maxLength={600} className="input" placeholder="e.g. Jesus walking on the water towards Peter in a storm, the disciples watching from the boat" />
              </label>
              <label className="block">
                <span className="label">Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="input" placeholder="e.g. Jesus walks on water" />
              </label>
              <button type="button" onClick={createOne} disabled={busy !== null || story.trim().length < 5} className="btn-primary">
                <Sparkles aria-hidden className="h-4 w-4" /> Paint it
              </button>
            </div>
          </details>
        </section>
      ) : (
        <Alert tone="info">AI pictures need AI help on your plan and a Gemini key with billing turned on. You can still upload your own pictures.</Alert>
      )}

      <section className="card-elevated space-y-4 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">
            Your jigsaw pictures <span className="font-normal text-ink/60">({pictures.length})</span>
          </h2>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null} className="btn-secondary btn-sm">
            <ImagePlus aria-hidden className="h-4 w-4" /> Upload a picture
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onUpload} aria-label="Upload a picture" />
        </div>
        {pictures.length === 0 ? (
          <p className="text-sm text-ink/60">No pictures of your own yet — the jigsaw uses the built-in pictures. Pictures you add join them.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pictures.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-xl border border-line">
                <div className="aspect-square bg-ink/5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link */}
                  {p.url && <img src={p.url} alt={p.title} className="h-full w-full object-cover" />}
                </div>
                <div className="flex items-start gap-1 p-2">
                  <p className="min-w-0 flex-1 text-xs">
                    <span className="block truncate font-semibold">{p.title}</span>
                    {p.reference && <span className="text-ink/60">{p.reference}</span>}
                  </p>
                  <button type="button" onClick={() => remove(p)} className="btn-ghost btn-icon h-8 w-8 text-ink/50 hover:text-danger" aria-label={`Delete ${p.title}`}>
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {confirmDialog}
    </div>
  );
}
