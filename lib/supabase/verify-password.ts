import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Checks someone's current password WITHOUT touching their session: a
 * throwaway client that keeps nothing (no cookies, no storage, no refresh).
 * Used before sensitive account changes (email) so a borrowed, unlocked
 * phone isn't enough to take over an account. Supabase rate-limits sign-in
 * attempts, which also limits guessing here.
 *
 * Returns "ok", "wrong" (bad password), "limited" (too many tries) or
 * "error" (couldn't check — treat as not verified).
 */
export async function verifyPassword(email: string, password: string): Promise<"ok" | "wrong" | "limited" | "error"> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (!error && data.session) {
    // Don't leave a second live session lying around.
    await client.auth.signOut({ scope: "local" }).catch(() => {});
    return "ok";
  }
  if (error?.status === 429) return "limited";
  if (error && /invalid login credentials/i.test(error.message)) return "wrong";
  console.error("[account] password check failed:", error?.message);
  return "error";
}
