// Certificate → JPG / PDF, in the browser (components/certificates/CertificateArt.tsx).
// The SVG is copied with its fonts and logo embedded (an SVG drawn as an
// image can't load anything itself), drawn on a canvas at print quality,
// then saved as a JPG or wrapped in an A4-landscape PDF.
import { CERT_FONTS, CERT_H, CERT_W } from "@/components/certificates/CertificateArt";
import { jpegToPdf } from "@/lib/posters/pdf";

const A4_LANDSCAPE = { width: 841.89, height: 595.28 };
/** 3508 × 2480: A4 at 300 dpi. */
const SCALE = 3508 / CERT_W;

async function asDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** The certificate as a JPEG blob at A4 300 dpi (half that on phones that can't manage it). */
export async function certificateJpeg(svg: SVGSVGElement): Promise<Blob> {
  let markup = new XMLSerializer().serializeToString(svg);
  for (const url of Object.values(CERT_FONTS)) {
    if (!markup.includes(url)) continue;
    const data = await asDataUrl(url);
    if (data) markup = markup.split(url).join(data);
  }
  // Logos: embed, or leave them out if they can't be fetched (a canvas can't use outside images).
  const hrefs = [...new Set([...markup.matchAll(/href="((?:https?:|\/)[^"]+)"/g)].map((m) => m[1]))];
  for (const href of hrefs) {
    const data = await asDataUrl(new URL(href.replace(/&amp;/g, "&"), location.href).toString());
    markup = data ? markup.split(href).join(data) : markup.replace(new RegExp(`<image[^>]*href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*/>`, "g"), "");
  }
  markup = markup.replace(/width="100%"/, `width="${CERT_W}" height="${CERT_H}"`);

  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("The certificate couldn't be drawn."));
      img.src = url;
    });
    for (const scale of [SCALE, SCALE / 2]) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(CERT_W * scale);
        canvas.height = Math.round(CERT_H * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
        if (blob) return blob;
      } catch {
        // Too big for this phone's memory: try half size.
      }
    }
    throw new Error("This phone couldn't make the image.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function certificatePdf(svg: SVGSVGElement, title: string): Promise<Blob> {
  const jpeg = new Uint8Array(await (await certificateJpeg(svg)).arrayBuffer());
  return new Blob([jpegToPdf(jpeg, A4_LANDSCAPE, title) as BlobPart], { type: "application/pdf" });
}
