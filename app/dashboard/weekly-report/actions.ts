"use server";

import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { flash } from "@/lib/flash";
import { emailConfigured } from "@/lib/email";
import { sendWeeklyReport } from "@/lib/weekly-report";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

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

/** Pastors/admins: switch the Monday email on or off for the church. Form fields: on ("1" | "0") */
export async function setWeeklyReport(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me?.church_id || !can(me.role, "pastoralCare")) return;
  const on = formData.get("on") === "1";
  // Pastors can't change the church row themselves; checked above.
  const { error } = await createAdminClient().from("churches").update({ weekly_report_enabled: on }).eq("id", me.church_id);
  if (error) {
    flash(/weekly_report_enabled/.test(error.message) ? "Run database update #62 first to switch the report on and off." : "Couldn't save that — please try again.", "error");
    return;
  }
  revalidatePath("/dashboard/weekly-report");
  flash(on ? "The Monday report is on — it arrives every Monday morning." : "The Monday report is off. You can still read it here any time.");
}
