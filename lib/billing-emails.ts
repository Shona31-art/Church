// The words of the billing emails (payment reminder and receipt), kept free of
// server imports so they can be unit-tested. Sent by lib/billing-mailer.ts.
import { APP_NAME, COMPANY_NAME } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { PLAN_LABELS } from "@/lib/subscription";

/** Days before the payment date that the reminder goes out. */
export const REMINDER_DAYS_BEFORE = 3;

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const longDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric" });

export const invoiceNumber = (no: number | string) => `GBV-${no}`;

function layout(title: string, bodyHtml: string, button?: { href: string; label: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1f1a14">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ee;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#1f1a14;padding:20px 28px;color:#f3c969;font-size:20px;font-weight:bold">${esc(APP_NAME)} <span style="color:#d8cfc2;font-weight:normal;font-size:14px">by ${esc(COMPANY_NAME)}</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px">${esc(title)}</h1>
${bodyHtml}
${button ? `<p style="margin:28px 0 8px"><a href="${esc(button.href)}" style="background:#c2410c;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;display:inline-block">${esc(button.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:18px 28px;background:#faf7f2;color:#6b6257;font-size:12px">${esc(COMPANY_NAME)} · Thank you for building your church family with ${esc(APP_NAME)}.<br>You get this email because you're a pastor or admin of your church in ${esc(APP_NAME)}.</td></tr>
</table></td></tr></table></body></html>`;
}

const row = (label: string, value: string) =>
  `<tr><td style="padding:6px 0;color:#6b6257;font-size:14px">${esc(label)}</td><td style="padding:6px 0;text-align:right;font-size:14px;font-weight:bold">${esc(value)}</td></tr>`;

export interface ReminderInput {
  churchName: string;
  planKey: string;
  interval: "monthly" | "yearly";
  amountCents: number;
  dueDate: string;
  /** Paystack charges the card by itself. */
  autoCharge: boolean;
  billingUrl: string;
}

export function reminderEmail(r: ReminderInput) {
  const plan = PLAN_LABELS[r.planKey] ?? r.planKey;
  const amount = formatMoney(r.amountCents);
  const due = longDate(r.dueDate);
  const period = r.interval === "yearly" ? "yearly" : "monthly";
  const subject = `${APP_NAME}: your ${period} payment of ${amount} is due on ${due}`;
  const what = r.autoCharge
    ? `Paystack will charge the card on file automatically on <strong>${esc(due)}</strong> — there's nothing you need to do. Please make sure the card has enough funds.`
    : `Your next payment is due on <strong>${esc(due)}</strong>. Please pay before then so ${esc(r.churchName)} keeps every feature without interruption.`;
  const html = layout(
    "Your payment is coming up",
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">Hello ${esc(r.churchName)} team,</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">This is a friendly reminder from ${esc(COMPANY_NAME)}. ${what}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;margin:8px 0">
${row("Plan", `${plan} (${period})`)}${row("Amount", amount)}${row("Due", due)}
</table>
<p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:#4a4238">Questions, or want to change your plan? Reply to this email or open the Billing page.</p>`,
    { href: r.billingUrl, label: "Open Billing" },
  );
  const text = `Hello ${r.churchName} team,

This is a friendly reminder from ${COMPANY_NAME}. ${r.autoCharge ? `Paystack will charge the card on file automatically on ${due} — there's nothing you need to do. Please make sure the card has enough funds.` : `Your next payment is due on ${due}. Please pay before then so ${r.churchName} keeps every feature without interruption.`}

Plan: ${plan} (${period})
Amount: ${amount}
Due: ${due}

Billing: ${r.billingUrl}

— ${COMPANY_NAME}`;
  return { subject, html, text };
}

export interface ReceiptInput {
  churchName: string;
  invoiceNo: number | string;
  planKey: string;
  interval: "monthly" | "yearly";
  kind: "checkout" | "renewal";
  amountCents: number;
  paidAt: string;
  periodEnd: string | null;
  reference: string;
  invoiceUrl: string;
}

export function receiptEmail(r: ReceiptInput) {
  const plan = PLAN_LABELS[r.planKey] ?? r.planKey;
  const amount = formatMoney(r.amountCents);
  const no = invoiceNumber(r.invoiceNo);
  const period = r.interval === "yearly" ? "yearly" : "monthly";
  const subject = `${APP_NAME}: payment received — invoice ${no}`;
  const html = layout(
    "Thank you — payment received",
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">Hello ${esc(r.churchName)} team,</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">We've received your payment. Thank you so much for supporting ${esc(APP_NAME)} — it keeps the app running and growing for churches like yours.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;margin:8px 0">
${row("Invoice", no)}${row("Date paid", longDate(r.paidAt))}${row("Plan", `${plan} (${period}${r.kind === "renewal" ? " renewal" : ""})`)}${r.periodEnd ? row("Paid until", longDate(r.periodEnd)) : ""}${row("Payment", "Card, via Paystack")}${row("Total paid", amount)}
</table>
<p style="margin:16px 0 0;font-size:13px;color:#6b6257">Reference: ${esc(r.reference)}</p>`,
    { href: r.invoiceUrl, label: "View or print the invoice" },
  );
  const text = `Hello ${r.churchName} team,

We've received your payment. Thank you so much for supporting ${APP_NAME} — it keeps the app running and growing for churches like yours.

Invoice: ${no}
Date paid: ${longDate(r.paidAt)}
Plan: ${plan} (${period}${r.kind === "renewal" ? " renewal" : ""})
${r.periodEnd ? `Paid until: ${longDate(r.periodEnd)}\n` : ""}Payment: card, via Paystack
Total paid: ${amount}
Reference: ${r.reference}

Invoice: ${r.invoiceUrl}

— ${COMPANY_NAME}`;
  return { subject, html, text };
}
