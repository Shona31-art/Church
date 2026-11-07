"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser, type AppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { flash } from "@/lib/flash";
import { can } from "@/lib/permissions";
import { generateJson, isAiConfigured } from "@/lib/ai";
import { consumeAiQuota } from "@/lib/ai-quota";
import { FormState, SESSION_EXPIRED, formValues, invalid, optionalField } from "@/lib/forms";

// Sermons: pastors and church admins publish; everyone in the church reads
// and keeps private notes (sermon_notes RLS: author only, no admin bypass).

// Only http(s) links are accepted — a "javascript:" URL in a media tag or
// link is a classic XSS vector.
const mediaUrl = z
  .string()
  .trim()
  .max(500, "That link is too long.")
  .url("Paste a full link starting with https://")
  .refine((u) => /^https?:\/\//i.test(u), "Links must start with https://")
  .optional();

const lines = (max: number) =>
  z
    .string()
    .max(5000)
    .optional()
    .transform((v) =>
      (v ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, max)
    );

const SermonSchema = z.object({
  title: z.string().trim().min(2, "Give the sermon a title.").max(200, "Keep the title under 200 characters."),
  speaker: z.string().trim().max(120).optional(),
  sermonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date it was preached."),
  audioUrl: mediaUrl,
  videoUrl: mediaUrl,
  transcript: z.string().max(100_000, "That transcript is very long — trim it to under 100,000 characters.").optional(),
  summary: z.string().trim().max(3000).optional(),
  scriptureRefs: lines(10),
  discussionQuestions: lines(10),
  prayerPoints: lines(10),
  useAi: z.boolean(),
});

async function requireSermonEditor(): Promise<AppUser | null> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id || !can(me.role, "manageSermons")) return null;
  return (await checkModuleAccess("sermon_ai")).allowed ? me : null;
}

interface SermonAnalysis {
  summary: string;
  scriptureRefs: string[];
  discussionQuestions: string[];
  prayerPoints: string[];
}

/**
 * AI summary, scripture references, discussion questions and prayer points
 * from a transcript. Returns null when AI is off, over quota, or fails — the
 * sermon still saves and the fields can be filled in by hand.
 * The transcript is capped at ~30k characters to keep each call's cost bounded.
 */
async function analyseTranscript(transcript: string, context: { title?: string; speaker?: string; scripture?: string; summary?: string } = {}): Promise<SermonAnalysis | null> {
  const about = [context.title && `Title: ${context.title}`, context.speaker && `Preacher: ${context.speaker}`, context.scripture && `Scripture: ${context.scripture}`, context.summary && `Notes: ${context.summary}`]
    .filter(Boolean)
    .join("\n");
  if ((!transcript.trim() && !about) || !isAiConfigured()) return null;
  if (!(await consumeAiQuota("sermon_analysis")).ok) return null;

  const source = transcript.trim()
    ? `Here is a sermon transcript:\n\n${transcript.slice(0, 30_000)}${about ? `\n\nAbout the sermon:\n${about}` : ""}`
    : `There is no transcript. Write small-group study notes for a Christian sermon from what we know about it:\n\n${about.slice(0, 3000)}\n\nStay faithful to the scripture given; don't invent stories or quotes from the preacher.`;
  const parsed = await generateJson<Partial<SermonAnalysis>>({
    maxTokens: 1500,
    prompt: `${source}

Respond with ONLY valid JSON, no other text, in this exact shape:
{"summary": "2-3 sentence summary", "scriptureRefs": ["Book Chapter:Verse", ...up to 5], "discussionQuestions": ["...", ...3-5 questions for small groups], "prayerPoints": ["...", ...3-5 short prayer points]}

For scriptureRefs, give references only (e.g. "Romans 8:28"), never the verse text itself.`,
  });
  if (!parsed) return null;
  const strings = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((s) => s.slice(0, 300)).slice(0, max) : []);
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 3000) : "",
    scriptureRefs: strings(parsed.scriptureRefs, 10),
    discussionQuestions: strings(parsed.discussionQuestions, 10),
    prayerPoints: strings(parsed.prayerPoints, 10),
  };
}

/**
 * Create or edit. Form fields: sermon_id? + updated_at? (edit), title,
 * speaker?, sermon_date, audio_url?, video_url?, transcript?, summary?,
 * scripture_refs?, discussion_questions?, prayer_points? (one per line),
 * use_ai ("on" = generate the study fields from the transcript).
 */
