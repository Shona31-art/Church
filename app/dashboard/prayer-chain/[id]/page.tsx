import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { APP_TIMEZONE, formatDateTime } from "@/lib/format";
import { chainSchedule, slotStarts } from "@/lib/prayer-chain";
import { churchPeople } from "@/lib/children";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { PersonPicker } from "@/components/ui/PersonPicker";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { VoicePlayer } from "@/app/dashboard/chat/[id]/VoicePlayer";
import { bookPrayerSlot, deletePrayerChain } from "../actions";
import { PrayerBox } from "../PrayerBox";

export const metadata = { title: "Prayer chain" };

const time = (ms: number) => new Date(ms).toLocaleTimeString("en-ZA", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString("en-ZA", { timeZone: APP_TIMEZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" });

type Booking = { user_id: string; name: string; prayer_text: string | null; prayer_audio_path: string | null; prayer_audio_ms: number | null };

export default async function PrayerChainPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("prayer_chain");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const { data: chain } = await supabase.from("prayer_chains").select("*").eq("id", params.id).eq("church_id", me.church_id).maybeSingle();
  if (!chain) notFound();
  const { data: bookings } = await supabase.from("prayer_chain_slots").select("*, person:app_users!prayer_chain_slots_user_id_fkey(name)").eq("chain_id", chain.id).order("slot_start").limit(10000);
  const shepherd = can(me.role, "postChurchWide");
  const step = chain.slot_minutes * 60_000;
  const now = Date.now();

  // Recordings: short-lived links (RLS: the church can listen).
  const paths = ((bookings ?? []) as any[]).map((b) => b.prayer_audio_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("prayer-audio").createSignedUrls(paths, 3600);
    for (const s of data ?? []) if (s.signedUrl && s.path) signed.set(s.path, s.signedUrl);
  }

  const bySlot = new Map<number, Booking[]>();
  for (const b of (bookings ?? []) as any[]) {
    const k = Date.parse(b.slot_start);
    bySlot.set(k, [...(bySlot.get(k) ?? []), { user_id: b.user_id, name: b.person?.name ?? "Former member", prayer_text: b.prayer_text ?? null, prayer_audio_path: b.prayer_audio_path ?? null, prayer_audio_ms: b.prayer_audio_ms ?? null }]);
  }
  const slots = slotStarts(chain);
  const covered = slots.filter((t) => (bySlot.get(t)?.length ?? 0) > 0).length;
  const mine = slots.filter((t) => bySlot.get(t)?.some((p) => p.user_id === me.id));
  const days = new Map<string, number[]>();
  for (const t of slots) days.set(dayLabel(t), [...(days.get(dayLabel(t)) ?? []), t]);
  const openSlots = slots.filter((t) => t + step > now && (bySlot.get(t)?.length ?? 0) < chain.max_per_slot);
  const people = shepherd ? await churchPeople(me.church_id!) : [];

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        back={{ href: "/dashboard/prayer-chain", label: "Prayer chain" }}
        title={chain.title}
        description={`${formatDateTime(chain.starts_at, { year: "numeric" })} – ${formatDateTime(chain.ends_at, { year: "numeric" })}${chain.times?.length ? ` · ${chainSchedule(chain)}` : ""}`}
      />
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

      {shepherd && openSlots.length > 0 && people.length > 0 && (
        <Section title="Add someone to a slot" description="They're told straight away and reminded before it starts.">
          <form action={bookPrayerSlot} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <input type="hidden" name="chain_id" value={chain.id} />
            <input type="hidden" name="book" value="1" />
            <div>
              <p className="mb-1 text-sm font-medium">Who</p>
              <PersonPicker name="user_id" title="Who will pray?" placeholder="Choose a person" options={people.map((p) => ({ value: p.id, label: p.name }))} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">When</p>
              <PersonPicker
                name="slot_start"
                title="Which prayer slot?"
                placeholder="Choose a time"
                options={openSlots.map((t) => ({ value: new Date(t).toISOString(), label: `${time(t)} – ${time(t + step)}`, group: dayLabel(t) }))}
              />
            </div>
            <PendingButton className="btn-primary" pendingLabel="Adding…">Add</PendingButton>
          </form>
        </Section>
      )}

      {[...days.entries()].map(([label, ts]) => (
        <Section key={label} title={label}>
          <ul className="divide-y divide-line">
            {ts.map((t) => {
              const list = bySlot.get(t) ?? [];
              const mineHere = list.find((p) => p.user_id === me.id);
              const over = t + step <= now;
              const full = list.length >= chain.max_per_slot;
              const iso = new Date(t).toISOString();
              return (
                <li key={t} className={`py-3 ${over && !list.length ? "opacity-50" : ""}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="w-28 shrink-0 text-sm font-semibold tabular-nums">
                      {time(t)}–{time(t + step)}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-ink/70">{list.length ? list.map((p) => p.name.split(" ")[0]).join(", ") : <span className="text-ink/40">Open</span>}</span>
                    {!over && (mineHere || !full) && (
                      <form action={bookPrayerSlot}>
                        <input type="hidden" name="chain_id" value={chain.id} />
                        <input type="hidden" name="slot_start" value={iso} />
                        <input type="hidden" name="book" value={mineHere ? "0" : "1"} />
                        <PendingButton className={mineHere ? "btn-ghost btn-sm" : "btn-secondary btn-sm"} pendingLabel="…">
                          {mineHere ? "Cancel mine" : "I'll pray"}
                        </PendingButton>
                      </form>
                    )}
                    {!over && full && !mineHere && <span className="text-xs font-medium text-ink/50">Full</span>}
                  </div>

                  {list.some((p) => p.prayer_text || p.prayer_audio_path) && (
                    <ul className="mt-2 space-y-2 pl-0 sm:pl-[7.75rem]">
                      {list
                        .filter((p) => p.prayer_text || p.prayer_audio_path)
                        .map((p) => (
                          <li key={p.user_id} className="rounded-xl bg-gold/5 p-3 text-sm">
                            <p className="mb-1 text-xs font-semibold text-ink/60">{p.name}&apos;s prayer</p>
                            {p.prayer_text && <p className="whitespace-pre-line">{p.prayer_text}</p>}
                            {p.prayer_audio_path && signed.get(p.prayer_audio_path) && (
                              <div className="mt-1">
                                <VoicePlayer src={signed.get(p.prayer_audio_path)} durationMs={p.prayer_audio_ms ?? 0} />
                              </div>
                            )}
                          </li>
                        ))}
                    </ul>
                  )}

                  {(shepherd || mineHere) && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 sm:pl-[7.75rem]">
                      {mineHere && (
                        <PrayerBox chainId={chain.id} slotStart={iso} churchId={me.church_id!} userId={me.id} initialText={mineHere.prayer_text} hasAudio={Boolean(mineHere.prayer_audio_path)} />
                      )}
                      {shepherd &&
                        !over &&
                        list
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
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      ))}

      {shepherd && (
        <form action={deletePrayerChain} className="flex justify-end">
          <input type="hidden" name="chain_id" value={chain.id} />
          <ConfirmSubmitButton title="Delete this prayer chain?" message="All the booked slots and prayers go with it." confirmLabel="Delete" pendingLabel="Deleting…">
            Delete prayer chain
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
