"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { logAudit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { FormState } from "@/lib/forms";
import { emailConfigured, sendEmail } from "@/lib/email";
import { absoluteLink } from "@/lib/alert-delivery";
import { nextPeriodEnd, type BillingInterval } from "@/lib/billing";
import { reminderEmail } from "@/lib/billing-emails";
import { sendReceiptsNow } from "@/lib/billing-mailer";
import { APP_NAME, COMPANY_NAME } from "@/lib/brand";
import { emailLayout, emailParagraph } from "@/lib/email-layout";

// Platform admin: one-tap account actions on a church (suspend for
// non-payment, restore, extend a trial, record a payment, remind, email,
// delete). Every action re-checks super_admin and is written to the audit log.

const uuid = z.string().uuid();

async function superAdmin() {
  const me = await getCurrentAppUser();
  return me?.role === "super_admin" ? me : null;
}

function refresh(churchId: string) {
  revalidatePath(`/dashboard/super-admin/churches/${churchId}`);
  revalidatePath("/dashboard/super-admin/churches");
  revalidatePath("/dashboard/super-admin");
}

/** Active pastors and church admins of a church (who get billing messages). */
async function churchLeaders(churchId: string) {
  const { data } = await createAdminClient().from("app_users").select("id, email, name, role").eq("church_id", churchId).eq("status", "active").in("role", ["church_admin", "pastor"]);
  return (data ?? []) as { id: string; email: string | null; name: string; role: string }[];
}

async function tellChurch(churchId: string, title: string, body: string, link = "/dashboard/billing") {
  const leaders = await churchLeaders(churchId);
  if (!leaders.length) return;
  await createAdminClient()
    .from("notifications")
    .insert(leaders.map((l) => ({ user_id: l.id, church_id: churchId, category: "alerts", type: "billing.platform", title, body, link })));
}

function simpleEmail(title: string, message: string) {
  const html = emailLayout({ eyebrow: `A message from ${COMPANY_NAME}`, title, bodyHtml: message.split(/\n{2,}/).map((p) => emailParagraph(p)).join(""), footer: "Reply to this email if you have any questions." });
  return { html, text: `${title}\n\n${message}\n\n— ${COMPANY_NAME}` };
}

/** Suspend (e.g. unpaid). Form fields: church_id, reason?, notify ("on") */
export async function suspendChurch(formData: FormData): Promise<void> {
  const me = await superAdmin();
  const id = uuid.safeParse(formData.get("church_id"));
  if (!me || !id.success) return;
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || "Payment not received";
  const admin = createAdminClient();
  const { data: sub } = await admin.from("church_subscriptions").select("notes").eq("church_id", id.data).maybeSingle();
  const note = `${new Date().toISOString().slice(0, 10)} suspended: ${reason}`;
  const { error } = await admin
    .from("church_subscriptions")
    .upsert({ church_id: id.data, status: "suspended", suspended_at: new Date().toISOString(), notes: [sub?.notes, note].filter(Boolean).join("\n").slice(-1000) }, { onConflict: "church_id" });
  if (error) {
    flash("Couldn't suspend — please try again.", "error");
    return;
  }
  if (formData.get("notify") === "on") {
    await tellChurch(id.data, "Your Grace account is paused", `${reason}. Your data is safe — settle the account to switch everything back on.`);
    const to = (await churchLeaders(id.data)).filter((l) => l.email).map((l) => ({ email: l.email!, name: l.name }));
    if (emailConfigured() && to.length)
      await sendEmail({ to, subject: `${APP_NAME}: your account is paused`, ...simpleEmail("Your account is paused", `${reason}.\n\nYour church's data is kept safe. Members can still sign in, but most features are paused until the account is settled.\n\nTo switch everything back on, pay on the Billing page or reply to this email:\n${absoluteLink("/dashboard/billing")}`) });
  }
  await logAudit({ churchId: id.data, actorId: me.id, action: "church.suspended_by_platform", targetTable: "church_subscriptions", targetId: id.data, metadata: { reason } });
  refresh(id.data);
  flash("Church suspended. Members can sign in but features are paused; nothing is deleted.");
}

