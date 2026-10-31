import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

/**
 * GET /auth/signout?reason=disabled|no_profile
 *
 * Ends the session and sends the person to the sign-in page with a reason it
 * can explain. Used by the dashboard layout when a signed-in account has been
 * deactivated or has no church profile. Only known reasons are passed on.
 */
const REASONS = new Set(["disabled", "no_profile"]);

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("app_users").select("id, church_id").eq("id", user.id).maybeSingle();
    if (profile) await logAudit({ churchId: profile.church_id, actorId: profile.id, action: "auth.signed_out" });
  }
  await supabase.auth.signOut();

  const reason = request.nextUrl.searchParams.get("reason");
  const url = new URL("/login", request.url);
  if (reason && REASONS.has(reason)) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}
