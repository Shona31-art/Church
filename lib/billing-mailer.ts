import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendEmail } from "@/lib/email";
import { absoluteLink } from "@/lib/alert-delivery";
import { SELF_SERVE_PLANS } from "@/lib/billing";
import { REMINDER_DAYS_BEFORE, receiptEmail, reminderEmail } from "@/lib/billing-emails";

// Billing emails from Grace-bound Ventures to a church's pastors and admins
// (billing_v4.sql): a reminder a few days before each payment date, and a
// receipt with the invoice after each successful payment. Best effort — a
// failure is logged and retried by the nightly job; nothing is sent when no
// email provider is set up (lib/email.ts).

/** Receipts older than this aren't sent late (e.g. when email is first switched on). */
const RECEIPT_WINDOW_DAYS = 7;

/** The church's active pastors and church admins with an email address. */
async function recipients(churchId: string) {
  const { data } = await createAdminClient()
    .from("app_users")
    .select("email, name")
    .eq("church_id", churchId)
    .eq("status", "active")
    .in("role", ["pastor", "church_admin"]);
  const seen = new Set<string>();
  return ((data ?? []) as { email: string | null; name: string | null }[]).filter((u) => {
    const key = u.email?.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }) as { email: string; name: string | null }[];
}

/**
 * Nightly: reminders for payments due in the next few days. Each payment date
 * is reminded once (church_subscriptions.reminder_sent_for). Returns how many
 * churches were emailed.
 */
export async function sendPaymentReminders(now: Date = new Date()): Promise<number> {
  if (!emailConfigured()) return 0;
  const admin = createAdminClient();
  const until = new Date(now.getTime() + REMINDER_DAYS_BEFORE * 86_400_000).toISOString();
  const { data: due, error } = await admin
    .from("church_subscriptions")
    .select("church_id, plan_key, billing_date, billing_interval, price_override, paystack_subscription_code, reminder_sent_for, churches(name)")
    .in("status", ["active", "grace"])
    .eq("is_lifetime", false)
    .is("cancelled_at", null)
    .in("plan_key", [...SELF_SERVE_PLANS])
    .gt("billing_date", now.toISOString())
    .lte("billing_date", until)
    .limit(200);
  if (error) {
    if (!/reminder_sent_for/.test(error.message)) throw new Error(error.message);
    return 0; // billing_v4.sql not run yet
  }
  if (!due?.length) return 0;

  const { data: plans } = await admin.from("plans").select("key, monthly_price, yearly_price").in("key", [...SELF_SERVE_PLANS]);
  let sent = 0;
  for (const sub of due as any[]) {
    if (sub.reminder_sent_for && new Date(sub.reminder_sent_for).getTime() === new Date(sub.billing_date).getTime()) continue;
    const plan = (plans ?? []).find((p: any) => p.key === sub.plan_key);
    const yearly = sub.billing_interval === "yearly";
    const price = sub.price_override != null && !yearly ? Number(sub.price_override) : Number(yearly ? plan?.yearly_price : plan?.monthly_price);
    if (!(price > 0)) continue; // sponsored / free
    const to = await recipients(sub.church_id);
    if (!to.length) continue;

    // Claim this payment date first, so two runs can't both send it.
    const { data: claimed } = await admin
      .from("church_subscriptions")
      .update({ reminder_sent_for: sub.billing_date })
      .eq("church_id", sub.church_id)
      .eq("billing_date", sub.billing_date)
      .or(`reminder_sent_for.is.null,reminder_sent_for.neq.${sub.billing_date}`)
      .select("church_id");
    if (!claimed?.length) continue;

    const email = reminderEmail({
      churchName: sub.churches?.name ?? "your church",
      planKey: sub.plan_key,
      interval: yearly ? "yearly" : "monthly",
      amountCents: Math.round(price * 100),
      dueDate: sub.billing_date,
      autoCharge: Boolean(sub.paystack_subscription_code),
      billingUrl: absoluteLink("/dashboard/billing"),
    });
    if (await sendEmail({ to, ...email })) sent++;
    else await admin.from("church_subscriptions").update({ reminder_sent_for: sub.reminder_sent_for ?? null }).eq("church_id", sub.church_id); // try again tomorrow
  }
  return sent;
}

/**
 * Receipts for successful payments not emailed yet (one church, or all — the
 * nightly job). Each is sent once (billing_payments.receipt_sent_at).
 */
export async function sendPaymentReceipts(churchId?: string): Promise<number> {
  if (!emailConfigured()) return 0;
  const admin = createAdminClient();
  const since = new Date(Date.now() - RECEIPT_WINDOW_DAYS * 86_400_000).toISOString();
  let query = admin
    .from("billing_payments")
    .select("*, churches(name)")
    .eq("status", "succeeded")
    .is("receipt_sent_at", null)
    .gte("paid_at", since)
    .order("paid_at")
    .limit(100);
  if (churchId) query = query.eq("church_id", churchId);
  const { data: payments, error } = await query;
  if (error) {
    if (!/receipt_sent_at/.test(error.message)) throw new Error(error.message);
    return 0; // billing_v4.sql not run yet
  }

  let sent = 0;
  for (const p of (payments ?? []) as any[]) {
    if (p.invoice_no == null) continue;
    const to = await recipients(p.church_id);
    if (!to.length) continue;
    const stamp = new Date().toISOString();
    const { data: claimed } = await admin.from("billing_payments").update({ receipt_sent_at: stamp }).eq("id", p.id).is("receipt_sent_at", null).select("id");
    if (!claimed?.length) continue;
    const email = receiptEmail({
      churchName: p.churches?.name ?? "your church",
      invoiceNo: p.invoice_no,
      planKey: p.plan_key,
      interval: p.interval === "yearly" ? "yearly" : "monthly",
      kind: p.kind === "renewal" ? "renewal" : p.kind === "manual" ? "manual" : "checkout",
      amountCents: p.amount_cents,
      paidAt: p.paid_at ?? p.created_at,
      periodEnd: p.period_end,
      reference: p.reference,
      invoiceUrl: absoluteLink(`/dashboard/billing/invoice/${p.id}`),
    });
    if (await sendEmail({ to, ...email })) sent++;
    else await admin.from("billing_payments").update({ receipt_sent_at: null }).eq("id", p.id); // try again tonight
  }
  return sent;
}

/** Right after a payment is recorded: that church's receipt. Never throws. */
export async function sendReceiptsNow(churchId: string): Promise<void> {
  try {
    await sendPaymentReceipts(churchId);
  } catch (error) {
    console.error("[billing] receipt email failed (the nightly job retries):", error instanceof Error ? error.message : error);
  }
}
