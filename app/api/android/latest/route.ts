import { NextResponse } from "next/server";

/**
 * GET /api/android/latest — the newest Android app version on GitHub
 * releases (tags "android-<n>", published by .github/workflows/android.yml),
 * so the app can offer "Update available". Cached for 10 minutes.
 * Response: 200 { version: number | null }
 */
export const revalidate = 600;

export async function GET() {
  try {
    const res = await fetch("https://api.github.com/repos/Shona31-art/Church/releases?per_page=20", {
      headers: { accept: "application/vnd.github+json", "user-agent": "grace-app" },
      next: { revalidate: 600 },
    });
    if (!res.ok) return NextResponse.json({ version: null });
    const releases = (await res.json()) as { tag_name?: string; draft?: boolean; prerelease?: boolean }[];
    const versions = releases
      .filter((r) => !r.draft && !r.prerelease)
      .map((r) => Number(/^android-(\d+)$/.exec(r.tag_name ?? "")?.[1]))
      .filter((n) => Number.isFinite(n));
    return NextResponse.json({ version: versions.length ? Math.max(...versions) : null });
  } catch {
    return NextResponse.json({ version: null });
  }
}
