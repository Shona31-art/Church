import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// GET /api/posters/stock — the Pexels proxy. Session, plan and the outside
// API are mocked; these tests cover the route's own checks and reshaping.
let user: { id: string; role: string } | null = { id: "u1", role: "pastor" };
let planAllows = true;
vi.mock("@/lib/current-user", () => ({ getCurrentAppUser: async () => user }));
vi.mock("@/lib/paywall", () => ({ checkModuleAccess: async () => ({ allowed: planAllows }) }));
const { GET } = await import("@/app/api/posters/stock/route");

const call = (query: string) => GET(new Request(`http://localhost/api/posters/stock?${query}`));
const pexelsPhoto = {
  id: 7,
  width: 4000,
  height: 3000,
  alt: "Hands raised in worship",
  avg_color: "#334455",
  url: "https://www.pexels.com/photo/7/",
  photographer: "Ann Example",
  photographer_url: "https://www.pexels.com/@ann",
  src: { medium: "https://images.pexels.com/photos/7/m.jpeg", large2x: "https://images.pexels.com/photos/7/l.jpeg" },
};

beforeEach(() => {
  user = { id: `u-${Math.random()}`, role: "pastor" };
  planAllows = true;
  process.env.PEXELS_API_KEY = "test-key";
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ photos: [pexelsPhoto], next_page: "x" }), { status: 200 })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PEXELS_API_KEY;
});

describe("GET /api/posters/stock", () => {
  test("refuses signed-out people, members and churches without Poster Studio", async () => {
    user = null;
    expect((await call("q=worship")).status).toBe(401);
    user = { id: "m", role: "member" };
    expect((await call("q=worship")).status).toBe(403);
    user = { id: "p", role: "pastor" };
    planAllows = false;
    expect((await call("q=worship")).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("says when it isn't set up, and rejects too-short searches", async () => {
    delete process.env.PEXELS_API_KEY;
    expect((await call("q=worship")).status).toBe(503);
    process.env.PEXELS_API_KEY = "test-key";
    expect((await call("q=a")).status).toBe(400);
  });

  test("returns only what the editor needs, with the key sent server-side", async () => {
    const res = await call("q=worship&page=2");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      hasMore: true,
      photos: [
        {
          id: 7,
          width: 4000,
          height: 3000,
          alt: "Hands raised in worship",
          color: "#334455",
          thumb: "https://images.pexels.com/photos/7/m.jpeg",
          url: "https://images.pexels.com/photos/7/l.jpeg",
          photographer: "Ann Example",
          photographerUrl: "https://www.pexels.com/@ann",
          pageUrl: "https://www.pexels.com/photo/7/",
        },
      ],
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("query=worship&page=2");
    expect((init.headers as Record<string, string>).Authorization).toBe("test-key");
  });

  test("Pexels failures become a friendly 502; each person is limited to 40 searches an hour", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    expect((await call("q=worship")).status).toBe(502);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ photos: [] }), { status: 200 })));
    user = { id: "busy", role: "pastor" };
    for (let i = 0; i < 40; i++) expect((await call("q=worship")).status).toBe(200);
    expect((await call("q=worship")).status).toBe(429);
  });
});
