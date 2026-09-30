import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { AnswerPrayerForm } from "./AnswerPrayerForm";
import { toggleSharing, reopenPrayer, deletePrayer } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";

export default async function PrayerBoardPage() {
  const access = await checkModuleAccess("prayer_board");
  if (!access.allowed) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-semibold mb-2">Prayer Board</h1>
        <p className="text-red-600">{access.reason}</p>
      </div>
    );
  }

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: items, error } = await supabase
    .from("prayer_board_items")
    .select("*")
    .eq("user_id", me!.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const active = (items ?? []).filter((i) => i.status === "active");
  const answered = (items ?? [])
    .filter((i) => i.status === "answered")
    .sort((a, b) => (b.answered_at ?? "").localeCompare(a.answered_at ?? ""));

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-semibold">My prayer board</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/prayer-board/wall" className="border border-ink/15 px-4 py-2 rounded-lg text-sm hover:bg-ink/5">
            Church prayer wall
          </Link>
          <Link href="/dashboard/prayer-board/new" className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium">
            + Add prayer
          </Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
          ⚠ Couldn't load your prayers — refresh the page to try again.
        </p>
      )}

      <section className="mb-10" aria-labelledby="active-heading">
        <h2 id="active-heading" className="text-sm uppercase tracking-wide text-ink/50 mb-3">
          Active ({active.length})
        </h2>
        {!active.length && !error && (
          <p className="text-ink/40 text-sm">
            Nothing here yet. <Link href="/dashboard/prayer-board/new" className="text-ember">Add your first prayer</Link>.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {active.map((item) => (
            <PrayerCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section aria-labelledby="answered-heading">
        <h2 id="answered-heading" className="text-sm uppercase tracking-wide text-ink/50 mb-3">
          ⭐ Testimonies — answered ({answered.length})
        </h2>
        {!answered.length && <p className="text-ink/40 text-sm">When you mark a prayer answered, it moves here.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {answered.map((item) => (
            <PrayerCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PrayerCard({ item }: { item: any }) {
  const isAnswered = item.status === "answered";
  const isShared = isAnswered ? item.is_testimony_shared : item.is_shared_request;

  return (
    <div className="card-elevated rounded-xl p-4 flex flex-col">
      {item.image_url && <img src={item.image_url} alt="" className="w-full h-32 object-cover rounded-lg mb-3" />}
      <p className="font-medium mb-2 whitespace-pre-line">{item.prayer_text}</p>
      {item.scripture_refs?.length > 0 && <p className="text-sm text-ember mb-2">{item.scripture_refs.join(" · ")}</p>}
      {isAnswered && item.answered_reflection && (
        <p className="text-sm text-ink/70 border-l-2 border-gold pl-3 my-2">{item.answered_reflection}</p>
      )}
      <p className="text-xs text-ink/40 mt-auto pt-2">
        {isAnswered
          ? `Answered ${new Date(item.answered_at).toLocaleDateString()}`
          : `Added ${new Date(item.created_at).toLocaleDateString()}`}
        {isShared ? (isAnswered ? " · shared as testimony" : " · on the prayer wall") : " · private"}
      </p>

      <div className="flex flex-wrap gap-2 mt-3">
        {!isAnswered && <AnswerPrayerForm id={item.id} />}
        <form action={toggleSharing}>
          <input type="hidden" name="id" value={item.id} />
          <PendingButton className="text-xs border border-ink/15 rounded-lg px-3 py-1.5 hover:bg-ink/5">
            {isShared ? "Make private" : isAnswered ? "Share testimony" : "Share on wall"}
          </PendingButton>
        </form>
        {isAnswered && (
          <form action={reopenPrayer}>
            <input type="hidden" name="id" value={item.id} />
            <PendingButton className="text-xs border border-ink/15 rounded-lg px-3 py-1.5 hover:bg-ink/5">Reopen</PendingButton>
          </form>
        )}
        <form action={deletePrayer}>
          <input type="hidden" name="id" value={item.id} />
          <ConfirmSubmitButton
            message="Delete this prayer permanently? Any encouragement comments on it will be deleted too."
            className="text-xs text-red-700 rounded-lg px-3 py-1.5 hover:bg-red-50"
          >
            Delete
          </ConfirmSubmitButton>
        </form>
      </div>
    </div>
  );
}
