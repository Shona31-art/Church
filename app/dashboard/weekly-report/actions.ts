"use server";

import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { flash } from "@/lib/flash";
import { emailConfigured } from "@/lib/email";
import { sendWeeklyReport } from "@/lib/weekly-report";

/** Pastors/admins: email this week's report to yourself now. */
export async function emailReportToMe(): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me?.church_id || !can(me.role, "pastoralCare")) return;
  if (!(await checkModuleAccess("weekly_report")).allowed) return;
  if (!emailConfigured()) {
    flash("Email isn't set up for the app yet — ask Grace-bound Ventures (support).", "error");
    return;
  }
  const ok = await sendWeeklyReport(me.church_id, [{ email: me.email, name: me.name }]);
  flash(ok ? `Sent to ${me.email}.` : "Couldn't send it right now — please try again later.", ok ? "success" : "error");
}
