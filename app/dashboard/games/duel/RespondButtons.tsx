"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { showToast } from "@/components/ui/Toaster";
import { respondToDuel } from "./actions";

/** Accept (straight into the duel) or decline a challenge. */
export function RespondButtons({ duelId, size = "sm" }: { duelId: string; size?: "sm" | "md" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);

  async function answer(accept: boolean) {
    setBusy(accept ? "yes" : "no");
    const r = await callAction(() => respondToDuel(duelId, accept), { error: CONNECTION_FAILED });
    setBusy(null);
    if (r.error) return showToast(r.error, "error");
    if (accept) router.push(`/dashboard/games/duel/${duelId}`);
    router.refresh();
  }

  const cls = size === "sm" ? "btn-sm" : "";
  return (
    <span className="flex shrink-0 gap-2">
      <button type="button" className={`btn-ghost ${cls}`} onClick={() => answer(false)} disabled={busy !== null}>
        {busy === "no" ? "…" : "Decline"}
      </button>
      <button type="button" className={`btn-primary ${cls}`} onClick={() => answer(true)} disabled={busy !== null}>
        {busy === "yes" ? "…" : "Accept"}
      </button>
    </span>
  );
}
