"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CHURCH_LOGO_BUCKET, CHURCH_LOGO_MAX_BYTES, CHURCH_LOGO_MAX_DIMENSION, CHURCH_LOGO_MAX_SOURCE_BYTES, churchLogoPath } from "@/lib/church-logo";
import { toCompressedImage } from "@/lib/image-resize";
import { Alert } from "@/components/ui/Alert";
import { showToast } from "@/components/ui/Toaster";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { removeChurchLogo, setChurchLogo } from "../actions";
import { initials } from "@/lib/initials";

/**
 * Church logo: pick → shrink in the browser (keeping its shape and any
 * transparency) → upload to the church's folder → save. Shown in the app
 * header for everyone in the church, and used on posters.
 */
export function ChurchLogoForm({ churchId, churchName, logoUrl }: { churchId: string; churchName: string; logoUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [busy, setBusy] = useState<"uploading" | "removing" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Choose an image (PNG, JPG or WebP).");
    if (file.size > CHURCH_LOGO_MAX_SOURCE_BYTES) return setError("That image is over 10 MB — choose a smaller one.");

    setBusy("uploading");
    try {
      const { blob, extension } = await toCompressedImage(file, CHURCH_LOGO_MAX_DIMENSION, CHURCH_LOGO_MAX_BYTES);
      const path = churchLogoPath(churchId, crypto.randomUUID(), extension);
      const { error: uploadError } = await createClient().storage.from(CHURCH_LOGO_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
      if (uploadError) {
        console.error("[logo] upload failed:", uploadError.message);
        setError(
          /bucket.*not.*found/i.test(uploadError.message)
            ? "Logo uploads aren't set up yet: run supabase/church_logo.sql in the Supabase SQL Editor."
            : /jwt|auth/i.test(uploadError.message)
            ? "Your session has expired — sign in again."
            : "Couldn't upload the logo — check your connection and try again."
        );
        return;
      }
      const result = await callAction(() => setChurchLogo(path), { error: CONNECTION_FAILED });
      if (result.error) return setError(result.error);
      setPreview(URL.createObjectURL(blob));
      showToast("Church logo updated.");
      router.refresh();
    } catch {
      setError("We couldn't read that image. Try a PNG or JPG.");
    } finally {
      setBusy(null);
    }
  }

  async function onRemove() {
    setBusy("removing");
    setError(null);
    const result = await callAction(() => removeChurchLogo(), { error: CONNECTION_FAILED });
    setBusy(null);
    if (result.error) return setError(result.error);
    setPreview(null);
    showToast("Church logo removed.");
    router.refresh();
  }

  return (
    <section className="card-elevated mb-6 max-w-xl rounded-2xl p-5 sm:p-6" aria-labelledby="logo-heading">
      <h2 id="logo-heading" className="font-semibold">
        Church logo
      </h2>
      <p className="mt-1 text-sm text-ink/70">Shown at the top of the app for everyone in your church, and on posters. A square logo on a plain or transparent background looks best.</p>
      {error && (
        <Alert tone="error" className="mt-3">
          {error}
        </Alert>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-white">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from Supabase Storage
            <img src={preview} alt={`${churchName} logo`} className="h-full w-full object-contain p-1.5" />
          ) : (
            <span aria-hidden className="font-display text-2xl font-semibold text-ink/40">
              {initials(churchName)}
            </span>
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onPick} aria-label="Choose a logo image" />
          <button type="button" className="btn-primary" disabled={busy !== null} onClick={() => inputRef.current?.click()}>
            <ImagePlus aria-hidden className="h-4 w-4" /> {busy === "uploading" ? "Uploading…" : preview ? "Change logo" : "Upload logo"}
          </button>
          {preview && (
            <button type="button" className="btn-ghost text-danger" disabled={busy !== null} onClick={onRemove}>
              <Trash2 aria-hidden className="h-4 w-4" /> {busy === "removing" ? "Removing…" : "Remove"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
