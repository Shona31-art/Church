import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AnswerPrayerForm } from "./AnswerPrayerForm";
import { toggleSharing, reopenPrayer, deletePrayer } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";

export default async function PrayerBoardPage() {
  const gate = await moduleGate("prayer_board");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const { data: items, error } = await createClient()
    .from("prayer_board_items")
    .select("*")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const active = (items ?? []).filter((i) => i.status === "active");
  const answered = (items ?? []).filter((i) => i.status === "answered").sort((a, b) => (b.answered_at ?? "").localeCompare(a.answered_at ?? ""));
  const addButton = (
    <Link href="/dashboard/prayer-board/new" className="btn-primary">
      Add prayer
    </Link>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="My prayer board"
        description="Your prayers are private unless you choose to share one with the church."
        actions={
          <>
            <Link href="/dashboard/prayer-board/wall" className="btn-secondary">
              Church prayer wall
            </Link>
            {addButton}
          </>
        }
      />

      {error && <Alert tone="error" className="mb-6">Couldn&apos;t load your prayers — refresh the page to try again.</Alert>}

      <section className="mb-10" aria-labelledby="active-heading">
        <h2 id="active-heading" className="text-lg font-semibold mb-3">
          Praying for ({active.length})
        </h2>
        {!active.length && !error ? (
          <EmptyState icon="🙏" title="No active prayers" description="Write down what's on your heart. We'll suggest a few Bible verses to pray with." action={addButton} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((item) => (
              <PrayerCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="answered-heading">
        <h2 id="answered-heading" className="text-lg font-semibold mb-3">
          ⭐ Answered ({answered.length})
        </h2>
        {!answered.length ? (
          <p className="text-sm text-ink/60">When you mark a prayer answered, it moves here as a testimony.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {answered.map((item) => (
              <PrayerCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PrayerCard({ item }: { item: any }) {
  const isAnswered = item.status === "answered";
  const isShared = isAnswered ? item.is_testimony_shared : item.is_shared_request;

  return (
    <article className="card-elevated rounded-2xl p-5 flex flex-col">
      <div className="mb-2 flex flex-wrap gap-2">
        {isShared ? (
          <StatusBadge tone="info">{isAnswered ? "Shared as testimony" : "On the prayer wall"}</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Private</StatusBadge>
        )}
        {item.category && <StatusBadge tone="neutral">{item.category}</StatusBadge>}
      </div>
      <p className="font-medium whitespace-pre-line">{item.prayer_text}</p>
      {item.scripture_refs?.length > 0 && <p className="text-sm text-ember mt-2">{item.scripture_refs.join(" · ")}</p>}
      {isAnswered && item.answered_reflection && <p className="text-sm text-ink/70 border-l-2 border-gold pl-3 my-3">{item.answered_reflection}</p>}
      <p className="text-xs text-ink/50 mt-auto pt-3">{isAnswered ? `Answered ${formatDate(item.answered_at)}` : `Added ${formatDate(item.created_at)}`}</p>

      <div className="flex flex-wrap gap-2 mt-3">
        {!isAnswered && <AnswerPrayerForm id={item.id} />}
        <form action={toggleSharing}>
          <input type="hidden" name="id" value={item.id} />
          <PendingButton className="btn-secondary btn-sm">{isShared ? "Make private" : isAnswered ? "Share testimony" : "Share on wall"}</PendingButton>
        </form>
        {isAnswered && (
          <form action={reopenPrayer}>
            <input type="hidden" name="id" value={item.id} />
            <PendingButton className="btn-secondary btn-sm">Still praying</PendingButton>
          </form>
        )}
        <form action={deletePrayer} className="ml-auto">
          <input type="hidden" name="id" value={item.id} />
          <ConfirmSubmitButton
            title="Delete this prayer?"
            message={isShared ? "It will be removed from your board and from the church prayer wall, along with any encouragement comments. This can't be undone." : "It will be permanently removed from your board. This can't be undone."}
            confirmLabel="Delete prayer"
            pendingLabel="Deleting…"
            className="btn-ghost btn-sm text-danger"
          >
            Delete
          </ConfirmSubmitButton>
        </form>
      </div>
    </article>
  );
}
