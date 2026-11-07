"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { showToast } from "@/components/ui/Toaster";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { deleteColoringPage, uploadColoringPage } from "./actions";
import type { ColoringPage } from "@/lib/coloring/pages";

/** Shrinks a picked page to at most 1600px and returns it as PNG base64. */
async function prepare(file: File): Promise<{ mimeType: string; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  // PNG keeps the outlines crisp, so fills stop exactly at the lines.
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("no image");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { mimeType: "image/png", data: btoa(bin) };
}

/** Pastors and church admins: add printable colouring pages, or remove them. */
export function PagesManager({ pages }: { pages: ColoringPage[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const mine = pages.filter((p) => p.mine);

  async function add(files: FileList) {
    for (const [i, file] of [...files].entries()) {
      setBusy(`Adding ${i + 1} of ${files.length}…`);
      try {
        const image = await prepare(file);
        const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 120) || "Colouring page";
        const r = await callAction(() => uploadColoringPage({ ...image, title }), { ok: false as const, error: CONNECTION_FAILED });
        if (!r.ok) showToast(`${file.name}: ${r.error}`, "error");
      } catch {
        showToast(`${file.name}: that picture couldn't be read.`, "error");
      }
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <section className="card-elevated mt-8 rounded-2xl p-5" aria-labelledby="pages-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="pages-heading" className="text-lg font-semibold">
            Your colouring pages ({mine.length})
          </h2>
          <p className="text-sm text-ink/60">Upload printable black-and-white pages you&apos;re allowed to use. Clear, closed outlines colour best.</p>
        </div>
        <button type="button" className="btn-secondary" disabled={Boolean(busy)} onClick={() => input.current?.click()}>
          <ImagePlus aria-hidden className="h-4 w-4" /> {busy ?? "Upload pages"}
        </button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(e) => e.target.files?.length && add(e.target.files)} />
      </div>
      {mine.length > 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {mine.map((p) => (
            <li key={p.id} className="relative overflow-hidden rounded-lg border border-line bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.title} className="aspect-square w-full object-contain" loading="lazy" />
              <button
                type="button"
                aria-label={`Remove ${p.title}`}
                className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-ink/70 shadow hover:text-danger"
                onClick={async () => {
                  const r = await callAction(() => deleteColoringPage(p.id), { ok: false as const, error: CONNECTION_FAILED });
                  if (!r.ok) showToast(r.error, "error");
                  router.refresh();
                }}
              >
                <Trash2 aria-hidden className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
