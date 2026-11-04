// Saving a file the page made (PDF or image) on any device. Browser only.
//
//  * Grace Android app (new enough): hands the bytes to the app, which saves
//    them in Downloads and opens them — its web view can't download "blob:"
//    links or print.
//  * Everywhere else: an ordinary download.

type Bridge = { saveFile?: (name: string, mime: string, base64: string) => boolean };

function androidBridge(): Bridge | null {
  const b = (window as unknown as { GraceAndroid?: Bridge }).GraceAndroid;
  return b && typeof b.saveFile === "function" ? b : null;
}

/** True inside the Grace Android app, which can't download in-page files without its saveFile (older app versions). */
export function isOldAndroidApp(): boolean {
  return typeof window !== "undefined" && /GraceAndroid\//.test(navigator.userAgent) && !androidBridge();
}

async function toBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Saves `blob` as `name`. Returns false when this device can't (an older Grace Android app). */
export async function saveBlob(blob: Blob, name: string): Promise<boolean> {
  const bridge = androidBridge();
  if (bridge) return bridge.saveFile!(name, blob.type || "application/octet-stream", await toBase64(blob));
  if (isOldAndroidApp()) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
}

/** Same, from a data: or blob: URL (e.g. a canvas export). */
export async function saveUrl(url: string, name: string): Promise<boolean> {
  return saveBlob(await (await fetch(url)).blob(), name);
}
