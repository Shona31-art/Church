import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { PLAN_LABELS } from "@/lib/subscription";
import { invoiceNumber } from "@/lib/billing-emails";
import { formatDate, formatMoney } from "@/lib/format";
import { APP_NAME, COMPANY_NAME } from "@/lib/brand";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { PrintButton } from "@/components/ui/PrintButton";

export const metadata = { title: "Invoice" };

/** A paid subscription payment as a printable invoice (church admins; RLS: their church's payments). */
export default async function InvoicePage({ params }: { params: { id: string } }) {
  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageBilling")) return <PermissionDenied message="Only church admins can see invoices." />;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const supabase = createClient();
  const [{ data: p }, { data: church }] = await Promise.all([
    supabase.from("billing_payments").select("*").eq("id", params.id).eq("church_id", me.church_id).eq("status", "succeeded").maybeSingle(),
    supabase.from("churches").select("name, email, phone").eq("id", me.church_id).maybeSingle(),
  ]);
  if (!p) notFound();

  const plan = PLAN_LABELS[p.plan_key] ?? p.plan_key;
  const yearly = p.interval === "yearly";
  const no = p.invoice_no != null ? invoiceNumber(p.invoice_no) : p.reference;
  const details = (process.env.INVOICE_COMPANY_DETAILS ?? "").split("\\n").join("\n").trim();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="print:hidden">
        <PageHeader title={`Invoice ${no}`} back={{ href: "/dashboard/billing", label: "Billing" }} actions={<PrintButton />} />
      </div>

      <article className="card-elevated rounded-2xl p-6 sm:p-8 print:shadow-none print:border-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="text-xl font-bold">{COMPANY_NAME}</p>
            <p className="text-sm text-ink/60">{APP_NAME} church app</p>
            {details && <p className="mt-2 whitespace-pre-line text-xs text-ink/60">{details}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">Invoice</p>
            <p className="text-sm tabular-nums">{no}</p>
            <p className="mt-1 inline-block rounded-full bg-success/15 px-3 py-0.5 text-xs font-semibold text-success">Paid</p>
          </div>
        </header>

        <section className="grid gap-4 py-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Billed to</p>
            <p className="mt-1 font-medium">{church?.name ?? "Your church"}</p>
            {church?.email && <p className="text-ink/70">{church.email}</p>}
            {church?.phone && <p className="text-ink/70">{church.phone}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Date paid</p>
            <p className="mt-1">{formatDate(p.paid_at ?? p.created_at, { weekday: undefined, month: "long" })}</p>
            {p.period_end && (
              <>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink/50">Paid until</p>
                <p className="mt-1">{formatDate(p.period_end, { weekday: undefined, month: "long" })}</p>
              </>
            )}
          </div>
        </section>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left text-xs uppercase tracking-wide text-ink/50">
              <th className="py-2 font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <td className="py-3">
                {APP_NAME} {plan} plan — {yearly ? "1 year" : "1 month"}
                {p.kind === "renewal" ? " (renewal)" : ""}
              </td>
              <td className="py-3 text-right tabular-nums">{formatMoney(p.amount_cents)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-3 text-right font-semibold">Total paid</td>
              <td className="pt-3 text-right text-lg font-bold tabular-nums">{formatMoney(p.amount_cents)}</td>
            </tr>
          </tfoot>
        </table>

        <footer className="mt-6 space-y-1 border-t border-line pt-4 text-xs text-ink/60">
          <p>Paid by card through Paystack · Reference {p.reference}</p>
          <p>Thank you for supporting {APP_NAME} — it keeps the app running and growing for churches like yours.</p>
        </footer>
      </article>
    </div>
  );
}
