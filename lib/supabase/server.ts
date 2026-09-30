import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side client. Runs with the calling user's session, so RLS policies
// (defined in schema.sql) apply exactly as they would for that user —
// this is what makes the paywall/journal privacy rules actually enforced,
// not just decorative.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // called from a Server Component with no request context — safe to ignore
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // same as above
          }
        },
      },
    }
  );
}
