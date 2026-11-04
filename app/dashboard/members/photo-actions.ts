"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { AVATAR_BUCKET, AVATAR_SIZE } from "@/lib/avatar-path";
import { SESSION_EXPIRED } from "@/lib/forms";

// Photos for people who don't sign in themselves (record_members.sql): a
// record-only member (added by a pastor or church admin) or a child (added by
// a parent or a pastor). Used on their birthday poster and in the app.
// Members who use the app add their own photo in My account.

const MAX_BYTES = 2 * 1024 * 1024;
const input = z.object({ kind: z.enum(["member", "child"]), id: z.string().uuid(), remove: z.boolean() });

export async function setPersonPhoto(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const parsed = input.safeParse({ kind: formData.get("kind"), id: formData.get("id"), remove: formData.get("remove") === "1" });
  if (!parsed.success) return { error: "Something went wrong — please try again." };
  const { kind, id, remove } = parsed.data;
  const me = await getCurrentAppUser();
  if (!me?.church_id) return { error: SESSION_EXPIRED };

  // A small square photo, re-drawn here so nothing hidden in the file is kept.
  let webp: Buffer | null = null;
  if (!remove) {
    const file = formData.get("photo");
    if (!(file instanceof File) || !file.type.startsWith("image/")) return { error: "Choose a photo." };
    if (file.size > MAX_BYTES) return { error: "That photo is too big — try another." };
    try {
      webp = await sharp(Buffer.from(await file.arrayBuffer())).rotate().resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" }).webp({ quality: 85 }).toBuffer();
    } catch {
      return { error: "We couldn't read that photo. Try a JPG or PNG." };
    }
  }

  const admin = createAdminClient();
  const supabase = createClient();
  let oldPath: string | null = null;
  let newPath: string | null = null;

  if (kind === "member") {
    if (!can(me.role, "manageMembers")) return { error: "Only pastors and church admins can change someone's photo." };
    const { data: person } = await admin.from("app_users").select("id, church_id, email, avatar_path, record_only").eq("id", id).maybeSingle();
    const p = person as { church_id: string; email: string | null; avatar_path: string | null; record_only?: boolean } | null;
    if (!p || p.church_id !== me.church_id) return { error: "That member wasn't found." };
    if (!p.record_only && !p.email?.endsWith("@no-login.grace.app")) return { error: "Members who use the app add their own photo." };
    oldPath = p.avatar_path;
    newPath = webp ? `${me.church_id}/${id}/${crypto.randomUUID()}.webp` : null;
    if (webp && newPath) {
      const { error } = await admin.storage.from(AVATAR_BUCKET).upload(newPath, webp, { contentType: "image/webp" });
      if (error) return { error: "Couldn't upload the photo — please try again." };
    }
    const { error } = await admin.from("app_users").update({ avatar_path: newPath }).eq("id", id);
    if (error) return { error: "Couldn't save the photo — please try again." };
    revalidatePath(`/dashboard/members/${id}`);
  } else {
    // RLS decides who may change a child: whoever added them, a linked parent, or a pastor.
    const { data: child, error: readErr } = await supabase.from("member_children").select("id, church_id, photo_path").eq("id", id).maybeSingle();
    if (readErr?.code === "42703") return { error: "Children's photos need a database update first — ask your church admin." };
    if (!child) return { error: "That child wasn't found." };
    oldPath = (child as { photo_path: string | null }).photo_path;
    newPath = webp ? `${child.church_id}/children/${id}/${crypto.randomUUID()}.webp` : null;
    const { data: updated, error } = await supabase.from("member_children").update({ photo_path: newPath }).eq("id", id).select("id");
    if (error || !updated?.length) return { error: "You can't change this child's photo." };
    if (webp && newPath) {
      const { error: upErr } = await admin.storage.from(AVATAR_BUCKET).upload(newPath, webp, { contentType: "image/webp" });
      if (upErr) {
        await supabase.from("member_children").update({ photo_path: oldPath }).eq("id", id);
        return { error: "Couldn't upload the photo — please try again." };
      }
    }
    revalidatePath("/dashboard/account");
    revalidatePath("/dashboard/members", "layout");
  }

  if (oldPath && oldPath !== newPath) await admin.storage.from(AVATAR_BUCKET).remove([oldPath]);
  return { ok: true };
}
