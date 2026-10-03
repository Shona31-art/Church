// Sermon media links. Pastors paste YouTube links far more often than direct
// video files; a <video> tag can't play a YouTube page, so those are embedded
// via YouTube's privacy-enhanced domain (no tracking cookies until played).

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const host = parsed.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = parsed.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parsed.pathname === "/watch") id = parsed.searchParams.get("v");
    else {
      const m = /^\/(?:embed|live|shorts)\/([^/?]+)/.exec(parsed.pathname);
      id = m?.[1] ?? null;
    }
  }
  return id && YOUTUBE_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

/** True for links that look like a playable file (mp4, mp3…) rather than a web page. */
export function isDirectMediaFile(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return /\.(mp4|webm|ogg|mov|m4v|mp3|m4a|wav|aac)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Only http(s) links are ever rendered as links or media sources. */
export function isSafeHttpUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const p = new URL(url).protocol;
    return p === "https:" || p === "http:";
  } catch {
    return false;
  }
}
