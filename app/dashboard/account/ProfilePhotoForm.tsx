"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import { Camera, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_BUCKET, AVATAR_MAX_SOURCE_BYTES, AVATAR_SIZE, avatarPath } from "@/lib/avatar-path";
import { toSquareImage, type SquareCrop } from "@/lib/image-resize";
import { PhotoCropper } from "@/components/ui/PhotoCropper";
import { Avatar } from "@/components/ui/Avatar";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { showToast } from "@/components/ui/Toaster";
import { removeMyPhoto, setMyPhoto, updateMyAbout } from "./actions";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";

/**
 * Profile photo: pick → shrink to a 512px square in the browser → upload to
 * the private `avatars` bucket → tell the server to use it. The original
 * photo never leaves the device.
 */
export function ProfilePhotoForm({
  churchId,
  userId,
  name,
  photoUrl,
  about,
}: {
  churchId: string;
  userId: string;
  name: string;
  photoUrl: string | null;
  about: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl);
  const [busy, setBusy] = useState<"uploading" | "removing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<File | null>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // picking the same file again should still trigger
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) return setError("Choose a photo (JPG, PNG, WebP or HEIC).");
    if (file.size > AVATAR_MAX_SOURCE_BYTES) return setError("That photo is over 10 MB — choose a smaller one.");
    setPicked(file); // move and zoom it first (PhotoCropper), then save
  }

  async function save(file: File, crop: SquareCrop) {
    setBusy("uploading");
    try {
      const { blob, extension } = await toSquareImage(file, AVATAR_SIZE, crop);
      const path = avatarPath(churchId, userId, crypto.randomUUID(), extension);
      const { error: uploadError } = await createClient().storage.from(AVATAR_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
      if (uploadError) {
        console.error("[photo] upload failed:", uploadError.message);
        setError(/jwt|auth/i.test(uploadError.message) ? "Your session has expired — sign in again." : "Couldn't upload your photo — check your connection and try again.");
        return;
      }
      const result = await setMyPhoto(path);
      if (result.error) return setError(result.error);
      setPreview(URL.createObjectURL(blob));
      setPicked(null);
      showToast("Profile photo updated.");
      router.refresh();
    } catch {
      setError("We couldn't read that photo. Try a JPG or PNG.");
    } finally {
      setBusy(null);
    }
  }

  async function onRemove() {
    setBusy("removing");
    setError(null);
    const result = await callAction(() => removeMyPhoto(), { error: CONNECTION_FAILED });
    setBusy(null);
    if (result.error) return setError(result.error);
    setPreview(null);
    showToast("Profile photo removed.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && <Alert tone="error">{error}</Alert>}
      {picked && <PhotoCropper file={picked} busy={busy === "uploading"} onDone={(crop) => void save(picked, crop)} onCancel={() => setPicked(null)} />}
      <div className={`flex flex-wrap items-center gap-5 ${picked ? "hidden" : ""}`}>
        <Avatar name={name} src={preview} size="xl" label={preview ? "Your profile photo" : "No profile photo yet"} />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()} disabled={busy !== null}>
              <Camera aria-hidden className="h-4 w-4" />
              {busy === "uploading" ? "Uploading…" : preview ? "Change photo" : "Add a photo"}
            </button>
            {preview && (
              <button type="button" className="btn-ghost" onClick={onRemove} disabled={busy !== null}>
                <Trash2 aria-hidden className="h-4 w-4" />
                {busy === "removing" ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
          <p className="hint mt-0">Shown to people in your church only. You can move and zoom it before it’s saved.</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={onPick} />
      </div>
      <AboutForm about={about} />
    </div>
  );
}

function AboutForm({ about }: { about: string | null }) {
  const [state, action] = useFormState(updateMyAbout, null);
  const [length, setLength] = useState(about?.length ?? 0);
  return (
    <form action={action} className="space-y-3" noValidate>
      {state?.error && !state.fieldErrors && <Alert tone="error">{state.error}</Alert>}
      <FormField label="About" htmlFor="about" optional error={state?.fieldErrors?.about} hint={`A line people see on your profile and in chats, e.g. "Worship team · Alto". ${length}/140`}>
        <input
          id="about"
          name="about"
          maxLength={140}
          defaultValue={about ?? ""}
          onChange={(e) => setLength(e.target.value.length)}
          className="input"
          aria-invalid={Boolean(state?.fieldErrors?.about)}
        />
      </FormField>
      <PendingButton className="btn-secondary">Save</PendingButton>
    </form>
  );
}
