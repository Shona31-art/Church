import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Pastor & admin alerts by WhatsApp, through a Make.com scenario that sends
 * the message. Called for every new
 * "alerts" notification — booking requests, counseling shared/flagged, new
 * prayer requests, new members — from app/api/notifications/push.
 *
 * Switched on by environment variables:
 *   MAKE_WEBHOOK_URL     the scenario's "Custom webhook" URL.
 *   MAKE_WEBHOOK_SECRET  optional; sent as X-Notify-Secret so the scenario can check it.
 *
 * One call per person per alert, only for people who have a phone number
 * and haven't switched WhatsApp alerts off.
 * Best-effort: failures are logged and never affect the app.
 */

const TIMEOUT_MS = 8000;

export interface AlertMessage {
  title: string;
  body: string | null;
  link: string | null;
}

export function makeConfigured() {
  return Boolean(process.env.MAKE_WEBHOOK_URL);
}

/** South African numbers → international format for WhatsApp ("082 555 0000" → "+27825550000"). Null if it doesn't look like a phone number. */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `27${digits.slice(1)}`;
  if (digits.includes("+") || !/^\d{10,15}$/.test(digits)) return null;
  return `+${digits}`;
}

/** The full link to open in the app. */
export function absoluteLink(link: string | null, appUrl = process.env.NEXT_PUBLIC_APP_URL || ""): string {
  const base = appUrl.replace(/\/+$/, "");
  const path = link && link.startsWith("/") && !link.startsWith("//") ? link : "/dashboard/notifications";
  return base ? `${base}${path}` : path;
}

/** The WhatsApp message text. */
export function alertText(msg: AlertMessage, churchName: string | null, url: string): string {
  return [`*${msg.title}*${churchName ? ` — ${churchName}` : ""}`, msg.body ?? "", `Open: ${url}`].filter(Boolean).join("\n");
}

/** The JSON sent to Make for one person. Exported for tests. */
export function makePayload(
  user: { name: string; phone: string | null },
  prefs: { whatsapp_alerts?: boolean | null } | null,
  msg: AlertMessage,
  churchName: string | null,
  url: string,
) {
  const whatsappTo = prefs?.whatsapp_alerts === false ? null : toWhatsAppNumber(user.phone);
  return {
    kind: "whatsapp" as const, // the route in the Make scenario (docs/make/)
    name: user.name,
    church: churchName,
    title: msg.title,
    body: msg.body ?? "",
    link: url,
    whatsapp_to: whatsappTo ?? "",
    // Ready-made message, so the scenario needs no formatting of its own.
    whatsapp_text: alertText(msg, churchName, url),
  };
}

/** Sends one alert for one person to Make, which delivers it by WhatsApp. */
export async function deliverAlert(userId: string, msg: AlertMessage): Promise<{ sent: boolean }> {
  if (!makeConfigured()) return { sent: false };
  try {
    const admin = createAdminClient();
    const [{ data: user }, { data: prefs }] = await Promise.all([
      admin.from("app_users").select("name, phone, status, churches(name)").eq("id", userId).maybeSingle(),
      admin.from("notification_preferences").select("whatsapp_alerts").eq("user_id", userId).maybeSingle(),
    ]);
    if (!user || user.status === "disabled") return { sent: false };
    const churchName = ((Array.isArray(user.churches) ? user.churches[0] : user.churches) as { name?: string } | null)?.name ?? null;
    const payload = makePayload(user, prefs, msg, churchName, absoluteLink(msg.link));
    if (!payload.whatsapp_to) return { sent: false };

    const res = await fetch(process.env.MAKE_WEBHOOK_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.MAKE_WEBHOOK_SECRET ? { "X-Notify-Secret": process.env.MAKE_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Make webhook responded ${res.status}`);
    return { sent: true };
  } catch (error) {
    console.error("[alerts] Make delivery failed:", error instanceof Error ? error.message : error);
    return { sent: false };
  }
}
