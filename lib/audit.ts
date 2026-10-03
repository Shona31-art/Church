import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Records who did what, when (POPIA accountability). Call after any
 * sensitive action: subscription/module changes, member deletion, pastoral
 * care records, prayer-wall moderation, data exports.
 *
 * Written with the service-role client on purpose: audit_logs has no insert
 * policy, so members can't forge or spam entries — only trusted server code
 * (which has already verified `actorId` from the session) can write here.
 * Never put sensitive content (e.g. care-note text) in `metadata`.
 */
export async function logAudit(params: {
  churchId: string | null;
  /** null for system events (e.g. a Stripe webhook) — there is no signed-in person. */
  actorId: string | null;
  action: string;
  targetTable?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await createAdminClient().from("audit_logs").insert({
    church_id: params.churchId,
    actor_id: params.actorId,
    action: params.action,
    target_table: params.targetTable,
    target_id: params.targetId,
    metadata: params.metadata,
  });
  // Never block the user's action on an audit failure, but make it loud.
  if (error) console.error(`[audit] failed to record ${params.action}:`, error.message);
}
