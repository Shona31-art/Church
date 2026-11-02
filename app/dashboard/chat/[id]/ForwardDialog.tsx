"use client";

import { useEffect, useRef, useState } from "react";
import { Forward, Hash, User } from "lucide-react";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { showToast } from "@/components/ui/Toaster";
import { forwardMessage, listForwardTargets, type ForwardTarget } from "../actions";

const LIMIT = 5;

/** WhatsApp-style "Forward to…": pick up to 5 chats, then send. */
export function ForwardDialog({ messageId, currentChannelId, onClose }: { messageId: string; currentChannelId: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [targets, setTargets] = useState<ForwardTarget[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
    callAction(() => listForwardTargets(), { error: CONNECTION_FAILED }).then((r) => {
      if (r.error) setError(r.error);
      else setTargets((r.targets ?? []).filter((t) => t.id !== currentChannelId));
    });
  }, [currentChannelId]);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= LIMIT ? p : [...p, id]));
  }

  async function send() {
    setBusy(true);
    const r = await callAction(() => forwardMessage(messageId, picked), { error: CONNECTION_FAILED });
    setBusy(false);
    if (r.error) return setError(r.error);
    showToast(r.sent === picked.length ? "Forwarded." : `Forwarded to ${r.sent} of ${picked.length} chats.`, "success");
    onClose();
  }

  const shown = (targets ?? []).filter((t) => t.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="forward-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line p-0 shadow-pop backdrop:bg-ink/45 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[80vh] flex-col p-5">
        <h2 id="forward-title" className="text-xl font-semibold">
          Forward to…
        </h2>
        <p className="mt-1 text-sm text-ink/60">Choose up to {LIMIT} chats.</p>
        <label htmlFor="forward-filter" className="sr-only">
          Search chats
        </label>
        <input id="forward-filter" className="input mt-3" placeholder="Search chats" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <ul className="mt-3 flex-1 space-y-1 overflow-y-auto" aria-busy={!targets}>
          {!targets && !error && <li className="p-2 text-sm text-ink/60">Loading your chats…</li>}
          {targets && !shown.length && <li className="p-2 text-sm text-ink/60">No chats match.</li>}
          {shown.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-ink/[0.04]">
                <input type="checkbox" checked={picked.includes(t.id)} onChange={() => toggle(t.id)} disabled={!picked.includes(t.id) && picked.length >= LIMIT} className="h-4 w-4" />
                <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-parchment text-ink/60">
                  {t.isDm ? <User className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                </span>
                <span className="truncate text-sm">{t.name}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={send} disabled={busy || !picked.length}>
            <Forward aria-hidden className="h-4 w-4" /> {busy ? "Sending…" : picked.length > 1 ? `Forward to ${picked.length}` : "Forward"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
