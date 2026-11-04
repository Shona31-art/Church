import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { APP_TIMEZONE, formatDateTime } from "@/lib/format";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { bookPrayerSlot, deletePrayerChain } from "../actions";

export const metadata = { title: "Prayer chain" };

const time = (ms: number) => new Date(ms).toLocaleTimeString("en-ZA", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString("en-ZA", { timeZone: APP_TIMEZONE, weekday: "long", day: "numeric", month: "long" });

export default async function PrayerChainPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("prayer_chain");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const { data: chain } = await supabase.from("prayer_chains").select("*").eq("id", params.id).eq("church_id", me.church_id).maybeSingle();
  if (!chain) notFound();
  const { data: bookings } = await supabase
    .from("prayer_chain_slots")
    .select("slot_start, user_id, person:app_users!prayer_chain_slots_user_id_fkey(name)")
    .eq("chain_id", chain.id)
    .order("slot_start")
    .limit(10000);
  const shepherd = can(me.role, "postChurchWide");
  const step = chain.slot_minutes * 60_000;
  const start = Date.parse(chain.starts_at);
  const end = Date.parse(chain.ends_at);
  const now = Date.now();

  const bySlot = new Map<number, { user_id: string; name: string }[]>();
  for (const b of (bookings ?? []) as any[]) {
    const k = Date.parse(b.slot_start);
    bySlot.set(k, [...(bySlot.get(k) ?? []), { user_id: b.user_id, name: b.person?.name ?? "Former member" }]);
  }
  const slots: number[] = [];
  for (let t = start; t < end; t += step) slots.push(t);
  const covered = slots.filter((t) => (bySlot.get(t)?.length ?? 0) > 0).length;
  const mine = slots.filter((t) => bySlot.get(t)?.some((p) => p.user_id === me.id));
  const days = new Map<string, number[]>();
  for (const t of slots) days.set(dayLabel(t), [...(days.get(dayLabel(t)) ?? []), t]);

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader back={{ href: "/dashboard/prayer-chain", label: "Prayer chain" }} title={chain.title} description={`${formatDateTime(chain.starts_at)} – ${formatDateTime(chain.ends_at)}`} />
      {chain.description && <p className="whitespace-pre-line rounded-xl bg-gold/10 p-4 text-sm">{chain.description}</p>}
      <div className="card-elevated rounded-2xl p-4">
        <p className="text-sm font-semibold">
          {covered} of {slots.length} slots covered
        </p>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={covered} aria-valuemax={slots.length} aria-label="Slots covered">
          <div className="h-full bg-success" style={{ width: `${Math.round((covered / Math.max(1, slots.length)) * 100)}%` }} />
        </div>
        {mine.length > 0 && <p className="mt-3 text-sm">Your slots: {mine.map((t) => `${dayLabel(t).split(",")[0]} ${time(t)}`).join(" · ")}</p>}
      </div>

      {[...days.entries()].map(([label, ts]) => (
        <Section key={label} title={label}>
          <ul className="divide-y divide-line">
            {ts.map((t) => {
              const people = bySlot.get(t) ?? [];
              const booked = people.some((p) => p.user_id === me.id);
              const over = t + step <= now;
              const full = people.length >= chain.max_per_slot;
              const iso = new Date(t).toISOString();
              return (
                <li key={t} className={`flex flex-wrap items-center gap-3 py-2.5 ${over ? "opacity-50" : ""}`}>
                  <span className="w-28 shrink-0 text-sm font-semibold tabular-nums">
                    {time(t)}–{time(t + step)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-ink/70">
                    {people.length ? people.map((p) => p.name.split(" ")[0]).join(", ") : <span className="text-ink/40">Open</span>}
                    {shepherd && people.length > 0 && !over && (
                      <span className="ml-2 inline-flex flex-wrap gap-1">
                        {people
                          .filter((p) => p.user_id !== me.id)
                          .map((p) => (
                            <form key={p.user_id} action={bookPrayerSlot}>
                              <input type="hidden" name="chain_id" value={chain.id} />
                              <input type="hidden" name="slot_start" value={iso} />
                              <input type="hidden" name="book" value="0" />
                              <input type="hidden" name="user_id" value={p.user_id} />
                              <button type="submit" className="text-xs text-ink/50 underline" aria-label={`Remove ${p.name} from ${time(t)}`}>
                                remove {p.name.split(" ")[0]}
                              </button>
                            </form>
                          ))}
                      </span>
                    )}
                  </span>
                  {!over && (booked || !full) && (
                    <form action={bookPrayerSlot}>
                      <input type="hidden" name="chain_id" value={chain.id} />
                      <input type="hidden" name="slot_start" value={iso} />
                      <input type="hidden" name="book" value={booked ? "0" : "1"} />
                      <PendingButton className={booked ? "btn-ghost btn-sm" : "btn-secondary btn-sm"} pendingLabel="…">
                        {booked ? "Cancel mine" : "I'll pray"}
                      </PendingButton>
                    </form>
                  )}
                  {!over && full && !booked && <span className="text-xs font-medium text-ink/50">Full</span>}
                </li>
              );
            })}
          </ul>
        </Section>
      ))}

      {shepherd && (
        <form action={deletePrayerChain} className="flex justify-end">
          <input type="hidden" name="chain_id" value={chain.id} />
          <ConfirmSubmitButton title="Delete this prayer chain?" message="All the booked slots go with it." confirmLabel="Delete" pendingLabel="Deleting…">
            Delete prayer chain
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