/**
 * "Write with AI" on the sermon form: drafts the summary, scriptures,
 * discussion questions and prayer points for the pastor to check before
 * saving. Uses the transcript when there is one, otherwise the title,
 * preacher and scriptures.
 */
export async function draftSermonStudyNotes(input: { title: string; speaker: string; transcript: string; scripture: string; summary: string }): Promise<{ error?: string; notes?: SermonAnalysis }> {
  const me = await requireSermonEditor();
  if (!me) return { error: "Only pastors and church admins can do this. Sign in again." };
  if (!isAiConfigured()) return { error: "AI isn't switched on for this app yet." };
  if (!(await checkModuleAccess("ai_assist")).allowed) return { error: "AI help isn't included in your church's plan." };
  const transcript = String(input.transcript ?? "").slice(0, 100_000);
  const title = String(input.title ?? "").trim().slice(0, 200);
  if (!transcript.trim() && !title) return { error: "Type the sermon title (and the scripture if you have it), or paste the transcript, then try again." };
  const notes = await analyseTranscript(transcript, {
    title,
    speaker: String(input.speaker ?? "").slice(0, 120),
    scripture: String(input.scripture ?? "").slice(0, 500),
    summary: transcript.trim() ? "" : String(input.summary ?? "").slice(0, 2000),
  });
  if (!notes) return { error: "The AI couldn't write these right now (or this month's AI allowance is used up). Try again in a minute, or fill them in by hand." };
  return { notes };
}

export async function saveSermon(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSermonEditor();
  if (!me) return { error: "Only pastors and church admins can publish sermons. If you are one, sign in again." };

  const parsed = SermonSchema.safeParse({
    title: formData.get("title"),
    speaker: optionalField(formData, "speaker"),
    sermonDate: formData.get("sermon_date"),
    audioUrl: optionalField(formData, "audio_url"),
    videoUrl: optionalField(formData, "video_url"),
    transcript: optionalField(formData, "transcript"),
    summary: optionalField(formData, "summary"),
    scriptureRefs: formData.get("scripture_refs") ?? "",
    discussionQuestions: formData.get("discussion_questions") ?? "",
    prayerPoints: formData.get("prayer_points") ?? "",
    useAi: formData.get("use_ai") === "on",
  });
  if (!parsed.success) {
    const result = invalid(parsed.error, formData);
    const map: Record<string, string> = { sermonDate: "sermon_date", audioUrl: "audio_url", videoUrl: "video_url" };
    if (result?.fieldErrors) result.fieldErrors = Object.fromEntries(Object.entries(result.fieldErrors).map(([k, v]) => [map[k] ?? k, v]));
    return result;
  }
  const input = parsed.data;
  const values = formValues(formData);

  const ai = input.useAi && input.transcript ? await analyseTranscript(input.transcript) : null;
  const aiFailed = input.useAi && Boolean(input.transcript) && !ai;

  const row = {
    title: input.title,
    speaker: input.speaker ?? null,
    sermon_date: input.sermonDate,
    audio_url: input.audioUrl ?? null,
    video_url: input.videoUrl ?? null,
    transcript: input.transcript ?? null,
    // AI output fills the study fields; otherwise keep what the pastor typed.
    ai_summary: ai?.summary || input.summary || null,
    scripture_refs: ai?.scriptureRefs.length ? ai.scriptureRefs : input.scriptureRefs,
    discussion_questions: ai?.discussionQuestions.length ? ai.discussionQuestions : input.discussionQuestions,
    prayer_points: ai?.prayerPoints.length ? ai.prayerPoints : input.prayerPoints,
  };

  const supabase = createClient();
  const existingId = formData.get("sermon_id");
  let id: string;

  if (existingId) {
    const parsedId = z.string().uuid().safeParse(existingId);
    const updatedAt = String(formData.get("updated_at") ?? "");
    if (!parsedId.success || !updatedAt) return { error: "That sermon couldn't be found.", values };
    const { data: before } = await supabase.from("sermons").select("audio_url, video_url").eq("id", parsedId.data).eq("church_id", me.church_id).maybeSingle();
    const { data: updated, error } = await supabase
      .from("sermons")
      .update(row)
      .eq("id", parsedId.data)
      .eq("church_id", me.church_id)
      .eq("updated_at", updatedAt)
      .select("id");
    if (error) {
      console.error("[sermons] update failed:", error.message);
      return { error: "Couldn't save the sermon — please try again.", values };
    }
    if (!updated?.length) return { error: "Someone else changed this sermon while you were editing. Reload to see the latest.", values };
    id = parsedId.data;
    // A recording that was replaced or removed is deleted from storage.
    await removeUploads({
      audio: before?.audio_url !== row.audio_url ? before?.audio_url : null,
      video: before?.video_url !== row.video_url ? before?.video_url : null,
    });
  } else {
    const { data: created, error } = await supabase
      .from("sermons")
      .insert({ ...row, church_id: me.church_id, created_by: me.id })
      .select("id")
      .single();
    if (error || !created) {
      console.error("[sermons] create failed:", error?.message);
      return { error: "Couldn't save the sermon — please try again.", values };
    }
    id = created.id;
  }

  revalidatePath("/dashboard/sermons");
  revalidatePath(`/dashboard/sermons/${id}`);
  flash(
    aiFailed ? "Sermon saved. The AI summary couldn't be generated right now — you can add study notes by hand or try again." : existingId ? "Sermon updated." : "Sermon published.",
    aiFailed ? "info" : "success"
  );
  redirect(`/dashboard/sermons/${id}`);
}

