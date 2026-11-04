// Browser-only: turns a picked photo into a small square image before upload,
// so a 6 MB phone photo becomes ~40 KB. Saves members' data, Storage space,
// and means nobody else downloads the original (which can carry GPS data in
// its EXIF — drawing to a canvas strips all metadata).

export interface SquareImage {
  blob: Blob;
  extension: "webp" | "jpg";
}

/**
 * Which square of the photo to keep: zoom 1 = the largest square; x / y from
 * -1 (left/top edge) to 1 (right/bottom edge), 0 = centred.
 */
export interface SquareCrop {
  zoom: number;
  x: number;
  y: number;
}

/** The source square for a crop, in the photo's pixels. */
export function cropSquare(width: number, height: number, crop: SquareCrop = { zoom: 1, x: 0, y: 0 }): { sx: number; sy: number; side: number } {
  const zoom = Math.min(Math.max(crop.zoom || 1, 1), 5);
  const side = Math.min(width, height) / zoom;
  const clamp = (v: number) => Math.min(Math.max(v || 0, -1), 1);
  return { side, sx: ((width - side) / 2) * (1 + clamp(crop.x)), sy: ((height - side) / 2) * (1 + clamp(crop.y)) };
}

export async function toSquareImage(file: File, size: number, crop?: SquareCrop): Promise<SquareImage> {
  // imageOrientation: respects phone rotation so portraits aren't sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { sx, sy, side } = cropSquare(bitmap.width, bitmap.height, crop);

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

/**
 * Shrinks a photo to fit within `maxDimension` (keeping its shape) and under
 * `maxBytes`, lowering quality step by step if needed. Like toSquareImage,
 * drawing to a canvas strips EXIF (including location).
 */
export async function toCompressedImage(file: File, maxDimension: number, maxBytes: number): Promise<SquareImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const encode = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    const probe = await encode("image/webp", 0.8);
    const type = probe?.type === "image/webp" ? "image/webp" : "image/jpeg";
    for (const quality of [0.8, 0.65, 0.5, 0.35]) {
      const blob = quality === 0.8 && probe?.type === type ? probe : await encode(type, quality);
      if (blob && blob.size <= maxBytes) return { blob, extension: type === "image/webp" ? "webp" : "jpg" };
    }
    throw new Error("Image too large even after compression");
  } finally {
    bitmap.close();
  }
}
