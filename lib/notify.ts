import "server-only";

// Outbound notifications (email / WhatsApp / push) behind one small interface,
// so the provider can change without touching features.
//
// Providers, chosen by environment:
//   * "webhook" — NOTIFY_WEBHOOK_URL is set. POSTs a JSON event to a Make.com,
//     n8n or Zapier webhook, which then sends the email or WhatsApp message.
//     Free tiers cover early usage; no vendor SDK in this codebase.
//   * "log" (default) — nothing is sent. The event is logged server-side and
//     the app's in-app screens remain the source of truth. R0/month.
//
// Notifications are best-effort: a failure is logged and never blocks or
// undoes the action that triggered it.

export type NotificationEvent =
  | { type: "counseling.crisis_flagged"; churchId: string; conversationId: string; notifyUserIds: string[] }
  | { type: "booking.decided"; churchId: string; bookingId: string; requesterId: string; decision: string }
  | { type: "member.invited"; churchId: string; memberId: string };

export interface NotificationProvider {
  name: string;
  send(event: NotificationEvent & { appUrl: string; occurredAt: string }): Promise<void>;
}

const TIMEOUT_MS = 5000;

const webhookProvider = (url: string, secret?: string): NotificationProvider => ({
  name: "webhook",
  async send(event) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Lets the receiving scenario reject requests that didn't come from us.
        ...(secret ? { "X-Notify-Secret": secret } : {}),
      },
      // IDs only — the receiving workflow looks up what it needs. Keeps
      // personal data (and confidential care details) out of third-party logs.
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`webhook responded ${res.status}`);
  },
});

const logProvider: NotificationProvider = {
  name: "log",
  async send(event) {
    console.info(`[notify] (no provider configured) ${event.type}`);
  },
};

function provider(): NotificationProvider {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  return url ? webhookProvider(url, process.env.NOTIFY_WEBHOOK_SECRET) : logProvider;
}

export async function notify(event: NotificationEvent): Promise<void> {
  const p = provider();
  try {
    await p.send({ ...event, appUrl: process.env.NEXT_PUBLIC_APP_URL || "", occurredAt: new Date().toISOString() });
  } catch (error) {
    console.error(`[notify] ${p.name} failed for ${event.type}:`, error instanceof Error ? error.message : error);
  }
}