/** Form fields: sermon_id */
const AUDIO_BUCKET = "sermon-audio";
const AUDIO_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/opus": "opus",
};
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

/**
 * A one-time upload link for a sermon recording, after checking who's asking.
 * The browser uploads the file straight to storage (no size limit from the app
 * server) and puts the returned public link in the sermon's Audio field.
 */
export async function requestSermonAudioUpload(input: { contentType: string; bytes: number }): Promise<{ ok: true; path: string; token: string; url: string } | { ok: false; error: string }> {
  const me = await requireSermonEditor();
  if (!me) return { ok: false, error: "Only people who can add sermons can upload recordings." };
  if (!(await checkModuleAccess("sermon_uploads")).allowed) return { ok: false, error: "Uploading recordings is on Grace Plus. Paste a link instead (SoundCloud, YouTube, Google Drive)." };
  const ext = AUDIO_TYPES[(input.contentType || "").toLowerCase()];
  if (!ext) return { ok: false, error: "That file type can't be played in a browser. Use MP3, M4A, WAV, AAC or OGG." };
  if (!Number.isFinite(input.bytes) || input.bytes <= 0) return { ok: false, error: "That file looks empty." };
  if (input.bytes > MAX_AUDIO_BYTES) return { ok: false, error: "That recording is over 50 MB. Save it as MP3 or M4A (smaller), or split it in two." };
  const path = `${me.church_id}/${crypto.randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(AUDIO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[sermons] audio upload link failed:", error?.message);
    return { ok: false, error: /not.*found/i.test(error?.message ?? "") ? "Audio uploads need a database update: run supabase/sermon_audio.sql." : "Couldn't start the upload — please try again." };
  }
  return { ok: true, path, token: data.token, url: admin.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl };
}

const VIDEO_BUCKET = "sermon-video";
const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/webm": "webm",
};
const MAX_VIDEO_MB = 1024; // keep in step with VideoField.tsx and sermon_video.sql

/**
 * A one-time upload link for a sermon video, after checking who's asking.
 * Like audio: the browser sends the file straight to storage (never through
 * the app server) and puts the returned public link in the sermon's Video field.
 */
export async function requestSermonVideoUpload(input: { contentType: string; bytes: number }): Promise<{ ok: true; uploadUrl: string; url: string } | { ok: false; error: string }> {
  const me = await requireSermonEditor();
  if (!me) return { ok: false, error: "Only people who can add sermons can upload videos." };
  if (!(await checkModuleAccess("sermon_uploads")).allowed) return { ok: false, error: "Uploading videos is on Grace Plus. Paste a YouTube or Facebook link instead." };
  const ext = VIDEO_TYPES[(input.contentType || "").toLowerCase()];
  if (!ext) return { ok: false, error: "That video type isn't supported. Use MP4 (best), MOV, M4V or WebM." };
  if (!Number.isFinite(input.bytes) || input.bytes <= 0) return { ok: false, error: "That file looks empty." };
  if (input.bytes > MAX_VIDEO_MB * 1024 * 1024) return { ok: false, error: `That video is over ${MAX_VIDEO_MB / 1024} GB. Export it at a lower quality (720p is plenty), or post it on YouTube and paste the link.` };
  const path = `${me.church_id}/${crypto.randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(VIDEO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[sermons] video upload link failed:", error?.message);
    return { ok: false, error: /not.*found/i.test(error?.message ?? "") ? "Video uploads need a database update: run supabase/sermon_video.sql." : "Couldn't start the upload — please try again." };
  }
  return { ok: true, uploadUrl: data.signedUrl, url: admin.storage.from(VIDEO_BUCKET).getPublicUrl(path).data.publicUrl };
}

/** The storage path of a file we host, from its public link (null for outside links like YouTube). */
function uploadedPath(url: string | null | undefined, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  return url?.includes(marker) ? url.split(marker)[1].split("?")[0] : null;
}

/** Removes our copies of recordings no longer used (best-effort: a failure leaves a stray file, never breaks a save). */
async function removeUploads(urls: { audio?: string | null; video?: string | null }) {
  const admin = createAdminClient();
  const audio = uploadedPath(urls.audio, AUDIO_BUCKET);
  const video = uploadedPath(urls.video, VIDEO_BUCKET);
  const results = await Promise.all([
    audio ? admin.storage.from(AUDIO_BUCKET).remove([audio]) : null,
    video ? admin.storage.from(VIDEO_BUCKET).remove([video]) : null,
  ]);
  for (const r of results) if (r?.error) console.error("[sermons] removing an old recording failed:", r.error.message);
}

export async function deleteSermon(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSermonEditor();
  if (!me) return { error: SESSION_EXPIRED };
  const id = z.string().uuid().safeParse(formData.get("sermon_id"));
  if (!id.success) return { error: "That sermon couldn't be found." };

  const { data: deleted, error } = await createClient().from("sermons").delete().eq("id", id.data).eq("church_id", me.church_id).select("id, audio_url, video_url");
  if (error || !deleted?.length) {
    if (error) console.error("[sermons] delete failed:", error.message);
    return { error: "Couldn't delete the sermon — please try again." };
  }
  // Uploaded recordings go with the sermon.
  await removeUploads({ audio: deleted[0].audio_url, video: deleted[0].video_url });
  revalidatePath("/dashboard/sermons");
  flash("Sermon deleted.");
  redirect("/dashboard/sermons");
}

/** Anyone in the church, on their own notes. Form fields: sermon_id, note */
export async function addSermonNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return { error: SESSION_EXPIRED };
  const parsed = z
    .object({ sermonId: z.string().uuid(), note: z.string().trim().min(1, "Write a note first.").max(5000, "Keep notes under 5,000 characters.") })
    .safeParse({ sermonId: formData.get("sermon_id"), note: formData.get("note") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values: formValues(formData) };

  const supabase = createClient();
  // Make sure the sermon is one this person can see (their church).
  const { data: sermon } = await supabase.from("sermons").select("id").eq("id", parsed.data.sermonId).eq("church_id", me.church_id).maybeSingle();
  if (!sermon) return { error: "That sermon couldn't be found." };

  const { error } = await supabase.from("sermon_notes").insert({ sermon_id: parsed.data.sermonId, user_id: me.id, note: parsed.data.note });
  if (error) {
    console.error("[sermons] note failed:", error.message);
    return { error: "Couldn't save your note — please try again.", values: formValues(formData) };
  }
  revalidatePath(`/dashboard/sermons/${parsed.data.sermonId}`);
  return { ok: true };
}

/** Form fields: note_id, sermon_id */
export async function deleteSermonNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me) return { error: SESSION_EXPIRED };
  const id = z.string().uuid().safeParse(formData.get("note_id"));
  const sermonId = z.string().uuid().safeParse(formData.get("sermon_id"));
  if (!id.success || !sermonId.success) return { error: "That note couldn't be found." };
  const { data: deleted, error } = await createClient().from("sermon_notes").delete().eq("id", id.data).eq("user_id", me.id).select("id");
  if (error) console.error("[sermons] note delete failed:", error.message);
  if (error || !deleted?.length) return { error: "Couldn't delete the note. It may already be gone — refresh and try again." };
  revalidatePath(`/dashboard/sermons/${sermonId.data}`);
  return { ok: true };
}
