import Link from "next/link";
import { BookMarked, Flame, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDate, todayInAppZone } from "@/lib/format";
import { planDayNumber, readingLabel, streak, type PlanDay } from "@/lib/reading-plans";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PlanForm } from "./PlanForm";

export const metadata = { title: "Reading plans" };

export default async function ReadingPlansPage() {
  const gate = await moduleGate("reading_plans");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const today = todayInAppZone();
  const [{ data: plans }, { data: joined }, { data: myTicks }] = await Promise.all([
    supabase.from("reading_plans").select("id, title, description, start_date, days, church_wide, created_by").eq("church_id", me.church_id).order("start_date", { ascending: false }).limit(100),
    supabase.from("reading_plan_members").select("plan_id, user_id").eq("church_id", me.church_id).limit(10000),
    supabase.from("reading_progress").select("plan_id, day, done_at").eq("user_id", me.id).limit(5000),
  ]);
  const ticks = myTicks ?? [];
  const myStreak = streak(ticks.map((t) => new Date(t.done_at).toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" })), today);
  const isMine = (id: string) => (joined ?? []).some((j) => j.plan_id === id && j.user_id === me.id);
  const readers = (id: string) => (joined ?? []).filter((j) => j.plan_id === id).length;
  const all = plans ?? [];
  const mine = all.filter((p) => isMine(p.id));
  const others = all.filter((p) => !isMine(p.id) && p.church_wide);

  const card = (p: (typeof all)[number]) => {
    const days = p.days as PlanDay[];
    const done = ticks.filter((t) => t.plan_id === p.id).length;
    const n = planDayNumber(p.start_date, today);
    const todayDay = n >= 1 && n <= days.length ? days[n - 1] : null;
    return (
      <li key={p.id}>
        <Link href={`/dashboard/reading-plans/${p.id}`} className="card-elevated block rounded-2xl p-4 hover:border-gold">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{p.title}</p>
            {p.church_wide && <StatusBadge tone="info">Whole church</StatusBadge>}
          </div>
          <p className="text-sm text-ink/60">
            {n < 1 ? `Starts ${formatDate(p.start_date)}` : n > days.length ? "Finished" : `Day ${n} of ${days.length}`}
            {p.church_wide ? ` · ${readers(p.id)} reading` : ""}
          </p>
          {todayDay && <p className="mt-1 text-sm font-medium text-ember">Today: {readingLabel(todayDay.readings)}</p>}
          {isMine(p.id) && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={done} aria-valuemax={days.length} aria-label="Your progress">
              <div className="h-full bg-success" style={{ width: `${Math.round((done / days.length) * 100)}%` }} />
            </div>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader back={{ href: "/dashboard/bible", label: "Bible" }} title="Reading plans" description="Read the Bible a little every day — on your own, or with the whole church." />
      <div className="flex flex-wrap items-center gap-3">
        <PlanForm today={today} canChurchWide={can(me.role, "postChurchWide")} />
        {myStreak > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ember/10 px-3 py-1.5 text-sm font-semibold text-ember">
            <Flame aria-hidden className="h-4 w-4" /> {myStreak}-day streak
          </span>
        )}
      </div>
      {!all.length && <EmptyState icon={BookMarked} title="No reading plans yet" description="Start one — the Gospel of John is a good first plan." />}
      {mine.length > 0 && (
        <section aria-labelledby="mine-h" className="space-y-3">
          <h2 id="mine-h" className="text-lg font-semibold">My plans</h2>
          <ul className="space-y-3">{mine.map(card)}</ul>
        </section>
      )}
      {others.length > 0 && (
        <section aria-labelledby="church-h" className="space-y-3">
          <h2 id="church-h" className="flex items-center gap-2 text-lg font-semibold">
            <Users aria-hidden className="h-5 w-5 text-gold" /> Church plans to join
          </h2>
          <ul className="space-y-3">{others.map(card)}</ul>
        </section>
      )}
    </div>
  );
}
