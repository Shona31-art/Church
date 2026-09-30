import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only admin client. Uses the SERVICE ROLE key, which bypasses RLS
 * entirely — never import this into a client component, never expose the
 * key to the browser. Only used for actions an ordinary user genuinely
 * cannot do themselves, like creating another person's login (inviting a
 * new member) or fully deleting an auth account.
 *
 * Every function that uses this client MUST do its own role check first
 * (e.g. "is the caller a church_admin?") since bypassing RLS means the
 * database is no longer the safety net here — the code is.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
