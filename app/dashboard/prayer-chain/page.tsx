import Link from "next/link";
import { Timer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDateTime, localInputToUtcIso, todayInAppZone, utcIsoToLocalInput } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChainForm } from "./ChainForm";

export const metadata = { title: "Prayer chain" };

export default async function PrayerChainsPage() {
  const gate = await moduleGate("prayer_chain");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  const { data } = await createClient().from("prayer_chains").select("id, title, starts_at, ends_at").eq("church_id", me.church_id).order("starts_at", { ascending: false }).limit(50);
  const now = Date.now();
  const chains = data ?? [];
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader back={{ href: "/dashboard", label: "Home" }} title="Prayer chain" description="Pray around the clock together — book a slot and we'll remind you before it starts." />
      {can(me.role, "postChurchWide") && <ChainForm defaultStart={utcIsoToLocalInput(localInputToUtcIso(`${todayInAppZone()}T18:00`))} />}
      {!chains.length ? (
        <EmptyState icon={Timer} title="No prayer chains yet" description="When your church holds a fast or a week of prayer, book your slot here." />
      ) : (
        <ul className="space-y-3">
          {chains.map((c) => {
            const state = now < Date.parse(c.starts_at) ? "Starts soon" : now < Date.parse(c.ends_at) ? "Praying now" : "Finished";
            return (
              <li key={c.id}>
                <Link href={`/dashboard/prayer-chain/${c.id}`} className="card-elevated block rounded-2xl p-4 hover:border-gold">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{c.title}</p>
                    <StatusBadge tone={state === "Praying now" ? "success" : state === "Starts soon" ? "info" : "neutral"}>{state}</StatusBadge>
                  </div>
                  <p className="text-sm text-ink/60">
                    {formatDateTime(c.starts_at)} – {formatDateTime(c.ends_at)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
