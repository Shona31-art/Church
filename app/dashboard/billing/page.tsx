import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { openBillingPortal } from "./actions";
import { CheckoutButton } from "./CheckoutButton";

const PLAN_INFO: Record<string, { name: string; price: string; blurb: string }> = {
  basic: { name: "Basic", price: "R299/month", blurb: "200 members, core modules" },
  premium: { name: "Premium", price: "R799/month", blurb: "Unlimited members, AI tools, everything" },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { checkout?: string };
}) {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "church_admin") {
    return <p className="text-ink/60">Only church admins can manage billing.</p>;
  }

  const supabase = createClient();
  const { data: subscription } = await supabase
    .from("church_subscriptions")
    .select("*")
    .eq("church_id", me.church_id)
    .single();

  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const currentPlan = subscription?.plan_key;

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-2">Billing</h1>

      {searchParams.checkout === "success" && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          Payment successful — your plan will update within a few seconds
          once Stripe's webhook confirms it.
        </p>
      )}
      {searchParams.checkout === "cancelled" && (
        <p className="text-sm text-ink/50 bg-ink/5 rounded-lg p-3 mb-4">Checkout cancelled.</p>
      )}

      <div className="border border-ink/10 rounded-xl p-4 bg-white/60 mb-6">
        <p className="text-sm text-ink/40 mb-1">Current plan</p>
        <p className="text-lg font-medium capitalize">
          {currentPlan?.replace("_", " ") ?? "None"}
          {subscription?.is_lifetime && <span className="text-ember text-sm ml-2">(lifetime)</span>}
        </p>
        <p className="text-sm text-ink/50">
          Status: <span className="capitalize">{subscription?.status?.replace("_", " ")}</span>
          {subscription?.trial_expires_at && subscription.status === "trial" && (
            <> · trial ends {new Date(subscription.trial_expires_at).toLocaleDateString()}</>
          )}
        </p>

        {subscription?.stripe_customer_id && (
          <form action={openBillingPortal} className="mt-3">
            <button type="submit" className="text-sm text-ember">
              Manage payment method / invoices →
            </button>
          </form>
        )}
      </div>

      {!stripeConfigured && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
          Billing isn't configured yet — set STRIPE_SECRET_KEY,
          STRIPE_PRICE_BASIC, STRIPE_PRICE_PREMIUM, and STRIPE_WEBHOOK_SECRET
          to enable real checkout. Super Admin can still change a church's
          plan manually in the meantime.
        </p>
      )}

      <div className="space-y-3">
        {Object.entries(PLAN_INFO).map(([key, info]) => (
          <div
            key={key}
            className="flex items-center justify-between border border-ink/10 rounded-xl p-4 bg-white/60"
          >
            <div>
              <p className="font-medium">{info.name}</p>
              <p className="text-sm text-ink/50">
                {info.price} · {info.blurb}
              </p>
            </div>
            {currentPlan === key ? (
              <span className="text-xs text-green-700">Current plan</span>
            ) : stripeConfigured ? (
              <CheckoutButton planKey={key} label={currentPlan === "free_trial" ? "Subscribe" : "Switch"} />
            ) : (
              <span className="text-xs text-ink/30">Not available</span>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-ink/30 mt-6">
        Enterprise plan is custom pricing — contact support to arrange it.
      </p>
    </div>
  );
}
