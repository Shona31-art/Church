import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Runs before every page request. Two jobs:
 *  1. Refresh the Supabase session cookie. Server Components can't write
 *     cookies, so without this the access token expires (~1h) and people get
 *     silently signed out mid-task.
 *  2. Send signed-out visitors of /dashboard to /login, remembering where they
 *     were (?next=) so they land back on the same page after signing in.
 *
 * This is a convenience layer, NOT the security boundary — every page, server
 * action and API route re-checks the session itself, and RLS enforces access.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  let user = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (error) {
    // Supabase unreachable: don't take the whole site down from here. Pages
    // re-check auth themselves and will show their own error state.
    console.error("[middleware] session refresh failed:", error);
    return response;
  }

  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    // Had a session cookie that no longer works → it expired (vs never signed in).
    const hadSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
    if (hadSession) url.searchParams.set("expired", "1");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Everything except static files, images, the Stripe webhook (which has
  // no user session and verifies its own signature) and the public-domain
  // Bible text in /bibles/ — no personal data, and a session check on each of
  // the 66 files would slow reading and break offline downloads. Likewise the
  // offline service worker and web app manifest.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|bibles/|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
