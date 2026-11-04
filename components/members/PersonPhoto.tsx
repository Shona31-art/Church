"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { toSquareImage, type SquareCrop } from "@/lib/image-resize";
import { AVATAR_MAX_SOURCE_BYTES, AVATAR_SIZE } from "@/lib/avatar-path";
import { PhotoCropper } from "@/components/ui/PhotoCropper";
import { Avatar } from "@/components/ui/Avatar";
import { showToast } from "@/components/ui/Toaster";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { setPersonPhoto } from "@/app/dashboard/members/photo-actions";

/**
 * A photo for someone who doesn't sign in themselves — a record-only member or
 * a child. Pick, move and zoom, save; used on their birthday poster too.
 */
export function PersonPhoto({
  kind,
  id,
  name,
  photoUrl,
  size = "lg",
  compact = false,
}: {
  kind: "member" | "child";
  id: string;
  name: string;
  photoUrl: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  /** Just the photo with a small camera button (for lists). */
  compact?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(photoUrl);
  const [picked, setPicked] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return showToast("Choose a photo (JPG, PNG, WebP or HEIC).", "error");
    if (file.size > AVATAR_MAX_SOURCE_BYTES) return showToast("That photo is over 10 MB — choose a smaller one.", "error");
    setPicked(file);
  }

  async function send(photo: Blob | null) {
    setBusy(true);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("id", id);
    if (photo) fd.set("photo", photo, "photo");
    else fd.set("remove", "1");
    const result = await callAction(() => setPersonPhoto(fd), { error: CONNECTION_FAILED });
    setBusy(false);
    if (result.error) return showToast(result.error, "error");
    setPreview(photo ? URL.createObjectURL(photo) : null);
    setPicked(null);
    showToast(photo ? `Photo saved for ${name}.` : "Photo removed.");
    router.refresh();
  }

  async function save(file: File, crop: SquareCrop) {
    try {
      const { blob } = await toSquareImage(file, AVATAR_SIZE, crop);
      await send(blob);
    } catch {
      showToast("We couldn't read that photo. Try a JPG or PNG.", "error");
    }
  }

  return (
    <>
      {picked && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-4 shadow-xl">
            <p className="mb-3 font-semibold">Photo for {name}</p>
            <PhotoCropper file={picked} busy={busy} onDone={(crop) => void save(picked, crop)} onCancel={() => setPicked(null)} />
          </div>
        </div>
      )}
      {compact ? (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="relative shrink-0" aria-label={preview ? `Change ${name}'s photo` : `Add a photo of ${name}`}>
          <Avatar name={name} src={preview} size={size} />
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-surface bg-ember text-on-ember">
            <Camera aria-hidden className="h-3 w-3" />
          </span>
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={name} src={preview} size={size} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
              <Camera aria-hidden className="h-4 w-4" />
              {busy ? "Saving…" : preview ? "Change photo" : "Add a photo"}
            </button>
            {preview && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => void send(null)} disabled={busy}>
                <Trash2 aria-hidden className="h-4 w-4" /> Remove
              </button>
            )}
          </div>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={onPick} />
    </>
  );
}
