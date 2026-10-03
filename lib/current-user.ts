import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AccountStatus, Role } from "@/lib/permissions";

export interface AppUser {
  id: string;
  church_id: string | null;
  role: Role;
  name: string;
  email: string;
  department_id: string | null;
  status: AccountStatus;
}

/**
 * The signed-in person's profile, re-read from the database on every request
 * (never from a cookie or form field). `cache` dedupes it within one request,
 * so a page, its layout and its server actions share a single lookup.
 *
 * Returns null when signed out, when there's no profile, or when the account
 * has been deactivated — so every page and action that checks for a user
 * fails closed for deactivated accounts. The dashboard layout uses
 * getSessionState() to tell those cases apart and explain them.
 */
export const getCurrentAppUser = cache(async (): Promise<AppUser | null> => {
  const state = await getSessionState();
  return state.kind === "ok" ? state.user : null;
});

export type SessionState =
  | { kind: "signed_out" }
  | { kind: "no_profile" }
  | { kind: "disabled" }
  | { kind: "ok"; user: AppUser };

export const getSessionState = cache(async (): Promise<SessionState> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "signed_out" };

  const { data } = await supabase
    .from("app_users")
    .select("id, church_id, role, name, email, department_id, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return { kind: "no_profile" };
  if (data.status === "disabled") return { kind: "disabled" };
  return { kind: "ok", user: data as AppUser };
});
