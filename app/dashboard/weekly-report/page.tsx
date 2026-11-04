import { Mail } from "lucide-react";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { buildWeeklyReport } from "@/lib/weekly-report";
import { weeklyReportEmail } from "@/lib/weekly-report-email";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { emailReportToMe, setWeeklyReport } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const metadata = { title: "Monday report" };

export default async function WeeklyReportPage() {
  const gate = await moduleGate("weekly_report");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  if (!can(me.role, "pastoralCare")) return <PermissionDenied message="The Monday report is for pastors and church admins." />;
  const report = await buildWeeklyReport(me.church_id!);
  if (!report) return null;
  const { sections } = weeklyReportEmail(report);
  const { data: setting } = await createClient().from("churches").select("weekly_report_enabled").eq("id", me.church_id).maybeSingle();
  const on = (setting as { weekly_report_enabled?: boolean } | null)?.weekly_report_enabled !== false;
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title="Monday report"
        description={`Last week (${report.weekLabel}) and the week ahead. Emailed automatically to your church's pastors and admins every Monday morning.`}
        actions={
          <form action={emailReportToMe}>
            <PendingButton className="btn-secondary" pendingLabel="Sending…">
              <Mail aria-hidden className="h-4 w-4" /> Email it to me now
            </PendingButton>
          </form>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <StatusBadge tone={on ? "success" : "neutral"}>{on ? "On" : "Off"}</StatusBadge>
          <p className="text-sm">{on ? "Emailed every Monday morning to the pastors and admins." : "Not being emailed. You can still read it here."}</p>
        </div>
        <form action={setWeeklyReport}>
          <input type="hidden" name="on" value={on ? "0" : "1"} />
          <PendingButton className={on ? "btn-ghost" : "btn-primary"} pendingLabel="Saving…">
            {on ? "Switch off" : "Switch on"}
          </PendingButton>
        </form>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Section key={s.title} title={s.title}>
            <ul className="space-y-1 text-sm">
              {s.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Section>
        ))}
      </div>
      <p className="text-xs text-ink/60">Attendance isn&apos;t counted in Grace yet, so it isn&apos;t in the report. Private prayer, counselling and journal content is never included.</p>
    </div>
  );
}
