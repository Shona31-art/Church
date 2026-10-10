// Browser-only: turns a picked photo into a small square image before upload,
// so a 6 MB phone photo becomes ~40 KB. Saves members' data, Storage space,
// and means nobody else downloads the original (which can carry GPS data in
// its EXIF — drawing to a canvas strips all metadata).

export interface SquareImage {
  blob: Blob;
  extension: "webp" | "jpg";
}

export async function toSquareImage(file: File, size: number): Promise<SquareImage> {
  // imageOrientation: respects phone rotation so portraits aren't sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);

    // WebP where the browser can encode it (most can), JPEG otherwise.
    const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    if (webp && webp.type === "image/webp") return { blob: webp, extension: "webp" };
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!jpeg) throw new Error("Couldn't encode image");
    return { blob: jpeg, extension: "jpg" };
  } finally {
    bitmap.close();
  }
}
