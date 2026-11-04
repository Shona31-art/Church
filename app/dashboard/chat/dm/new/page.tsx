import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { roleLabel } from "@/lib/permissions";
import { likePattern } from "@/lib/list";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/ui/FilterBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { startDirectMessage } from "../../actions";

export default async function NewDirectMessagePage({ searchParams }: { searchParams: { q?: string } }) {
  const gate = await moduleGate("dept_chats");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  let query = createClient()
    .from("app_users")
    .select("*")
    .eq("church_id", me.church_id)
    .neq("id", me.id)
    .neq("status", "disabled")
    .order("name")
    .limit(50);
  if (q) query = query.ilike("name", likePattern(q));
  const { data: everyone } = await query;
  // Record-only members (record_members.sql) can't receive messages.
  const members = ((everyone ?? []) as { id: string; name: string; role: string; record_only?: boolean }[]).filter((m) => !m.record_only);

  return (
    <div className="max-w-xl">
      <PageHeader back={{ href: "/dashboard/chat", label: "Chats" }} title="New message" description="Direct messages are private between the two of you." />
      <FilterBar query={q} placeholder="Search by name…" label="Search people" resetHref="/dashboard/chat/dm/new" active={Boolean(q)} />
      {!members?.length ? (
        <EmptyState title={q ? "Nobody matches that name" : "No one else is here yet"} description={q ? undefined : "Once other members join your church, you can message them here."} />
      ) : (
        <ul className="card-elevated rounded-2xl divide-y divide-line">
          {members.map((m) => (
            <li key={m.id}>
              <form action={startDirectMessage} className="flex items-center justify-between gap-3 px-4 py-3">
                <input type="hidden" name="user_id" value={m.id} />
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-ink/60">{roleLabel(m.role)}</p>
                </div>
                <PendingButton className="btn-secondary btn-sm" pendingLabel="Opening…">
                  Message<span className="sr-only"> {m.name}</span>
                </PendingButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
