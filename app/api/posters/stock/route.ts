import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";

/**
 * GET /api/posters/stock?q=worship&page=1 — free stock photo search for the
 * poster editor, via the Pexels API (key stays on the server).
 *
 * Request:  q (2–80 chars), page (1–20). Signed in, Premium (ai_poster), poster-making role.
 * Response: 200 { photos: StockPhoto[], hasMore } · 400 bad input · 401 signed out ·
 *           403 not allowed · 429 too many searches · 503 not configured · 502 Pexels failed
 *
 * Pexels allows 200 requests an hour per app. Identical searches are cached
 * for a day by Next's data cache, and each person gets 40 searches an hour
 * (counted per server instance — a light brake, not a hard quota).
 */

export interface StockPhoto {
  id: number;
  width: number;
  height: number;
  alt: string;
  color: string;
  /** For the results grid. */
  thumb: string;
  /** For the poster (large enough for print). */
  url: string;
  photographer: string;
  photographerUrl: string;
  pageUrl: string;
}

const Query = z.object({ q: z.string().trim().min(2).max(80), page: z.coerce.number().int().min(1).max(20).default(1) });
const PER_HOUR = 40;
const searches = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (searches.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= PER_HOUR) return true;
  recent.push(now);
  searches.set(userId, recent);
  return false;
}

export async function GET(request: Request) {
  const me = await getCurrentAppUser();
  if (!me) return NextResponse.json({ error: "Sign in again to search photos." }, { status: 401 });
  if (!(await checkModuleAccess("ai_poster")).allowed || !can(me.role, "makePosters")) {
    return NextResponse.json({ error: "Photo search is part of Poster Studio." }, { status: 403 });
  }
  const key = process.env.PEXELS_API_KEY;
  if (!key) return NextResponse.json({ error: "Free photo search isn't set up yet." }, { status: 503 });

  const url = new URL(request.url);
  const parsed = Query.safeParse({ q: url.searchParams.get("q") ?? "", page: url.searchParams.get("page") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "Type at least 2 letters to search." }, { status: 400 });
  if (rateLimited(me.id)) return NextResponse.json({ error: "That's a lot of searches. Try again in a little while." }, { status: 429 });

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(parsed.data.q)}&page=${parsed.data.page}&per_page=24`,
      { headers: { Authorization: key }, next: { revalidate: 86_400 }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`Pexels ${res.status}`);
    const body = (await res.json()) as {
      photos: { id: number; width: number; height: number; alt: string; avg_color: string; url: string; photographer: string; photographer_url: string; src: { medium: string; large2x: string } }[];
      next_page?: string;
    };
    const photos: StockPhoto[] = body.photos.map((p) => ({
      id: p.id,
      width: p.width,
      height: p.height,
      alt: p.alt || "Stock photo",
      color: p.avg_color,
      thumb: p.src.medium,
      url: p.src.large2x,
      photographer: p.photographer,
      photographerUrl: p.photographer_url,
      pageUrl: p.url,
    }));
    return NextResponse.json({ photos, hasMore: Boolean(body.next_page) });
  } catch (error) {
    console.error("[posters] stock search failed:", (error as Error).message);
    return NextResponse.json({ error: "Photo search isn't responding. Try again shortly." }, { status: 502 });
  }
}
