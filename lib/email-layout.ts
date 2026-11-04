// The look of every email Grace sends (billing, Monday report, messages from
// the platform team): a plum header with the Grace logo, a white card, and a
// clear button. Table layout and inline styles, because that's what email
// apps (Gmail, Outlook, phones) reliably show.
import { APP_NAME, COMPANY_NAME } from "@/lib/brand";

export const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const esc = escapeHtml;

const PLUM = "#4c1a57";
const PLUM_DEEP = "#24092b";
const TEAL = "#1f94a0";
const INK = "#1f1025";
const MUTED = "#6b5a70";

/** The logo, from the app's own address (emails can't show images without a full link). */
function logoUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  return /^https?:\/\//.test(base) ? `${base}/brand/grace-logo-dark.png` : null;
}

export interface EmailLayout {
  /** The grey line email apps show next to the subject. */
  preheader?: string;
  eyebrow?: string;
  title: string;
  /** Already-escaped HTML for the body. */
  bodyHtml: string;
  button?: { href: string; label: string };
  /** Small print at the bottom (plain text). */
  footer?: string;
}

/** A label/value table, e.g. Plan · Amount · Due. Values are plain text. */
export function emailRows(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:separate;border:1px solid #efe4f0;border-radius:14px;overflow:hidden">${rows
    .map(
      ([label, value], i) =>
        `<tr><td style="padding:12px 16px;font-size:14px;color:${MUTED};${i ? "border-top:1px solid #f3eaf3;" : ""}">${esc(label)}</td><td style="padding:12px 16px;font-size:14px;font-weight:bold;color:${INK};text-align:right;${i ? "border-top:1px solid #f3eaf3;" : ""}">${esc(value)}</td></tr>`,
    )
    .join("")}</table>`;
}

/** A paragraph of plain text (escaped; line breaks kept). */
export const emailParagraph = (text: string, style = "") => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${INK};${style}">${esc(text).replace(/\n/g, "<br>")}</p>`;

export function emailLayout({ preheader, eyebrow, title, bodyHtml, button, footer }: EmailLayout): string {
  const logo = logoUrl();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f7f1f6;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:${INK}">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f1f6;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 10px 30px rgba(76,26,87,0.12)">
<tr><td style="background:${PLUM_DEEP};background-image:linear-gradient(135deg,${PLUM_DEEP} 0%,${PLUM} 60%,#6b2a78 100%);padding:26px 32px 22px" align="left">
${logo ? `<img src="${logo}" width="170" height="68" alt="${esc(APP_NAME)}" style="display:block;border:0;width:170px;height:auto">` : `<span style="font-family:Georgia,serif;font-size:30px;font-style:italic;color:#9fe3e7">${esc(APP_NAME)}</span>`}
</td></tr>
<tr><td style="height:4px;background:${TEAL};background-image:linear-gradient(90deg,#9fe3e7,${TEAL},#f4a6c8);font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:30px 32px 8px">
${eyebrow ? `<p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${TEAL}">${esc(eyebrow)}</p>` : ""}
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;font-weight:normal;color:${PLUM}">${esc(title)}</h1>
${bodyHtml}
${button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 10px"><tr><td style="border-radius:999px;background:${PLUM}"><a href="${esc(button.href)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px">${esc(button.label)} &rarr;</a></td></tr></table>` : ""}
</td></tr>
<tr><td style="padding:22px 32px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0e6f0"><tr><td style="padding-top:16px;font-size:12px;line-height:1.6;color:${MUTED}">
${footer ? `${esc(footer)}<br>` : ""}<span style="color:${PLUM};font-weight:bold">${esc(APP_NAME)}</span> · your church, together — by ${esc(COMPANY_NAME)}
</td></tr></table>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
