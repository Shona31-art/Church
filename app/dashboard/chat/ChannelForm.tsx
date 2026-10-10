"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { Search } from "lucide-react";
import { saveChannel } from "./actions";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { FormField, FormActions } from "@/components/ui/FormField";
import { PendingButton } from "@/components/ConfirmSubmitButton";

export interface ChannelPerson {
  id: string;
  name: string;
  photoUrl: string | null;
}

/** Create or edit a channel: name, description, and who can see it. */
export function ChannelForm({
  channel,
  people,
}: {
  channel?: { id: string; name: string; description: string | null; membersOnly: boolean; memberIds: string[] };
  people: ChannelPerson[];
}) {
  const [state, action] = useFormState(saveChannel, null);
  const fe = state?.fieldErrors ?? {};
  const [audience, setAudience] = useState<"everyone" | "members">(channel?.membersOnly ? "members" : "everyone");
  const [chosen, setChosen] = useState<Set<string>>(new Set(channel?.memberIds ?? []));
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
  }, [people, query]);

  function toggle(id: string) {
    setChosen((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={action} className="card-elevated space-y-6 rounded-2xl p-6" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {channel && <input type="hidden" name="channel_id" value={channel.id} />}

      <FormField label="Channel name" htmlFor="name" required error={fe.name} hint='For example "Prayer team" or "Youth leaders".'>
        <input id="name" name="name" required maxLength={60} defaultValue={state?.values?.name ?? channel?.name} className="input" aria-invalid={Boolean(fe.name)} />
      </FormField>

      <FormField label="Description" htmlFor="description" optional error={fe.description}>
        <input id="description" name="description" maxLength={200} defaultValue={state?.values?.description ?? channel?.description ?? ""} className="input" />
      </FormField>

      <fieldset>
        <legend className="label">Who can see this channel?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(
            [
              { value: "everyone", title: "Everyone in the church", body: "Anyone can read and post." },
              { value: "members", title: "Chosen members only", body: "Only the people you pick (plus pastors and admins)." },
            ] as const
          ).map((o) => (
            <label key={o.value} className={`cursor-pointer rounded-xl border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${audience === o.value ? "border-gold bg-gold/10" : "border-line hover:border-line-strong"}`}>
              <input type="radio" name="audience" value={o.value} checked={audience === o.value} onChange={() => setAudience(o.value)} className="sr-only" />
              <span className="block font-semibold">{o.title}</span>
              <span className="mt-0.5 block text-xs text-ink/60">{o.body}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {audience === "members" && (
        <fieldset>
          <legend className="label">
            Members <span className="tabular font-normal text-ink/50">({chosen.size} chosen)</span>
          </legend>
          {fe.member_ids && <p className="mb-2 text-xs text-danger">{fe.member_ids}</p>}
          <div className="relative mb-2">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <label htmlFor="member-search" className="sr-only">
              Search people
            </label>
            <input id="member-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people…" className="input pl-9" />
          </div>
          <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {shown.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-ink/[0.03]">
                  <input type="checkbox" checked={chosen.has(p.id)} onChange={() => toggle(p.id)} className="accent-[rgb(var(--ember))]" />
                  <Avatar name={p.name} src={p.photoUrl} size="xs" />
                  <span className="text-sm">{p.name}</span>
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-3 text-sm text-ink/50">No one matches “{query}”.</li>}
          </ul>
          {/* The chosen ids travel with the form, even ones hidden by the search. */}
          {[...chosen].map((id) => (
            <input key={id} type="hidden" name="member_ids" value={id} />
          ))}
        </fieldset>
      )}

      <FormActions>
        <PendingButton pendingLabel="Saving…">{channel ? "Save channel" : "Create channel"}</PendingButton>
        <Link href={channel ? `/dashboard/chat/${channel.id}` : "/dashboard/chat"} className="btn-ghost">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}
