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
  // Missing keys would otherwise crash every request into a blank white page.
  // Say exactly what's wrong instead (no secrets are shown, only variable names).
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("[middleware] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.");
    return new NextResponse(SETUP_PAGE, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
  }

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
  // Everything except static files, images, the Paystack and notification-push
  // webhooks (no user session; each verifies its own signature or secret), the public-domain
  // Bible text in /bibles/ — no personal data, and a session check on each of
  // the 66 files would slow reading and break offline downloads. Likewise the
  // offline service worker, web app manifest and poster fonts (public/fonts/).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/paystack/webhook|api/notifications/push|bibles/|fonts/|sw\\.js|offline\\.html|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

const SETUP_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Grace: setup needed</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050a1c;color:#f6efe2;font:16px/1.6 system-ui,sans-serif;padding:24px}main{max-width:560px}h1{color:#f5c86a;font-size:1.5rem}code{background:#14204a;padding:2px 6px;border-radius:4px}</style></head>
<body><main><h1>Grace can't reach its database yet</h1>
<p>The Supabase keys aren't set, so the app can't start.</p>
<p><strong>Running locally:</strong> copy <code>.env.example</code> to <code>.env.local</code>, fill in <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (Supabase → Project Settings → API), then stop and restart <code>pnpm dev</code>.</p>
<p><strong>On Vercel:</strong> add them under Settings → Environment Variables, then redeploy.</p></main></body></html>`;
