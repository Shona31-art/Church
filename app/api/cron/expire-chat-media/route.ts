import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHAT_MEDIA_BUCKET, mediaExpiryCutoff } from "@/lib/chat";
import { endCancelledSubscriptions } from "@/lib/subscription-billing";
import { announceDueChallenges } from "@/lib/games/challenge-server";

/**
 * GET /api/cron/expire-chat-media — nightly clean-up, called by Vercel Cron
 * (schedule in vercel.json).
 *
 * Deletes voice notes (and chat photos) older than 90 days from Storage and
 * marks their messages "expired", so the chat shows "Voice note expired".
 * Keeps storage — and cost — flat as a church's chat history grows.
 *
 * Also deletes bell notifications older than 90 days
 * (the notifications page promises 90), and ends church subscriptions that
 * were cancelled once the month they paid for is over (online billing).
 * Kept in this one job because Vercel's
 * free plan allows only daily cron jobs; a failure there is logged and never
 * blocks the media clean-up.
 *
 * Request:  header `Authorization: Bearer <CRON_SECRET>` (Vercel adds it).
 * Response: 200 { expired: number, notificationsDeleted: number, subscriptionsEnded: number } · 401 bad/missing secret ·
 *           500 { error } (files that couldn't be deleted are left as they
 *           are and retried the next night).
 */

// Each run stops starting new batches after this long, well inside Vercel's
// function time limit; anything left over is picked up the next night.
export const maxDuration = 60;
const TIME_BUDGET_MS = 45_000;
const BATCH = 200;
const NOTIFICATION_RETENTION_DAYS = 90;

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

  // Disappearing messages (chat_v4.sql): delete those whose time is up, then
  // their voice notes and photos. They're already hidden from everyone; this
  // removes them for good. Best effort: a failure is retried the next night.
  let disappeared = 0;
  try {
    for (let round = 0; round < 10; round++) {
      const { data: files, error } = await admin.rpc("purge_expired_chat_messages", { batch: 500 });
      if (error) {
        if (!/function|does not exist/i.test(error.message)) console.error("[cron] disappearing messages failed:", error.message);
        break;
      }
      const paths = ((files ?? []) as { media_path: string }[]).map((f) => f.media_path).filter(Boolean);
      if (paths.length) {
        const { error: removeError } = await admin.storage.from(CHAT_MEDIA_BUCKET).remove(paths);
        if (removeError) console.error("[cron] removing disappeared files failed:", removeError.message);
      }
      disappeared += paths.length;
      if (!files || (files as unknown[]).length < 500) break;
    }
  } catch (error) {
    console.error("[cron] disappearing messages failed:", error);
  }

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

  let notificationsDeleted = 0;
  const notificationCutoff = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 86_400_000).toISOString();
  const { error: notifyError, count } = await admin.from("notifications").delete({ count: "exact" }).lt("created_at", notificationCutoff);
  if (notifyError) console.error("[cron] delete old notifications failed (retries tomorrow):", notifyError.message);
  else notificationsDeleted = count ?? 0;

  let subscriptionsEnded = 0;
  try {
    subscriptionsEnded = await endCancelledSubscriptions();
  } catch (error) {
    console.error("[cron] end cancelled subscriptions failed (retries tomorrow):", (error as Error).message);
  }

  // Church challenges that closed without anyone opening them since: send the results.
  let challengesAnnounced = 0;
  try {
    challengesAnnounced = await announceDueChallenges();
  } catch (error) {
    console.error("[cron] church challenge results failed (retries tomorrow):", (error as Error).message);
  }

  return NextResponse.json({ expired, notificationsDeleted, subscriptionsEnded, disappearedFiles: disappeared, challengesAnnounced });
}