/** Switch a suspended church back on. Form fields: church_id */
export async function restoreChurch(formData: FormData): Promise<void> {
  const me = await superAdmin();
  const id = uuid.safeParse(formData.get("church_id"));
  if (!me || !id.success) return;
  const admin = createAdminClient();
  const { data: sub } = await admin.from("church_subscriptions").select("plan_key, trial_expires_at").eq("church_id", id.data).maybeSingle();
  const trial = sub?.plan_key === "free_trial";
  const trialOver = trial && (!sub?.trial_expires_at || Date.parse(sub.trial_expires_at) < Date.now());
  const { error } = await admin
    .from("church_subscriptions")
    .update({
      status: trial ? "trial" : "active",
      suspended_at: null,
      grace_period_end: null,
      ...(trialOver ? { trial_expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() } : {}),
    })
    .eq("church_id", id.data);
  if (error) {
    flash("Couldn't restore — please try again.", "error");
    return;
  }
  await tellChurch(id.data, "Your Grace account is back on", "Thank you! Every feature is switched on again.", "/dashboard");
  await logAudit({ churchId: id.data, actorId: me.id, action: "church.restored_by_platform", targetTable: "church_subscriptions", targetId: id.data });
  refresh(id.data);
  flash(trialOver ? "Restored, with 7 more trial days (the trial had ended)." : "Church restored — everything is switched back on.");
}

/** Form fields: church_id, days */
export async function extendTrial(formData: FormData): Promise<void> {
  const me = await superAdmin();
  const id = uuid.safeParse(formData.get("church_id"));
  const days = z.coerce.number().int().min(1).max(365).safeParse(formData.get("days"));
  if (!me || !id.success || !days.success) return;
  const admin = createAdminClient();
  const { data: sub } = await admin.from("church_subscriptions").select("trial_expires_at").eq("church_id", id.data).maybeSingle();
  const from = Math.max(Date.now(), sub?.trial_expires_at ? Date.parse(sub.trial_expires_at) : 0);
  const until = new Date(from + days.data * 86_400_000).toISOString();
  const { error } = await admin
    .from("church_subscriptions")
    .upsert({ church_id: id.data, plan_key: "free_trial", status: "trial", trial_expires_at: until, suspended_at: null }, { onConflict: "church_id" });
  if (error) {
    flash("Couldn't extend the trial — please try again.", "error");
    return;
  }
  await tellChurch(id.data, `Your free trial has ${days.data} more days`, `It now ends on ${new Date(until).toLocaleDateString("en-ZA", { day: "numeric", month: "long" })}.`);
  await logAudit({ churchId: id.data, actorId: me.id, action: "church.trial_extended", targetTable: "church_subscriptions", targetId: id.data, metadata: { days: days.data, until } });
  refresh(id.data);
  flash(`Trial extended by ${days.data} days.`);
}

/**
 * A payment made outside Paystack (EFT, cash): the plan becomes active and
 * paid up for a month or a year; the church gets an invoice and a thank-you.
 * Form fields: church_id, plan_key, interval, amount (rand), note?
 */
