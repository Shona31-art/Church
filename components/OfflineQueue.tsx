"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff } from "lucide-react";
import { submitQueuedItem } from "@/app/dashboard/offline-actions";
import { QUEUE_EVENT, readQueue, removeFromQueue, type QueuedKind } from "@/lib/offline-queue";
import { showToast } from "@/components/ui/Toaster";

const LABELS: Record<QueuedKind, [string, string]> = {
  journal: ["journal entry", "journal entries"],
  prayer: ["prayer", "prayers"],
};

/** Sends anything written offline as soon as there's a connection (on load and when the phone comes back online). */
export function OfflineQueueSender() {
  const router = useRouter();
  const sending = useRef(false);

  const flush = useCallback(async () => {
    if (sending.current || navigator.onLine === false) return;
    const items = readQueue();
    if (!items.length) return;
    sending.current = true;
    let sent = 0;
    for (const item of items) {
      const result = await submitQueuedItem(item.kind, item.fields).catch(() => ({ ok: false as const, error: "", retry: true }));
      if (result.ok) {
        removeFromQueue(item.id);
        sent++;
      } else if (!result.retry) {
        removeFromQueue(item.id);
        showToast(`A ${LABELS[item.kind][0]} written offline couldn't be saved: ${result.error}`, "error");
      } else break; // still no connection: try again later
    }
    sending.current = false;
    if (sent) {
      showToast(sent === 1 ? "Your item written offline has been saved." : `${sent} items written offline have been saved.`, "success");
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    flush();
    window.addEventListener("online", flush);
    window.addEventListener(QUEUE_EVENT, flush);
    return () => {
      window.removeEventListener("online", flush);
      window.removeEventListener(QUEUE_EVENT, flush);
    };
  }, [flush]);
  return null;
}

/** "1 prayer waiting to send" on the page it belongs to, while anything is queued. */
export function QueuedNotice({ kind }: { kind: QueuedKind }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(readQueue().filter((i) => i.kind === kind).length);
    update();
    window.addEventListener(QUEUE_EVENT, update);
    return () => window.removeEventListener(QUEUE_EVENT, update);
  }, [kind]);
  if (!count) return null;
  return (
    <p role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-info-line bg-info-tint px-4 py-3 text-sm text-info">
      <CloudOff aria-hidden className="h-4 w-4 shrink-0" />
      {count} {LABELS[kind][count === 1 ? 0 : 1]} saved on this phone — {count === 1 ? "it" : "they"}&apos;ll be sent when you&apos;re back online.
    </p>
  );
}
