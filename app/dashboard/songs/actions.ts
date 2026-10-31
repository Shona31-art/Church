"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { flash } from "@/lib/flash";
import { logAudit } from "@/lib/audit";
import { FormState, SESSION_EXPIRED, formValues } from "@/lib/forms";
import { MAX_IMPORT_SONGS, parseSongList, songSchema } from "@/lib/songs";
import { songAccess } from "./access";

// Pastors, church admins and the worship team manage songs; the database
// (supabase/songs.sql) enforces the same rules.

const NO_ACCESS = "Only pastors, church admins and the worship team can change songs.";
const DUPLICATE = "A song with this title is already in your list.";

function parseSong(formData: FormData) {
  return songSchema.safeParse({
    title: formData.get("title") ?? "",
    author: String(formData.get("author") ?? "").trim() || undefined,
    songKey: String(formData.get("song_key") ?? "").trim() || undefined,
    lyrics: formData.get("lyrics") ?? "",
  });
}

function refresh(id?: string) {
  revalidatePath("/dashboard/songs");
  if (id) revalidatePath(`/dashboard/songs/${id}`);
}

/** Form fields: title, author?, song_key?, lyrics */
export async function createSong(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await songAccess();
  if (!access) return { error: SESSION_EXPIRED, values: formValues(formData) };
  if (!access.canManage) return { error: NO_ACCESS };
  const parsed = parseSong(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values: formValues(formData) };

  const { data, error } = await createClient()
    .from("songs")
    .insert({
      church_id: access.me.church_id,
      title: parsed.data.title,
      author: parsed.data.author ?? null,
      song_key: parsed.data.songKey ?? null,
      lyrics: parsed.data.lyrics,
      created_by: access.me.id,
      updated_by: access.me.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code !== "23505") console.error("[songs] add failed:", error?.message);
    return { error: error?.code === "23505" ? DUPLICATE : "Couldn't save the song — please try again.", values: formValues(formData) };
  }
  refresh();
  flash("Song added.");
  redirect(`/dashboard/songs/${data.id}`);
}

/** Form fields: id, title, author?, song_key?, lyrics */
export async function updateSong(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await songAccess();
  if (!access) return { error: SESSION_EXPIRED, values: formValues(formData) };
  if (!access.canManage) return { error: NO_ACCESS };
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "That song couldn't be found." };
  const parsed = parseSong(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values: formValues(formData) };

  const { data, error } = await createClient()
    .from("songs")
    .update({ title: parsed.data.title, author: parsed.data.author ?? null, song_key: parsed.data.songKey ?? null, lyrics: parsed.data.lyrics, updated_by: access.me.id })
    .eq("id", id.data)
    .eq("church_id", access.me.church_id)
    .select("id");
  if (error || !data?.length) {
    if (error && error.code !== "23505") console.error("[songs] update failed:", error.message);
    return { error: error?.code === "23505" ? DUPLICATE : "Couldn't save your changes — please try again.", values: formValues(formData) };
  }
  refresh(id.data);
  flash("Song updated.");
  redirect(`/dashboard/songs/${id.data}`);
}

/** Form fields: id */
export async function deleteSong(formData: FormData): Promise<void> {
  const access = await songAccess();
  if (!access) return flash(SESSION_EXPIRED, "error");
  if (!access.canManage) return flash(NO_ACCESS, "error");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return flash("That song couldn't be found.", "error");
  const { data, error } = await createClient().from("songs").delete().eq("id", id.data).eq("church_id", access.me.church_id).select("title");
  if (error || !data?.length) {
    if (error) console.error("[songs] delete failed:", error.message);
    return flash("Couldn't delete that song — it may already be gone.", "error");
  }
  refresh();
  flash(`“${data[0].title}” deleted.`);
  redirect("/dashboard/songs");
}

/** Form fields: songs (the pasted list — see parseSongList). Skips titles already in the list. */
export async function importSongs(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await songAccess();
  if (!access) return { error: SESSION_EXPIRED, values: formValues(formData) };
  if (!access.canManage) return { error: NO_ACCESS };
  const list = parseSongList(String(formData.get("songs") ?? ""));
  if (!list.length) return { error: "Paste at least one song: the title on the first line, then the lyrics.", values: formValues(formData) };
  if (list.length > MAX_IMPORT_SONGS) return { error: `That's ${list.length} songs — import up to ${MAX_IMPORT_SONGS} at a time.`, values: formValues(formData) };

  const bad = list.map((s, i) => ({ i, r: songSchema.safeParse(s) })).find((x) => !x.r.success);
  if (bad && !bad.r.success) return { error: `Song ${bad.i + 1} (“${list[bad.i].title.slice(0, 40)}”): ${bad.r.error.issues[0]?.message}`, values: formValues(formData) };

  const supabase = createClient();
  const { data: existing } = await supabase.from("songs").select("title").eq("church_id", access.me.church_id);
  const seen = new Set((existing ?? []).map((s) => s.title.trim().toLowerCase()));
  const rows = [];
  let skipped = 0;
  for (const song of list) {
    const key = song.title.trim().toLowerCase();
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    rows.push({
      church_id: access.me.church_id,
      title: song.title.trim(),
      author: song.author ?? null,
      song_key: song.songKey ?? null,
      lyrics: song.lyrics,
      created_by: access.me.id,
      updated_by: access.me.id,
    });
  }
  if (rows.length) {
    const { error } = await supabase.from("songs").insert(rows);
    if (error) {
      console.error("[songs] import failed:", error.message);
      return { error: "Couldn't import the songs — nothing was added. Please try again.", values: formValues(formData) };
    }
  }
  await logAudit({ churchId: access.me.church_id, actorId: access.me.id, action: "songs.imported", targetTable: "songs", metadata: { added: rows.length, skipped } });
  refresh();
  flash(`${rows.length} ${rows.length === 1 ? "song" : "songs"} added${skipped ? `, ${skipped} skipped (already in your list)` : ""}.`);
  redirect("/dashboard/songs");
}

/** Pastors and church admins: which department is the worship team. Form fields: department_id ("" for none). */
export async function setWorshipTeam(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await songAccess();
  if (!access) return { error: SESSION_EXPIRED };
  if (!["pastor", "church_admin"].includes(access.me.role)) return { error: "Only pastors and church admins choose the worship team." };
  const raw = String(formData.get("department_id") ?? "");
  const dept = raw ? z.string().uuid().safeParse(raw) : null;
  if (dept && !dept.success) return { error: "That department couldn't be found." };

  const supabase = createClient();
  if (dept?.success) {
    const { data } = await supabase.from("departments").select("id").eq("id", dept.data).eq("church_id", access.me.church_id).maybeSingle();
    if (!data) return { error: "That department couldn't be found." };
  }
  const { error } = await supabase
    .from("church_song_settings")
    .upsert({ church_id: access.me.church_id, worship_department_id: dept?.success ? dept.data : null, updated_at: new Date().toISOString() }, { onConflict: "church_id" });
  if (error) {
    console.error("[songs] worship team save failed:", error.message);
    return { error: "Couldn't save that — please try again." };
  }
  refresh();
  return { ok: true };
}
