import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { GivingForm } from "./GivingForm";
import { moduleGate } from "@/lib/gate";

export default async function GivingPage({
  searchParams,
}: {
  searchParams: { given?: string };
}) {
  const gate = await moduleGate("giving");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: myGivings } = await supabase
    .from("givings")
    .select("*")
    .eq("user_id", me!.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const totalThisYear = (myGivings || [])
    .filter((g) => g.status === "succeeded" && new Date(g.created_at).getFullYear() === new Date().getFullYear())
    .reduce((sum, g) => sum + g.amount_cents, 0);

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-1">Giving</h1>
      <p className="text-sm text-ink/50 mb-6">
        Give securely by card. You'll always be able to see your own giving
        history here.
      </p>
      {me?.role === "church_admin" && (
        <Link href="/dashboard/giving/report" className="text-xs text-ember block mb-6">
          View church giving report →
        </Link>
      )}

      {searchParams.given === "success" && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          Thank you — your payment is processing and will appear below shortly.
        </p>
      )}
      {searchParams.given === "cancelled" && (
        <p className="text-sm text-ink/50 bg-ink/5 rounded-lg p-3 mb-4">Checkout cancelled.</p>
      )}

      {!stripeConfigured && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
          Online giving isn't configured yet — your church admin needs to set
          up Stripe (see README).
        </p>
      )}

      <GivingForm disabled={!stripeConfigured} />

      <div className="mt-10">
        <p className="text-xs uppercase tracking-wide text-ink/50 mb-1">This year</p>
        <p className="text-2xl font-semibold mb-6">R{(totalThisYear / 100).toFixed(2)}</p>

        <p className="text-xs uppercase tracking-wide text-ink/50 mb-3">Recent giving</p>
        <div className="space-y-2">
          {myGivings?.map((g) => (
            <div key={g.id} className="card-elevated rounded-lg px-4 py-3 flex justify-between text-sm">
              <div>
                <p className="capitalize">{g.fund.replace("_", " ")}</p>
                <p className="text-xs text-ink/40">{new Date(g.created_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">R{(g.amount_cents / 100).toFixed(2)}</p>
                <p className={`text-xs ${g.status === "succeeded" ? "text-green-700" : g.status === "failed" ? "text-red-700" : "text-amber-700"}`}>
                  {g.status}
                </p>
              </div>
            </div>
          ))}
          {!myGivings?.length && <p className="text-ink/40 text-sm">No giving history yet.</p>}
        </div>
      </div>
    </div>
  );
}
