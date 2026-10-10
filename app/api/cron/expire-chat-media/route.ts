import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHAT_MEDIA_BUCKET, mediaExpiryCutoff } from "@/lib/chat";

/**
 * GET /api/cron/expire-chat-media — nightly clean-up, called by Vercel Cron
 * (schedule in vercel.json).
 *
 * Deletes voice notes (and chat photos) older than 90 days from Storage and
 * marks their messages "expired", so the chat shows "Voice note expired".
 * Keeps storage — and cost — flat as a church's chat history grows.
 *
 * Request:  header `Authorization: Bearer <CRON_SECRET>` (Vercel adds it).
 * Response: 200 { expired: number } · 401 bad/missing secret ·
 *           500 { error } (files that couldn't be deleted are left as they
 *           are and retried the next night).
 */

// Each run stops starting new batches after this long, well inside Vercel's
// function time limit; anything left over is picked up the next night.
export const maxDuration = 60;
const TIME_BUDGET_MS = 45_000;
const BATCH = 200;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never run unauthenticated because a variable is missing
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const admin = createAdminClient();
  const cutoff = mediaExpiryCutoff().toISOString();
  const started = Date.now();
  let expired = 0;

  try {
    while (Date.now() - started < TIME_BUDGET_MS) {
      const { data: due, error } = await admin
        .from("chat_messages")
        .select("id, media_path")
        .not("media_path", "is", null)
        .is("media_expired_at", null)
        .lt("created_at", cutoff)
        .order("created_at")
        .limit(BATCH);
      if (error) throw new Error(`find due files: ${error.message}`);
      if (!due?.length) break;

      // Files first: if this fails, the messages still point at their files
      // and the next run tries again. (Already-missing files aren't an error.)
      const { error: removeError } = await admin.storage.from(CHAT_MEDIA_BUCKET).remove(due.map((m) => m.media_path as string));
      if (removeError) throw new Error(`remove files: ${removeError.message}`);

      const { error: updateError } = await admin
        .from("chat_messages")
        .update({ media_path: null, media_expired_at: new Date().toISOString() })
        .in(
          "id",
          due.map((m) => m.id)
        );
      if (updateError) throw new Error(`mark expired: ${updateError.message}`);

      expired += due.length;
      if (due.length < BATCH) break;
    }
  } catch (error) {
    console.error("[cron] expire-chat-media failed after", expired, "files:", (error as Error).message);
    return NextResponse.json({ error: "Clean-up failed; it will retry on the next run.", expired }, { status: 500 });
  }

  if (expired) console.info(`[cron] expire-chat-media: ${expired} file(s) expired`);
  return NextResponse.json({ expired });
}
