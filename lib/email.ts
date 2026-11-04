import "server-only";
import { APP_NAME, COMPANY_NAME } from "@/lib/brand";

// Sending email from the server (billing reminders and receipts), with a free
// provider chosen by environment:
//   * Brevo  — BREVO_API_KEY. Free: 300 emails a day. The sender can be a
//              single verified address (even a Gmail one): no domain needed.
//   * Resend — RESEND_API_KEY. Free: 3,000 a month, 100 a day; needs a domain
//              you verify to email anyone other than yourself.
//   * Make   — MAKE_EMAIL_WEBHOOK_URL. A Make.com scenario (free plan) that
//              sends it from your own Gmail: docs/make/grace-alerts.blueprint.json.
//              No EMAIL_FROM needed — it comes from the Gmail account.
// EMAIL_FROM is the sender for Brevo/Resend, e.g. "Grace-bound Ventures <billing@example.com>";
// EMAIL_REPLY_TO (optional) is where replies go.
// With none of these set, nothing is sent and callers leave the email for later.

export interface Email {
  to: { email: string; name?: string | null }[];
  subject: string;
  html: string;
  text: string;
}

const TIMEOUT_MS = 10_000;

export function emailConfigured(): boolean {
  return Boolean(((process.env.BREVO_API_KEY || process.env.RESEND_API_KEY) && process.env.EMAIL_FROM) || process.env.MAKE_EMAIL_WEBHOOK_URL);
}

/** The JSON a Make scenario gets for one email (route "email" in the blueprint). Exported for tests. */
export function makeEmailPayload(message: Email, replyTo: string | null = null) {
  return {
    kind: "email" as const,
    to: message.to.map((t) => t.email),
    subject: message.subject,
    html: message.html,
    text: message.text,
    reply_to: replyTo ?? "",
  };
}

/** "Name <a@b.c>" or "a@b.c" → parts. */
export function parseAddress(value: string): { name: string; email: string } | null {
  const m = value.trim().match(/^(?:"?([^"<]*?)"?\s*<)?([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>?$/);
  if (!m) return null;
  return { name: (m[1] ?? "").trim() || `${APP_NAME} · ${COMPANY_NAME}`, email: m[2] };
}

/** Sends one email. Returns false (and logs) when it couldn't — never throws. */
export async function sendEmail(message: Email): Promise<boolean> {
  const from = parseAddress(process.env.EMAIL_FROM ?? "");
  const replyTo = process.env.EMAIL_REPLY_TO ? parseAddress(process.env.EMAIL_REPLY_TO) : null;
  const to = message.to.filter((t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email));
  if (!to.length) return false;
  const viaApi = Boolean(from && (process.env.BREVO_API_KEY || process.env.RESEND_API_KEY));
  try {
    let res: Response;
    if (!viaApi && process.env.MAKE_EMAIL_WEBHOOK_URL) {
      res = await fetch(process.env.MAKE_EMAIL_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.MAKE_WEBHOOK_SECRET ? { "X-Notify-Secret": process.env.MAKE_WEBHOOK_SECRET } : {}),
        },
        body: JSON.stringify(makeEmailPayload({ ...message, to }, replyTo?.email ?? null)),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } else if (!from) {
      return false;
    } else if (process.env.BREVO_API_KEY) {
      res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: from,
          to: to.map((t) => ({ email: t.email, ...(t.name ? { name: t.name } : {}) })),
          ...(replyTo ? { replyTo } : {}),
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } else if (process.env.RESEND_API_KEY) {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${from.name} <${from.email}>`,
          to: to.map((t) => t.email),
          ...(replyTo ? { reply_to: replyTo.email } : {}),
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } else {
      return false;
    }
    if (!res.ok) {
      console.error(`[email] provider responded ${res.status}:`, (await res.text().catch(() => "")).slice(0, 300));
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] send failed:", error instanceof Error ? error.message : error);
    return false;
  }
}
