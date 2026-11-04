// The words of the billing emails (payment reminder and receipt), kept free of
// server imports so they can be unit-tested. Sent by lib/billing-mailer.ts.
import { APP_NAME, COMPANY_NAME } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { PLAN_LABELS } from "@/lib/subscription";

/** Days before the payment date that the reminder goes out. */
export const REMINDER_DAYS_BEFORE = 3;

import { emailLayout, emailParagraph, emailRows } from "@/lib/email-layout";

const longDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric" });

export const invoiceNumber = (no: number | string) => `GBV-${no}`;

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
  const html = emailLayout({
    preheader: `${amount} due on ${due}`,
    eyebrow: "Payment reminder",
    title: "Your payment is coming up",
    bodyHtml:
      emailParagraph(`Hello ${r.churchName} team,`) +
      emailParagraph(
        r.autoCharge
          ? `Paystack will charge the card on file automatically on ${due} — there's nothing you need to do. Please make sure the card has enough funds.`
          : `Your next payment is due on ${due}. Please pay before then so ${r.churchName} keeps every feature without interruption.`,
      ) +
      emailRows([
        ["Plan", `${plan} (${period})`],
        ["Amount", amount],
        ["Due", due],
      ]) +
      emailParagraph("Questions, or want to change your plan? Reply to this email or open the Billing page.", "color:#6b5a70;font-size:14px"),
    button: { href: r.billingUrl, label: "Open Billing" },
  });
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
  kind: "checkout" | "renewal" | "manual";
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
  const html = emailLayout({
    preheader: `Invoice ${no} · ${amount} received with thanks`,
    eyebrow: "Payment received",
    title: "Thank you for your support",
    bodyHtml:
      emailParagraph(`Hello ${r.churchName} team,`) +
      emailParagraph(`We've received your payment. Thank you so much for supporting ${APP_NAME} — it keeps the app running and growing for churches like yours.`) +
      emailRows([
        ["Invoice", no],
        ["Date paid", longDate(r.paidAt)],
        ["Plan", `${plan} (${period}${r.kind === "renewal" ? " renewal" : ""})`],
        ...(r.periodEnd ? ([["Paid until", longDate(r.periodEnd)]] as [string, string][]) : []),
        ["Payment", r.kind === "manual" ? "EFT / cash" : "Card, via Paystack"],
        ["Total paid", amount],
      ]) +
      emailParagraph(`Reference: ${r.reference}`, "color:#6b5a70;font-size:13px"),
    button: { href: r.invoiceUrl, label: "View or print the invoice" },
  });
  const text = `Hello ${r.churchName} team,

We've received your payment. Thank you so much for supporting ${APP_NAME} — it keeps the app running and growing for churches like yours.

Invoice: ${no}
Date paid: ${longDate(r.paidAt)}
Plan: ${plan} (${period}${r.kind === "renewal" ? " renewal" : ""})
${r.periodEnd ? `Paid until: ${longDate(r.periodEnd)}\n` : ""}Payment: ${r.kind === "manual" ? "EFT / cash" : "card, via Paystack"}
Total paid: ${amount}
Reference: ${r.reference}

Invoice: ${r.invoiceUrl}

— ${COMPANY_NAME}`;
  return { subject, html, text };
}
