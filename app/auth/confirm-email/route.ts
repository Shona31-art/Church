import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/confirm-email — where the "confirm your new email" links land
 * (set as emailRedirectTo in requestEmailChange).
 *
 * Supabase has already recorded the confirmation before sending the person
 * here. If the link carries a sign-in code from this browser, we finish
 * signing in with it; if it was opened on another device that code can't be
 * used, which is fine — the change still counts. Either way we go to My
 * account, which shows the real state (waiting for the other address, or done).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const linkError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const status = linkError ? "link_problem" : "confirmed";

  if (code) {
    const { error } = await createClient().auth.exchangeCodeForSession(code);
    // Expected on another device (no matching sign-in started here); not a failure of the email change.
    if (error) console.warn("[confirm-email] code not exchanged:", error.message);
  }
  if (linkError) console.warn("[confirm-email] link error:", linkError);

  const target = new URL("/dashboard/account", url.origin);
  target.searchParams.set("email", status);
  target.hash = "email";
  return NextResponse.redirect(target, { status: 303 });
}
