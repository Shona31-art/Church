// The Monday morning report: its shape and its email (pure, unit-tested).
import { APP_NAME, COMPANY_NAME } from "@/lib/brand";
import { formatMoney } from "@/lib/format";

export interface WeeklyReport {
  churchName: string;
  /** Monday … Sunday just gone, e.g. "27 Oct – 2 Nov". */
  weekLabel: string;
  members: { total: number; newThisWeek: { name: string }[]; invitedWaiting: number };
  prayer: { newRequests: number; answered: number };
  giving: { totalCents: number; gifts: number; awaitingConfirmation: number } | null;
  birthdays: { name: string; when: string; child: boolean }[];
  events: { title: string; when: string }[];
  needsAttention: { label: string; count: number; link: string }[];
  rosterGaps: { team: string; when: string; why: "nobody" | "swap" }[];
  readingPlans: { title: string; readers: number }[];
  appUrl: string;
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function sections(r: WeeklyReport) {
  const out: { title: string; lines: string[] }[] = [];
  out.push({
    title: "People",
    lines: [
      `${r.members.total} active members`,
      r.members.newThisWeek.length ? `${r.members.newThisWeek.length} new this week: ${r.members.newThisWeek.map((m) => m.name).join(", ")}` : "No new members this week",
      ...(r.members.invitedWaiting ? [`${r.members.invitedWaiting} invited but not signed in yet`] : []),
    ],
  });
  out.push({ title: "Prayer", lines: [`${r.prayer.newRequests} new prayer request${r.prayer.newRequests === 1 ? "" : "s"}`, ...(r.prayer.answered ? [`${r.prayer.answered} marked answered 🙌`] : [])] });
  if (r.giving)
    out.push({
      title: "Giving",
      lines: [`${formatMoney(r.giving.totalCents)} from ${r.giving.gifts} gift${r.giving.gifts === 1 ? "" : "s"}`, ...(r.giving.awaitingConfirmation ? [`${r.giving.awaitingConfirmation} bank transfer${r.giving.awaitingConfirmation === 1 ? "" : "s"} waiting to be confirmed`] : [])],
    });
  out.push({ title: "Birthdays this week", lines: r.birthdays.length ? r.birthdays.map((b) => `${b.name}${b.child ? " (child)" : ""} — ${b.when}`) : ["None this week"] });
  if (r.events.length) out.push({ title: "Coming up", lines: r.events.map((e) => `${e.title} — ${e.when}`) });
  if (r.rosterGaps.length) out.push({ title: "Roster gaps", lines: r.rosterGaps.map((g) => `${g.team}, ${g.when}: ${g.why === "nobody" ? "nobody on duty" : "swap asked"}`) });
  if (r.readingPlans.length) out.push({ title: "Reading together", lines: r.readingPlans.map((p) => `${p.title}: ${p.readers} reading`) });
  if (r.needsAttention.length) out.push({ title: "Needs your attention", lines: r.needsAttention.map((n) => `${n.count} ${n.label}`) });
  return out;
}

export function weeklyReportEmail(r: WeeklyReport) {
  const subject = `${r.churchName}: your Monday report (${r.weekLabel})`;
  const parts = sections(r);
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1f1a14">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ee;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#1f1a14;padding:20px 28px;color:#f3c969;font-size:20px;font-weight:bold">${esc(APP_NAME)} <span style="color:#d8cfc2;font-weight:normal;font-size:14px">Monday report</span></td></tr>
<tr><td style="padding:24px 28px 8px"><h1 style="margin:0;font-size:22px">${esc(r.churchName)}</h1><p style="margin:4px 0 0;color:#6b6257;font-size:14px">The week of ${esc(r.weekLabel)}. Good morning — here's your church at a glance.</p></td></tr>
${parts
  .map(
    (s) => `<tr><td style="padding:14px 28px 0"><h2 style="margin:0 0 6px;font-size:15px;color:#8a6a28;text-transform:uppercase;letter-spacing:.06em">${esc(s.title)}</h2>
<ul style="margin:0;padding-left:18px;font-size:15px;line-height:1.6">${s.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></td></tr>`,
  )
  .join("")}
<tr><td style="padding:24px 28px"><a href="${esc(r.appUrl)}" style="background:#c2410c;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;display:inline-block">Open ${esc(APP_NAME)}</a></td></tr>
<tr><td style="padding:16px 28px;background:#faf7f2;color:#6b6257;font-size:12px">Sent every Monday to your church's pastors and admins by ${esc(COMPANY_NAME)}. Private prayer, counselling and journal content is never included.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [`${r.churchName} — Monday report (${r.weekLabel})`, "", ...parts.flatMap((s) => [s.title.toUpperCase(), ...s.lines.map((l) => `• ${l}`), ""]), `Open ${APP_NAME}: ${r.appUrl}`].join("\n");
  return { subject, html, text, sections: parts };
}
