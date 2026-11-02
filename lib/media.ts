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
    return /\.(mp4|webm|ogg|opus|mov|m4v|mp3|m4a|wav|aac)$/i.test(new URL(url).pathname);
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

// ---------------------------------------------------------------------------
// Links to media kept elsewhere (so big recordings don't use the church's own
// storage). Each recognised link becomes the service's official embed player;
// the embed address is always built here from the link's parts, never taken
// as-is, so only these known players can ever appear in the page.
// ---------------------------------------------------------------------------

export type EmbedShape = "video" | "audio" | "audio-tall";

export interface MediaEmbed {
  src: string;
  shape: EmbedShape;
  /** Where it's from, for the iframe title and form hints. */
  service: "YouTube" | "Vimeo" | "Facebook" | "Google Drive" | "SoundCloud" | "Spotify";
}

function parse(url: string | null | undefined): URL | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

/** The embeddable player for a link to YouTube, Vimeo, Facebook, Google Drive, SoundCloud or Spotify; null otherwise. */
export function mediaEmbed(url: string | null | undefined): MediaEmbed | null {
  const youtube = youtubeEmbedUrl(url);
  if (youtube) return { src: youtube, shape: "video", service: "YouTube" };
  const u = parse(url);
  if (!u) return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|web|mobile)\./, "");
  const segments = u.pathname.split("/").filter(Boolean);

  // Vimeo: vimeo.com/123, vimeo.com/123/abcdef (unlisted), player.vimeo.com/video/123?h=abcdef
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const at = host === "player.vimeo.com" ? (segments[0] === "video" ? 1 : -1) : segments.findIndex((seg) => /^\d+$/.test(seg));
    const id = at >= 0 ? segments[at] : undefined;
    if (!id || !/^\d{3,12}$/.test(id)) return null;
    const hash = u.searchParams.get("h") ?? (host === "vimeo.com" ? segments[at + 1] : undefined);
    return { src: `https://player.vimeo.com/video/${id}${hash && /^[0-9a-f]{6,20}$/i.test(hash) ? `?h=${hash}` : ""}`, shape: "video", service: "Vimeo" };
  }

  // Facebook videos and live streams (must be public).
  if (host === "fb.watch" || ((host === "facebook.com" || host === "fb.com") && (segments.includes("videos") || segments[0] === "watch" || segments[0] === "reel"))) {
    const clean = `https://${host === "fb.watch" ? "fb.watch" : "www.facebook.com"}${u.pathname}${segments[0] === "watch" && u.searchParams.get("v") ? `?v=${encodeURIComponent(u.searchParams.get("v")!)}` : ""}`;
    return { src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(clean)}&show_text=false`, shape: "video", service: "Facebook" };
  }

  // Google Drive: drive.google.com/file/d/ID/view, …/open?id=ID (shared with "Anyone with the link").
  if (host === "drive.google.com") {
    const id = segments[0] === "file" && segments[1] === "d" ? segments[2] : u.searchParams.get("id");
    if (id && /^[A-Za-z0-9_-]{10,100}$/.test(id)) return { src: `https://drive.google.com/file/d/${id}/preview`, shape: "video", service: "Google Drive" };
    return null;
  }

  // SoundCloud tracks: soundcloud.com/artist/track
  if (host === "soundcloud.com" && segments.length >= 2 && segments.every((s) => /^[A-Za-z0-9_-]+$/.test(s))) {
    const clean = `https://soundcloud.com/${segments.join("/")}`;
    return { src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(clean)}&visual=false&show_comments=false`, shape: "audio-tall", service: "SoundCloud" };
  }

  // Spotify podcast episodes and shows: open.spotify.com/(intl-xx/)episode/ID
  if (host === "open.spotify.com") {
    const parts = segments[0]?.startsWith("intl-") ? segments.slice(1) : segments;
    const [kind, id] = parts;
    if ((kind === "episode" || kind === "show" || kind === "track") && id && /^[A-Za-z0-9]{10,40}$/.test(id)) {
      return { src: `https://open.spotify.com/embed/${kind}/${id}`, shape: kind === "show" ? "audio-tall" : "audio", service: "Spotify" };
    }
  }
  return null;
}

/**
 * A link a plain <video>/<audio> player can play: a direct file link, or a
 * Dropbox share link to an audio/video file (turned into its direct-download form).
 */
export function playableFileUrl(url: string | null | undefined): string | null {
  const u = parse(url);
  if (!u) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if ((host === "dropbox.com" || host === "dl.dropboxusercontent.com") && isDirectMediaFile(`https://x${u.pathname}`)) {
    u.searchParams.delete("dl");
    u.searchParams.set("raw", "1");
    return u.toString();
  }
  return isDirectMediaFile(u.toString()) ? u.toString() : null;
}