export async function recordManualPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await superAdmin();
  if (!me) return { error: "Only platform admins can do this." };
  const parsed = z
    .object({
      churchId: uuid,
      plan: z.enum(["basic", "premium", "enterprise"]),
      interval: z.enum(["monthly", "yearly"]),
      amount: z.coerce.number().positive("Enter the amount paid.").max(1_000_000),
      note: z.string().trim().max(80),
    })
    .safeParse({ churchId: formData.get("church_id"), plan: formData.get("plan_key"), interval: formData.get("interval"), amount: formData.get("amount"), note: formData.get("note") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the payment details." };
  const p = parsed.data;
  const admin = createAdminClient();
  const { data: sub } = await admin.from("church_subscriptions").select("plan_key, billing_date").eq("church_id", p.churchId).maybeSingle();
  const periodEnd = nextPeriodEnd(sub?.plan_key === p.plan ? sub?.billing_date ?? null : null, new Date(), p.interval as BillingInterval);
  const now = new Date().toISOString();
  const { error: payError } = await admin.from("billing_payments").insert({
    church_id: p.churchId,
    plan_key: p.plan,
    amount_cents: Math.round(p.amount * 100),
    reference: `manual-${crypto.randomUUID().slice(0, 8)}${p.note ? `-${p.note.replace(/[^\w-]+/g, "-").slice(0, 40)}` : ""}`,
    status: "succeeded",
    kind: "manual",
    paid_at: now,
    period_end: periodEnd.toISOString(),
    started_by: me.id,
    ...(p.interval === "yearly" ? { interval: "yearly" } : {}),
  });
  if (payError) {
    console.error("[super-admin] manual payment failed:", payError.message);
    return { error: /kind/.test(payError.message) ? "Run database update #60 (church_life.sql) first, then try again." : "Couldn't record the payment — please try again." };
  }
  const { error } = await admin
    .from("church_subscriptions")
    .upsert(
      { church_id: p.churchId, plan_key: p.plan, status: "active", billing_date: periodEnd.toISOString(), billing_interval: p.interval, grace_period_end: null, suspended_at: null, cancelled_at: null },
      { onConflict: "church_id" },
    );
  if (error) return { error: "The payment was saved but the plan didn't update — set it under Advanced settings." };
  await sendReceiptsNow(p.churchId);
  await logAudit({ churchId: p.churchId, actorId: me.id, action: "billing.manual_payment", targetTable: "church_subscriptions", targetId: p.churchId, metadata: { plan: p.plan, interval: p.interval, amount: p.amount, paid_until: periodEnd.toISOString() } });
  refresh(p.churchId);
  flash(`Payment recorded — paid up until ${periodEnd.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}. They've been sent a receipt.`);
  return { ok: true };
}

/** Send the "payment due" email now. Form fields: church_id */
export async function sendReminderNow(formData: FormData): Promise<void> {
  const me = await superAdmin();
  const id = uuid.safeParse(formData.get("church_id"));
  if (!me || !id.success) return;
  if (!emailConfigured()) {
    flash("Email isn't set up yet (MAKE_EMAIL_WEBHOOK_URL).", "error");
    return;
  }
  const admin = createAdminClient();
  const [{ data: sub }, { data: church }] = await Promise.all([
    admin.from("church_subscriptions").select("plan_key, billing_date, billing_interval, price_override, paystack_subscription_code").eq("church_id", id.data).maybeSingle(),
    admin.from("churches").select("name").eq("id", id.data).maybeSingle(),
  ]);
  const planKey = sub?.plan_key && sub.plan_key !== "free_trial" ? sub.plan_key : "basic";
  const { data: plan } = await admin.from("plans").select("monthly_price, yearly_price").eq("key", planKey).maybeSingle();
  const yearly = sub?.billing_interval === "yearly";
  const price = sub?.price_override != null && !yearly ? Number(sub.price_override) : Number((yearly ? plan?.yearly_price : plan?.monthly_price) ?? 0);
  const to = (await churchLeaders(id.data)).filter((l) => l.email).map((l) => ({ email: l.email!, name: l.name }));
  if (!to.length) {
    flash("This church has no active pastor or admin with an email.", "error");
    return;
  }
  const ok = await sendEmail({
    to,
    ...reminderEmail({
      churchName: church?.name ?? "your church",
      planKey,
      interval: yearly ? "yearly" : "monthly",
      amountCents: Math.round(price * 100),
      dueDate: sub?.billing_date && Date.parse(sub.billing_date) > Date.now() ? sub.billing_date : new Date().toISOString(),
      autoCharge: Boolean(sub?.paystack_subscription_code),
      billingUrl: absoluteLink("/dashboard/billing"),
    }),
  });
  await tellChurch(id.data, "Payment reminder", "Your Grace subscription payment is due. Open Billing to pay.");
  await logAudit({ churchId: id.data, actorId: me.id, action: "billing.reminder_sent_by_platform", targetTable: "church_subscriptions", targetId: id.data });
  flash(ok ? `Reminder sent to ${to.length} ${to.length === 1 ? "person" : "people"}.` : "Couldn't send the email — check the Make scenario.", ok ? "success" : "error");
}

/** Email the church's pastors and admins. Form fields: church_id, subject, message */
export async function emailChurchLeaders(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await superAdmin();
  if (!me) return { error: "Only platform admins can do this." };
  const p = z
    .object({ churchId: uuid, subject: z.string().trim().min(1, "Add a subject.").max(150), message: z.string().trim().min(1, "Write a message.").max(5000) })
    .safeParse({ churchId: formData.get("church_id"), subject: formData.get("subject") ?? "", message: formData.get("message") ?? "" });
  if (!p.success) return { error: p.error.issues[0]?.message };
  if (!emailConfigured()) return { error: "Email isn't set up yet (MAKE_EMAIL_WEBHOOK_URL)." };
  const to = (await churchLeaders(p.data.churchId)).filter((l) => l.email).map((l) => ({ email: l.email!, name: l.name }));
  if (!to.length) return { error: "This church has no active pastor or admin with an email." };
  const ok = await sendEmail({ to, subject: p.data.subject, ...simpleEmail(p.data.subject, p.data.message) });
  if (!ok) return { error: "Couldn't send — check the Make scenario." };
  await logAudit({ churchId: p.data.churchId, actorId: me.id, action: "church.emailed_by_platform", targetTable: "churches", targetId: p.data.churchId, metadata: { subject: p.data.subject } });
  flash(`Email sent to ${to.length} ${to.length === 1 ? "person" : "people"}.`);
  return { ok: true };
}

const BUCKETS = ["attachments", "avatars", "chat-media", "church-logos", "poster-assets", "sermon-audio", "sermon-video"];

/** Every file under `prefix` in a bucket (folders up to 5 deep). */
async function listAll(bucket: string, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 5) return [];
  const { data } = await createAdminClient().storage.from(bucket).list(prefix, { limit: 1000 });
  const out: string[] = [];
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (item.id) out.push(path);
    else out.push(...(await listAll(bucket, path, depth + 1)));
  }
  return out;
}

