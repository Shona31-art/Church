// The Monday morning report: its shape and its email (pure, unit-tested).
import { APP_NAME } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { emailLayout, emailParagraph, escapeHtml as esc } from "@/lib/email-layout";

export interface WeeklyReport {
  churchName: string;
  /** Monday … Sunday just gone, e.g. "27 Oct – 2 Nov". */
  weekLabel: string;
  /** People who joined the app last week. */
  newMembers: { name: string }[];
  prayer: { newRequests: number; answered: number };
  giving: { totalCents: number; gifts: number; awaitingConfirmation: number } | null;
  birthdays: { name: string; when: string; child: boolean }[];
  events: { title: string; when: string }[];
  liveServices: { title: string; when: string }[];
  prayerChains: { title: string; when: string; schedule: string; covered: number; total: number }[];
  testimoniesShared: number;
  needsAttention: { label: string; count: number; link: string }[];
  rosterGaps: { team: string; when: string; why: "nobody" | "swap" }[];
  readingPlans: { title: string; readers: number }[];
  appUrl: string;
}

export interface ReportSection {
  title: string;
  lines: string[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The report's sections, in order; anything with nothing to say is left out. */
export function reportSections(r: WeeklyReport): ReportSection[] {
  const out: ReportSection[] = [];
  out.push({
    title: "New people",
    lines: r.newMembers.length ? [`${plural(r.newMembers.length, "person", "people")} joined Grace: ${r.newMembers.map((m) => m.name).join(", ")}. Welcome them!`] : ["No one new joined this week."],
  });
  if (r.prayerChains.length)
    out.push({ title: "Prayer chain", lines: r.prayerChains.map((c) => `${c.title} — ${c.when}, ${c.schedule}. ${c.covered} of ${plural(c.total, "slot")} covered${c.covered < c.total ? "; encourage the church to book the rest" : " 🙌"}.`) });
  const ahead = [...r.liveServices.map((l) => `🔴 ${l.title} — ${l.when} (Live Sunday)`), ...r.events.map((e) => `${e.title} — ${e.when}`)];
  if (ahead.length) out.push({ title: "Coming up this week", lines: ahead });
  if (r.birthdays.length) out.push({ title: "Birthdays this week", lines: r.birthdays.map((b) => `${b.name}${b.child ? " (child)" : ""} — ${b.when}`) });
  if (r.prayer.newRequests || r.prayer.answered || r.testimoniesShared)
    out.push({
      title: "Prayer & testimonies",
      lines: [
        ...(r.prayer.newRequests ? [`${plural(r.prayer.newRequests, "new prayer request")}`] : []),
        ...(r.prayer.answered ? [`${plural(r.prayer.answered, "prayer")} marked answered 🙌`] : []),
        ...(r.testimoniesShared ? [`${plural(r.testimoniesShared, "testimony", "testimonies")} on the wall`] : []),
      ],
    });
  if (r.giving && (r.giving.gifts || r.giving.awaitingConfirmation))
    out.push({
      title: "Giving",
      lines: [
        ...(r.giving.gifts ? [`${formatMoney(r.giving.totalCents)} from ${plural(r.giving.gifts, "gift")}`] : []),
        ...(r.giving.awaitingConfirmation ? [`${plural(r.giving.awaitingConfirmation, "bank transfer")} waiting to be confirmed`] : []),
      ],
    });
  if (r.rosterGaps.length) out.push({ title: "Roster gaps", lines: r.rosterGaps.map((g) => `${g.team}, ${g.when}: ${g.why === "nobody" ? "nobody on duty" : "swap asked"}`) });
  if (r.readingPlans.length) out.push({ title: "Reading together", lines: r.readingPlans.map((p) => `${p.title}: ${plural(p.readers, "person", "people")} reading`) });
  if (r.needsAttention.length) out.push({ title: "Needs your attention", lines: r.needsAttention.map((n) => `${n.count} ${n.label}`) });
  return out;
}

export function weeklyReportEmail(r: WeeklyReport) {
  const subject = `${r.churchName}: your Monday report (${r.weekLabel})`;
  const sections = reportSections(r);
  const sectionHtml = sections
    .map(
      (s) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;background:#fbf7fb;border-radius:14px"><tr><td style="padding:14px 18px">
<p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#1f94a0">${esc(s.title)}</p>
${s.lines.map((l) => `<p style="margin:0 0 4px;font-size:15px;line-height:1.55;color:#1f1025">${esc(l)}</p>`).join("")}
</td></tr></table>`,
    )
    .join("");
  const html = emailLayout({
    preheader: sections.map((s) => s.lines[0]).slice(0, 2).join(" · "),
    eyebrow: `Monday report · ${r.weekLabel}`,
    title: `Good morning, ${r.churchName}`,
    bodyHtml: emailParagraph("Here's your church at a glance — last week, and what's coming up.") + sectionHtml,
    button: { href: r.appUrl, label: `Open ${APP_NAME}` },
    footer: "Sent every Monday to your church's pastors and admins. Private prayers, counselling and journals are never included. Switch it off on the Monday report page in the app.",
  });
  const text = [`${r.churchName} — Monday report (${r.weekLabel})`, "", ...sections.flatMap((s) => [s.title.toUpperCase(), ...s.lines.map((l) => `• ${l}`), ""]), `Open ${APP_NAME}: ${r.appUrl}`].join("\n");
  return { subject, html, text, sections };
}
