// Browser-only: cleans up a colouring page before upload (PagesManager).

/**
 * Turns a picked page into a small, clean black-and-white PNG: at most 1400px,
 * grey paper and shadows become white and the outlines solid black — so it
 * uploads quickly (well under the size limit, even from a phone photo) and
 * fills stop exactly at the lines. Returns base64.
 */
export async function prepareColoringPage(file: File): Promise<{ mimeType: string; data: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  let side = 1400;
  for (;;) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bitmap.width * scale);
    c.height = Math.round(bitmap.height * scale);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bitmap, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const px = img.data;
    // A threshold between the page's paper and its ink: lines go black, the rest white.
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const paper = sum / (px.length / 4);
    const cut = Math.min(170, paper * 0.72);
    for (let i = 0; i < px.length; i += 4) {
      const v = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] < cut ? 0 : 255;
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("no image");
    // Base64 grows by a third; keep well under the 3 MB the server accepts.
    if (blob.size > 2_000_000 && side > 700) {
      side = Math.round(side * 0.75);
      continue;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { mimeType: "image/png", data: btoa(bin) };
  }
}
