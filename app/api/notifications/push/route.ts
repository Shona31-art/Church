import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pushConfigured, sendPushToUser } from "@/lib/push";
import { CATEGORIES } from "@/lib/notifications";
import { deliverAlert, makeConfigured } from "@/lib/alert-delivery";

/**
 * POST /api/notifications/push — called by a Supabase Database Webhook each
 * time a row is INSERTED into `notifications` (set-up steps in the README).
 * Sends that notification as a phone pop-up to the person's devices, and —
 * for pastor & admin alerts — by WhatsApp through Make.com (lib/alert-delivery.ts).
 *
 * Grouped chat/prayer items count up with UPDATEs, which the webhook doesn't
 * send — so a busy chat pops up once, not once per message, until it's read.
 *
 * Request:  header `x-webhook-secret: <NOTIFICATIONS_WEBHOOK_SECRET>`;
 *           body = Supabase webhook payload { type: "INSERT", table: "notifications", record: {...} }
 * Response: 200 { sent: number } · 401 bad/missing secret · 400 not a
 *           notifications insert · 503 push not configured on this server
 */

const Payload = z.object({
  type: z.literal("INSERT"),
  table: z.literal("notifications"),
  record: z.object({
    user_id: z.string().uuid(),
    category: z.enum(CATEGORIES),
    title: z.string().max(120),
    body: z.string().max(300).nullable(),
    link: z.string().max(500).nullable(),
    group_key: z.string().max(200).nullable(),
  }),
});

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
  if (!parsed.success) return NextResponse.json({ error: "Expected a notifications INSERT payload." }, { status: 400 });

  const { record } = parsed.data;
  const [sent, delivered] = await Promise.all([
    pushConfigured()
      ? sendPushToUser(record.user_id, record.category, {
          title: record.title,
          body: record.body,
          link: record.link,
          tag: record.group_key ?? undefined,
        })
      : Promise.resolve(0),
    record.category === "alerts" && external
      ? deliverAlert(record.user_id, { title: record.title, body: record.body, link: record.link })
      : Promise.resolve({ sent: false }),
  ]);
  return NextResponse.json({ sent, alertSentToMake: delivered.sent });
}
