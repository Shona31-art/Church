import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { logAudit } from "@/lib/audit";

export default async function ChurchDetailPage({ params }: { params: { id: string } }) {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") {
    return <p className="text-ink/60">Super Admin access only.</p>;
  }

  const supabase = createClient();

  const { data: church } = await supabase.from("churches").select("*").eq("id", params.id).single();
  if (!church) notFound();

  const { data: subscription } = await supabase
    .from("church_subscriptions")
    .select("*")
    .eq("church_id", params.id)
    .maybeSingle();

  const { data: allModules } = await supabase.from("modules").select("key, name").order("key");
  const { data: overrides } = await supabase
    .from("church_modules")
    .select("module_key, enabled")
    .eq("church_id", params.id);

  const { count: memberCount } = await supabase
    .from("app_users")
    .select("*", { count: "exact", head: true })
    .eq("church_id", params.id);

  const overrideMap = new Map((overrides || []).map((o) => [o.module_key, o.enabled]));

  // --- Server actions ---

  async function updateSubscription(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me || me.role !== "super_admin") return;

    const supabase = createClient();
    const planKey = String(formData.get("plan_key"));
    const status = String(formData.get("status"));
    const isLifetime = formData.get("is_lifetime") === "on";
    const trialExpiresAt = String(formData.get("trial_expires_at") || "") || null;
    const gracePeriodEnd = String(formData.get("grace_period_end") || "") || null;
    const notes = String(formData.get("notes") || "");

    const payload = {
      plan_key: planKey,
      status,
      is_lifetime: isLifetime,
      trial_expires_at: trialExpiresAt,
      grace_period_end: gracePeriodEnd,
      notes,
    };

    const { data: existing } = await supabase
      .from("church_subscriptions")
      .select("id")
      .eq("church_id", params.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("church_subscriptions").update(payload).eq("church_id", params.id);
    } else {
      await supabase.from("church_subscriptions").insert({ church_id: params.id, ...payload });
    }

    await logAudit({
      churchId: params.id,
      actorId: me.id,
      action: "subscription.updated",
      targetTable: "church_subscriptions",
      targetId: params.id,
      metadata: payload,
    });

    redirect(`/dashboard/super-admin/churches/${params.id}`);
  }

  async function toggleModule(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me || me.role !== "super_admin") return;

    const moduleKey = String(formData.get("module_key"));
    const enabled = formData.get("enabled") === "true";

    const supabase = createClient();
    await supabase
      .from("church_modules")
      .upsert({ church_id: params.id, module_key: moduleKey, enabled, set_by: me.id });

    await logAudit({
      churchId: params.id,
      actorId: me.id,
      action: `module.${enabled ? "enabled" : "disabled"}`,
      targetTable: "church_modules",
      metadata: { module_key: moduleKey },
    });

    redirect(`/dashboard/super-admin/churches/${params.id}`);
  }

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">{church.name}</h1>
        <p className="text-sm text-ink/40">{memberCount} member(s)</p>
      </div>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-ink/50 mb-3">Subscription</h2>
        <form action={updateSubscription} className="space-y-4">
          <select
            name="plan_key"
            defaultValue={subscription?.plan_key ?? "free_trial"}
            className="w-full border border-ink/20 rounded-lg px-4 py-3"
          >
            <option value="free_trial">Free Trial</option>
            <option value="basic">Basic</option>
            <option value="premium">Premium</option>
            <option value="enterprise">Enterprise</option>
            <option value="sponsored">Sponsored</option>
          </select>

          <select
            name="status"
            defaultValue={subscription?.status ?? "trial"}
            className="w-full border border-ink/20 rounded-lg px-4 py-3"
          >
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="payment_pending">Payment Pending</option>
            <option value="grace">Grace Period</option>
            <option value="suspended">Suspended</option>
          </select>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_lifetime"
              defaultChecked={subscription?.is_lifetime}
            />
            Lifetime access (never expires, overrides all status checks)
          </label>

          <div>
            <label className="text-xs text-ink/40">Trial expires</label>
            <input
              type="date"
              name="trial_expires_at"
              defaultValue={subscription?.trial_expires_at?.slice(0, 10) ?? ""}
              className="w-full border border-ink/20 rounded-lg px-4 py-3"
            />
          </div>

          <div>
            <label className="text-xs text-ink/40">Grace period ends</label>
            <input
              type="date"
              name="grace_period_end"
              defaultValue={subscription?.grace_period_end?.slice(0, 10) ?? ""}
              className="w-full border border-ink/20 rounded-lg px-4 py-3"
            />
          </div>

          <textarea
            name="notes"
            placeholder="Internal notes, e.g. 'Sponsored by Super Admin — Grace Church'"
            defaultValue={subscription?.notes ?? ""}
            className="w-full border border-ink/20 rounded-lg px-4 py-3"
          />

          <button type="submit" className="bg-ember text-white px-6 py-3 rounded-lg font-medium">
            Save subscription
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-ink/50 mb-3">
          Module overrides
        </h2>
        <p className="text-xs text-ink/40 mb-3">
          Overrides take precedence over the plan's default modules — use
          this to grant early access to a specific church, or to lock
          something off regardless of plan.
        </p>
        <div className="space-y-2">
          {allModules?.map((m) => {
            const override = overrideMap.get(m.key);
            return (
              <div
                key={m.key}
                className="flex items-center justify-between border border-ink/10 rounded-lg px-4 py-2"
              >
                <span className="text-sm">
                  {m.name}
                  {override !== undefined && (
                    <span className="ml-2 text-xs text-ember">
                      (override: {override ? "forced on" : "forced off"})
                    </span>
                  )}
                </span>
                <div className="flex gap-2">
                  <form action={toggleModule}>
                    <input type="hidden" name="module_key" value={m.key} />
                    <input type="hidden" name="enabled" value="true" />
                    <button type="submit" className="text-xs text-green-700">
                      Force on
                    </button>
                  </form>
                  <form action={toggleModule}>
                    <input type="hidden" name="module_key" value={m.key} />
                    <input type="hidden" name="enabled" value="false" />
                    <button type="submit" className="text-xs text-red-700">
                      Force off
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
