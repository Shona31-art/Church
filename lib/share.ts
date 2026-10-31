// Sharing from the app: the phone's own share sheet (WhatsApp, Messages,
// email…) where the browser has one, otherwise copy to the clipboard.
// Browser only.

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export interface ShareContent {
  title: string;
  text?: string;
  /** Path or full URL; paths are made absolute. */
  url?: string;
  /** e.g. a poster image. Only sent where the browser can share files. */
  file?: File;
}

/** The text that's copied when there's no share sheet: text, then the link. */
export function shareFallbackText({ title, text, url }: ShareContent, origin = ""): string {
  const link = url ? (url.startsWith("http") ? url : `${origin}${url}`) : "";
  return [text || title, link].filter(Boolean).join("\n\n");
}

export async function shareContent(content: ShareContent): Promise<ShareResult> {
  const url = content.url ? new URL(content.url, window.location.origin).toString() : undefined;
  const data: ShareData = { title: content.title, text: content.text, url };
  if (content.file && navigator.canShare?.({ files: [content.file] })) data.files = [content.file];

  if (typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      if ((error as Error).name === "AbortError") return "cancelled";
      // Some browsers refuse files or a long text: fall through to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(shareFallbackText({ ...content, url }, window.location.origin));
    return "copied";
  } catch {
    return "failed";
  }
}
