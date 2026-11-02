import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pushConfigured, sendPushToUser, unreadCountFor } from "@/lib/push";
import { CATEGORIES } from "@/lib/notifications";
import { deliverAlert, makeConfigured } from "@/lib/alert-delivery";

/**
 * POST /api/notifications/push — called by a Supabase Database Webhook each
 * time a row is INSERTED into `notifications` (set-up steps in the README).
 * Sends that notification as a phone pop-up to the person's devices, and —
 * for pastor & admin alerts — by WhatsApp through Make.com (lib/alert-delivery.ts).
 *
 * Grouped chat/prayer items count up with UPDATEs. When the webhook sends
 * those too (README → "Notification pop-ups"), each new message updates the
 * chat's one pop-up, WhatsApp-style ("Alice (3 messages)" / latest text).
 * Other updates (marked read, a preview replaced) are ignored.
 *
 * Request:  header `x-webhook-secret: <NOTIFICATIONS_WEBHOOK_SECRET>`;
 *           body = Supabase webhook payload { type: "INSERT", table: "notifications", record: {...} }
 * Response: 200 { sent: number } · 401 bad/missing secret · 400 not a
 *           notifications insert · 503 push not configured on this server
 */

const Row = z.object({
  id: z.guid().optional(),
  user_id: z.string().uuid(),
  type: z.string().max(60).optional(),
  category: z.enum(CATEGORIES),
  title: z.string().max(120),
  body: z.string().max(300).nullable(),
  link: z.string().max(500).nullable(),
  group_key: z.string().max(200).nullable(),
  count: z.number().int().optional(),
  read_at: z.string().nullable().optional(),
});

const Payload = z.discriminatedUnion("type", [
  z.object({ type: z.literal("INSERT"), table: z.literal("notifications"), record: Row }),
  z.object({ type: z.literal("UPDATE"), table: z.literal("notifications"), record: Row, old_record: Row.partial() }),
]);

function authorized(request: Request): boolean {
  const secret = process.env.NOTIFICATIONS_WEBHOOK_SECRET;
  if (!secret) return false; // never accept calls because a variable is missing
  const given = Buffer.from(request.headers.get("x-webhook-secret") ?? "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const external = makeConfigured();
  if (!pushConfigured() && !external) return NextResponse.json({ error: "Push isn't configured on this server." }, { status: 503 });

  const parsed = Payload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Expected a notifications INSERT or UPDATE payload." }, { status: 400 });

  const { record } = parsed.data;
  if (parsed.data.type === "UPDATE") {
    // Only "another message arrived" (counted up, still unread) pops up again.
    const before = parsed.data.old_record.count ?? 0;
    if (record.read_at || !record.count || record.count <= before) return NextResponse.json({ sent: 0, skipped: true });
  }
  const isCall = record.type === "video_call";
  const isMessage = record.type === "chat.message";
  const [sent, delivered] = await Promise.all([
    pushConfigured()
      ? unreadCountFor(record.user_id).then((badge) =>
          sendPushToUser(record.user_id, record.category, {
          // "Alice (3 messages)", like WhatsApp, once more than one is waiting.
          title: isMessage && (record.count ?? 1) > 1 ? `${record.title} (${record.count} messages)` : record.title,
          body: record.body,
          link: record.link,
          tag: isCall ? `call:${record.link}` : record.group_key ?? undefined,
          // An incoming video call: rings on the phone (sw.js) and is only worth delivering for a minute.
          ...(isCall ? { call: true } : {}),
          ...(isMessage && record.id ? { messageId: record.id } : {}),
          ...(badge !== undefined ? { badge } : {}),
        }))
      : Promise.resolve(0),
    record.category === "alerts" && external && parsed.data.type === "INSERT"
      ? deliverAlert(record.user_id, { title: record.title, body: record.body, link: record.link })
      : Promise.resolve({ sent: false }),
  ]);
  return NextResponse.json({ sent, alertSentToMake: delivered.sent });
}
