// A one-page PDF around a JPEG — enough for "Download PDF" on a poster
// without a PDF library. The JPEG is embedded as-is (DCTDecode), so the PDF
// is the same quality and about the same size as the JPG download.
//
// A4 posters get a true A4 page (210 × 297 mm) so print shops and home
// printers size them correctly; other formats get a page the poster's shape,
// at 96 pixels per inch.

const A4_POINTS = { width: 595.28, height: 841.89 };

export function pdfPageSize(size: string, widthPx: number, heightPx: number): { width: number; height: number } {
  if (size === "a4") return A4_POINTS;
  return { width: round2(widthPx * 0.75), height: round2(heightPx * 0.75) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The pixel size written in a JPEG's frame header (SOF marker). Read from
 * the file rather than assumed: the canvas can round a poster to a pixel
 * more or less than its nominal size, and a wrong /Width skews the page.
 */
export function jpegSize(jpeg: Uint8Array): { width: number; height: number } {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error("Not a JPEG");
  let i = 2;
  while (i + 9 < jpeg.length) {
    if (jpeg[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = jpeg[i + 1];
    // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (jpeg[i + 5] << 8) | jpeg[i + 6], width: (jpeg[i + 7] << 8) | jpeg[i + 8] };
    }
    i += 2 + ((jpeg[i + 2] << 8) | jpeg[i + 3]);
  }
  throw new Error("JPEG size not found");
}

/** Builds the PDF bytes; the image fills the page. */
export function jpegToPdf(jpeg: Uint8Array, page: { width: number; height: number }, title = "Poster"): Uint8Array {
  const { width: imageWidth, height: imageHeight } = jpegSize(jpeg);
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (n: number, body: string | (string | Uint8Array)[]) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    for (const part of Array.isArray(body) ? body : [body]) push(part);
    push("\nendobj\n");
  };

  const content = `q\n${page.width} 0 0 ${page.height} 0 0 cm\n/Im0 Do\nQ`;
  const safeTitle = title.replace(/[^\x20-\x7e]/g, "").replace(/([\\()])/g, "\\$1").slice(0, 120) || "Poster";

  // Header, with the customary binary comment so tools treat it as binary.
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  object(4, [
    `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    "\nendstream",
  ]);
  object(5, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
  object(6, `<< /Title (${safeTitle}) /Producer (Grace-bound) >>`);

  const xref = length;
  push(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