/**
 * Delete a church for good: its members' logins, all its data (the database
 * removes everything that belongs to the church) and its uploaded files.
 * Form fields: church_id, confirm_name (must match the church's name)
 */
export async function deleteChurch(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await superAdmin();
  if (!me) return { error: "Only platform admins can do this." };
  const id = uuid.safeParse(formData.get("church_id"));
  if (!id.success) return { error: "That church couldn't be found." };
  const admin = createAdminClient();
  const { data: church } = await admin.from("churches").select("id, name").eq("id", id.data).maybeSingle();
  if (!church) return { error: "That church couldn't be found." };
  if (String(formData.get("confirm_name") ?? "").trim() !== church.name.trim()) return { error: `Type the church's name exactly — “${church.name}” — to confirm.` };

  // 1. Logins (never a platform admin's).
  const { data: people } = await admin.from("app_users").select("id, role").eq("church_id", church.id);
  let failed = 0;
  for (const p of people ?? []) {
    if (p.role === "super_admin") continue;
    await admin.from("pastoral_care_logs").delete().eq("member_id", p.id);
    const { error } = await admin.auth.admin.deleteUser(p.id);
    if (error) failed++;
  }
  if (failed) return { error: `${failed} login(s) couldn't be deleted, so the church was kept. Try again.` };

  // 2. Files (best effort: anything left over is unreachable once the church is gone).
  for (const bucket of BUCKETS) {
    try {
      const files = await listAll(bucket, church.id);
      for (let i = 0; i < files.length; i += 100) await admin.storage.from(bucket).remove(files.slice(i, i + 100));
    } catch (error) {
      console.error(`[super-admin] file clean-up in ${bucket} failed:`, (error as Error).message);
    }
  }

  // 3. The church and everything that belongs to it.
  const { error } = await admin.from("churches").delete().eq("id", church.id);
  if (error) {
    console.error("[super-admin] church delete failed:", error.message);
    return { error: "The logins were removed but the church record couldn't be deleted — try again." };
  }
  await logAudit({ churchId: null, actorId: me.id, action: "church.deleted_by_platform", targetTable: "churches", targetId: church.id, metadata: { name: church.name, people: people?.length ?? 0 } });
  revalidatePath("/dashboard/super-admin/churches");
  revalidatePath("/dashboard/super-admin");
  flash(`${church.name} and all its data were deleted.`);
  redirect("/dashboard/super-admin/churches");
}
