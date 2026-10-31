"use server";

import { isRedirectError } from "next/dist/client/components/redirect";
import { getCurrentAppUser } from "@/lib/current-user";
import { createJournalEntry } from "./journal/actions";
import { createPrayer } from "./prayer-board/new/actions";

/**
 * Sends one item written offline (lib/offline-queue.ts) through the same
 * server action — and so the same checks — as the normal form. Those actions
 * redirect on success; here that redirect just means "saved", so the person
 * isn't pulled off whatever page they're on now.
 */
export async function submitQueuedItem(kind: "journal" | "prayer", fields: Record<string, string>): Promise<{ ok: true } | { ok: false; error: string; retry: boolean }> {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields ?? {})) if (typeof value === "string") formData.set(key, value.slice(0, 20_000));
  const action = kind === "journal" ? createJournalEntry : kind === "prayer" ? createPrayer : null;
  if (!action) return { ok: false, error: "Unknown item.", retry: false };
  // Signed out (or the session expired): keep it on the phone until they sign in again — never drop someone's words.
  if (!(await getCurrentAppUser())) return { ok: false, error: "Not signed in.", retry: true };
  try {
    const result = await action(null, formData);
    // A returned error is a validation or permission problem: retrying won't help.
    return { ok: false, error: result?.error ?? "Couldn't save it.", retry: false };
  } catch (error) {
    if (isRedirectError(error)) return { ok: true };
    console.error("[offline-queue] send failed:", error);
    return { ok: false, error: "Couldn't reach the server.", retry: true };
  }
}
