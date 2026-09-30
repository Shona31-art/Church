import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function SetupWizardPage() {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "church_admin") {
    return <p className="text-ink/60">Only church admins can access setup.</p>;
  }

  const supabase = createClient();

  const { data: church } = await supabase
    .from("churches")
    .select("logo_url, address, phone, email")
    .eq("id", me.church_id)
    .single();

  const { data: subscription } = await supabase
    .from("church_subscriptions")
    .select("plan_key")
    .eq("church_id", me.church_id)
    .single();

  const { data: planModules } = await supabase
    .from("plan_modules")
    .select("module_key, modules(name)")
    .eq("plan_key", subscription?.plan_key ?? "free_trial");

  const { count: departmentCount } = await supabase
    .from("departments")
    .select("*", { count: "exact", head: true })
    .eq("church_id", me.church_id);

  const { count: memberCount } = await supabase
    .from("app_users")
    .select("*", { count: "exact", head: true })
    .eq("church_id", me.church_id);

  const profileComplete = Boolean(church?.address || church?.phone);

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-2">Set up your church</h1>
      <p className="text-ink/50 text-sm mb-8">
        A few quick steps to get your church ready. You can always come back
        and change these later.
      </p>

      <div className="space-y-4">
        <StepCard
          number={1}
          title="Church profile"
          done={profileComplete}
          description="Logo, address, and contact details"
          href="/dashboard/setup/profile"
        />

        <div className="border border-ink/10 rounded-xl p-4 bg-white/60">
          <p className="text-sm font-medium mb-2">Step 2 · Your plan's modules</p>
          <p className="text-xs text-ink/40 mb-3">
            You're on the <span className="capitalize">{subscription?.plan_key?.replace("_", " ")}</span> plan.
            These modules are included — module access is tied to your plan
            rather than manually toggled, so upgrading unlocks more
            automatically.
          </p>
          <ul className="text-sm text-ink/70 flex flex-wrap gap-2">
            {planModules?.map((m: any) => (
              <li key={m.module_key} className="bg-ink/5 px-2 py-1 rounded">
                {m.modules?.name}
              </li>
            ))}
          </ul>
        </div>

        <StepCard
          number={3}
          title="Create departments"
          done={(departmentCount ?? 0) > 0}
          description={`${departmentCount ?? 0} department(s) created`}
          href="/dashboard/departments"
        />

        <StepCard
          number={4}
          title="Invite members"
          done={(memberCount ?? 0) > 1}
          description={`${memberCount ?? 0} member(s) so far`}
          href="/dashboard/members/new"
        />
      </div>

      <Link
        href="/dashboard"
        className="inline-block mt-8 text-sm text-ember"
      >
        Skip for now → go to dashboard
      </Link>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
  href,
  done,
}: {
  number: number;
  title: string;
  description: string;
  href: string;
  done: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border border-ink/10 rounded-xl p-4 bg-white/60 hover:bg-white"
    >
      <div>
        <p className="text-sm font-medium">
          Step {number} · {title}
        </p>
        <p className="text-xs text-ink/40">{description}</p>
      </div>
      <span className={done ? "text-green-700 text-sm" : "text-ink/30 text-sm"}>
        {done ? "✓ Done" : "→"}
      </span>
    </Link>
  );
}
