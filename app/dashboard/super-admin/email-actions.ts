"use server";

import { getCurrentAppUser } from "@/lib/current-user";
import { emailConfigured, sendEmail } from "@/lib/email";
import { receiptEmail, reminderEmail } from "@/lib/billing-emails";
import { absoluteLink } from "@/lib/alert-delivery";
import { flash } from "@/lib/flash";

/**
 * Super admin: sends a sample payment reminder and receipt to yourself, to
 * check the email set-up (and so a new Make scenario learns the fields).
 */
export async function sendTestBillingEmails(): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") return;
  if (!emailConfigured()) {
    flash("Email isn't set up yet — add MAKE_EMAIL_WEBHOOK_URL (or a Brevo/Resend key) in Vercel, then redeploy.", "error");
    return;
  }
  const to = [{ email: me.email, name: me.name }];
  const due = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const ok1 = await sendEmail({
    to,
    ...reminderEmail({ churchName: "Test Church", planKey: "basic", interval: "monthly", amountCents: 25000, dueDate: due, autoCharge: true, billingUrl: absoluteLink("/dashboard/billing") }),
  });
  const ok2 = await sendEmail({
    to,
    ...receiptEmail({
      churchName: "Test Church",
      invoiceNo: 1000,
      planKey: "basic",
      interval: "monthly",
      kind: "checkout",
      amountCents: 25000,
      paidAt: new Date().toISOString(),
      periodEnd: due,
      reference: "TEST",
      invoiceUrl: absoluteLink("/dashboard/billing"),
    }),
  });
  flash(ok1 && ok2 ? `Two test emails sent to ${me.email}.` : "The test email couldn't be sent — check the Vercel logs and your Make scenario.", ok1 && ok2 ? "success" : "error");
}
