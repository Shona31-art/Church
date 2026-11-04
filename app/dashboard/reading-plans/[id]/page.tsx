import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BookOpen, Check, Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDate, todayInAppZone } from "@/lib/format";
import { bookIndexByName, readerHref } from "@/lib/bible/books";
import { planDayNumber, readingLabel, streak, type PlanDay } from "@/lib/reading-plans";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { deleteReadingPlan, joinReadingPlan, tickReadingDay } from "../actions";

export const metadata = { title: "Reading plan" };

const localDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });

export default async function ReadingPlanPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("reading_plans");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const { data: plan } = await supabase.from("reading_plans").select("*").eq("id", params.id).eq("church_id", me.church_id).maybeSingle();
  if (!plan) notFound();
  const [{ data: members }, { data: progress }] = await Promise.all([
    supabase.from("reading_plan_members").select("user_id").eq("plan_id", plan.id),
    supabase.from("reading_progress").select("user_id, day, done_at").eq("plan_id", plan.id).limit(20000),
  ]);
  const days = plan.days as PlanDay[];
  const today = todayInAppZone();
  const n = planDayNumber(plan.start_date, today);
  const mineDone = new Set((progress ?? []).filter((p) => p.user_id === me.id).map((p) => p.day));
  const joined = (members ?? []).some((m) => m.user_id === me.id);
  const myStreak = streak((progress ?? []).filter((p) => p.user_id === me.id).map((p) => localDay(p.done_at)), today);
  const readToday = new Set((progress ?? []).filter((p) => localDay(p.done_at) === today).map((p) => p.user_id)).size;
  const canDelete = plan.created_by === me.id || (plan.church_wide && can(me.role, "postChurchWide"));
  // Show from a few days before today, so catching up is easy.
  const firstShown = Math.max(1, Math.min(n, days.length) - 3);

  const dayRow = (d: PlanDay, i: number) => {
    const num = i + 1;
    const done = mineDone.has(num);
    const isToday = num === n;
    const first = d.readings[0];
    const bi = bookIndexByName(first.book);
    return (
      <li key={num} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${isToday ? "bg-gold/10 ring-1 ring-gold/40" : ""}`}>
        <form action={tickReadingDay}>
          <input type="hidden" name="plan_id" value={plan.id} />
          <input type="hidden" name="day" value={num} />
          <input type="hidden" name="done" value={done ? "0" : "1"} />
          <button
            type="submit"
            aria-label={done ? `Untick day ${num}` : `Mark day ${num} as read`}
            aria-pressed={done}
            className={`grid h-8 w-8 place-items-center rounded-full border-2 ${done ? "border-success bg-success text-white" : "border-line-strong"}`}
          >
            {done && <Check aria-hidden className="h-4 w-4" />}
          </button>
        </form>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${done ? "text-ink/50 line-through" : ""}`}>{readingLabel(d.readings)}</p>
          <p className="text-xs text-ink/50">
            Day {num}
            {isToday ? " · Today" : ` · ${formatDate(new Date(Date.parse(`${plan.start_date}T12:00:00Z`) + i * 86_400_000).toISOString())}`}
          </p>
        </div>
        {bi >= 0 && (
          <Link href={readerHref({ bookIndex: bi, chapter: first.chapter })} className="btn-ghost btn-sm" aria-label={`Read ${readingLabel(d.readings)}`}>
            <BookOpen aria-hidden className="h-4 w-4" /> Read
          </Link>
        )}
      </li>
    );
  };

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader back={{ href: "/dashboard/reading-plans", label: "Reading plans" }} title={plan.title} description={plan.description ?? undefined} />
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="card-elevated rounded-2xl p-3">
          <p className="text-2xl font-bold tabular-nums">
            {mineDone.size}/{days.length}
          </p>
          <p className="text-xs text-ink/60">days read</p>
        </div>
        <div className="card-elevated rounded-2xl p-3">
          <p className="flex items-center justify-center gap-1 text-2xl font-bold tabular-nums text-ember">
            <Flame aria-hidden className="h-5 w-5" />
            {myStreak}
          </p>
          <p className="text-xs text-ink/60">day streak</p>
        </div>
        <div className="card-elevated rounded-2xl p-3">
          <p className="text-2xl font-bold tabular-nums">{plan.church_wide ? (members ?? []).length : n < 1 ? 0 : Math.min(n, days.length)}</p>
          <p className="text-xs text-ink/60">{plan.church_wide ? "reading along" : "day of plan"}</p>
        </div>
      </div>
      {plan.church_wide && <p className="text-sm text-ink/70">{readToday ? `${readToday} ${readToday === 1 ? "person has" : "people have"} read today.` : "Be the first to read today!"}</p>}
      {plan.church_wide && (
        <form action={joinReadingPlan}>
          <input type="hidden" name="plan_id" value={plan.id} />
          <input type="hidden" name="join" value={joined ? "0" : "1"} />
          <PendingButton className={joined ? "btn-ghost btn-sm" : "btn-primary"} pendingLabel="Saving…">
            {joined ? "Leave this plan" : "Join the church in this plan"}
          </PendingButton>
        </form>
      )}
      {n < 1 && <p className="rounded-xl bg-ink/5 p-3 text-sm">This plan starts on {formatDate(plan.start_date, { month: "long" })}.</p>}

      <Section title="Readings">
        {firstShown > 1 && (
          <details className="mb-2">
            <summary className="cursor-pointer text-sm text-ink/60">Earlier days (1–{firstShown - 1})</summary>
            <ol className="mt-2 space-y-1">{days.slice(0, firstShown - 1).map((d, i) => dayRow(d, i))}</ol>
          </details>
        )}
        <ol className="space-y-1">{days.slice(firstShown - 1).map((d, i) => dayRow(d, i + firstShown - 1))}</ol>
      </Section>

      {canDelete && (
        <form action={deleteReadingPlan} className="flex justify-end">
          <input type="hidden" name="plan_id" value={plan.id} />
          <ConfirmSubmitButton title="Delete this plan?" message={plan.church_wide ? "It will be removed for everyone, with their progress." : "Your progress will be removed."} confirmLabel="Delete" pendingLabel="Deleting…">
            Delete plan
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
