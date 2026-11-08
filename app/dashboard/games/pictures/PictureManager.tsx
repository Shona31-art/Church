"use client";

import { useRef, useState } from "react";
import { useCanPickMultiple } from "@/lib/use-multi-pick";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { deletePicture, uploadPicture } from "./actions";
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

/** Upload and delete the church's jigsaw pictures. */
export function PictureManager({ pictures }: { pictures: PictureRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Several at once in browsers and newer Android apps (lib/use-multi-pick.ts).
  const multi = useCanPickMultiple();
  const [confirm, confirmDialog] = useConfirm();

  /** Uploads every picked picture, one after another, and says how many made it. */
  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!files.length) return;
    setError(null);
    let added = 0;
    const failed: string[] = [];
    for (const [i, file] of files.entries()) {
      setBusy(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : "Uploading…");
      try {
        const small = await toCompressedImage(file, 1600, 1.6 * 1024 * 1024);
        const r = await uploadPicture({ mimeType: small.blob.type, data: await toBase64(small.blob), title: file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "Picture" });
        if (r.ok) added++;
        else failed.push(`${file.name}: ${r.error}`);
      } catch {
        failed.push(`${file.name}: couldn't read that picture (try a JPG or PNG)`);
      }
    }
    setBusy(null);
    if (failed.length) setError(failed.slice(0, 5).join(" · ") + (failed.length > 5 ? ` · and ${failed.length - 5} more` : ""));
    if (added) {
      showToast(added === 1 ? "Picture added to the jigsaw." : `${added} pictures added to the jigsaw.`, "success");
      router.refresh();
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

      <section className="card-elevated space-y-4 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">
            Your jigsaw pictures <span className="font-normal text-ink/60">({pictures.length})</span>
          </h2>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null} className="btn-secondary btn-sm">
            <ImagePlus aria-hidden className="h-4 w-4" /> {multi ? "Upload pictures" : "Upload a picture"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple={multi} className="sr-only" onChange={onUpload} aria-label={multi ? "Upload pictures" : "Upload a picture"} />
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
