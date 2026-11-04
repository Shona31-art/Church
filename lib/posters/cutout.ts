// "Remove background" for the poster editor: cuts a person out of a photo,
// like the pastor cut-outs on professional church flyers. Runs entirely in
// the browser with Google's MediaPipe Selfie Segmentation (Apache 2.0),
// self-hosted in public/vendor/selfie-segmentation/ — the photo never leaves
// the device and there's no outside service or cost. Browser only.

const BASE = "/vendor/selfie-segmentation/";
/** Long side of the image we work on: plenty for a poster, quick on a phone. */
const WORK_SIZE = 1600;

type Results = { segmentationMask: CanvasImageSource };
interface SelfieSegmentation {
  setOptions(o: { modelSelection: 0 | 1; selfieMode?: boolean }): void;
  onResults(cb: (r: Results) => void): void;
  initialize(): Promise<void>;
  send(input: { image: CanvasImageSource }): Promise<void>;
}
type Ctor = new (config: { locateFile: (file: string) => string }) => SelfieSegmentation;

let scriptLoading: Promise<Ctor> | null = null;

function loadLibrary(): Promise<Ctor> {
  scriptLoading ??= new Promise<Ctor>((resolve, reject) => {
    const existing = (window as unknown as { SelfieSegmentation?: Ctor }).SelfieSegmentation;
    if (existing) return resolve(existing);
    const script = document.createElement("script");
    script.src = `${BASE}selfie_segmentation.js`;
    script.async = true;
    script.onload = () => {
      const ctor = (window as unknown as { SelfieSegmentation?: Ctor }).SelfieSegmentation;
      if (ctor) resolve(ctor);
      else reject(new Error("Background remover didn't load"));
    };
    script.onerror = () => reject(new Error("Background remover didn't load"));
    document.head.appendChild(script);
  }).catch((error) => {
    scriptLoading = null; // try again next time
    throw error;
  });
  return scriptLoading;
}

let segmenter: Promise<{ seg: SelfieSegmentation; next: (r: Results) => void }> | null = null;

async function getSegmenter() {
  segmenter ??= (async () => {
    const Ctor = await loadLibrary();
    const seg = new Ctor({ locateFile: (file) => `${BASE}${file}` });
    seg.setOptions({ modelSelection: 0, selfieMode: false });
    const holder = { seg, next: (_: Results) => undefined as void };
    seg.onResults((r) => holder.next(r));
    await seg.initialize();
    return holder;
  })().catch((error) => {
    segmenter = null;
    throw error;
  });
  return segmenter;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return img;
}

/**
 * The person (or people) in the photo on a transparent background, as a PNG,
 * trimmed to fit. Throws a plain-language error if nobody was found.
 */
export async function cutOutPerson(url: string): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImage(url);
  const scale = Math.min(1, WORK_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const source = document.createElement("canvas");
  source.width = w;
  source.height = h;
  source.getContext("2d")!.drawImage(img, 0, 0, w, h);

  const { seg, next } = await getSegmenter().then((s) => ({ seg: s.seg, next: s }));
  const mask = await new Promise<CanvasImageSource>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The background remover took too long.")), 30_000);
    next.next = (r) => {
      clearTimeout(timer);
      resolve(r.segmentationMask);
    };
    seg.send({ image: source }).catch(reject);
  });

  // The mask is low resolution: scale it up, soften its edge a little, then
  // keep only the photo where the mask is.
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.filter = `blur(${Math.max(1, Math.round(Math.max(w, h) / 600))}px)`;
  ctx.drawImage(mask, 0, 0, w, h);
  ctx.filter = "none";
  // Firm up the soft mask: fully keep confident areas, fade only the edge.
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3] || px[i]; // the mask may come as alpha or as red
    const firm = Math.max(0, Math.min(255, (a - 64) * 1.8));
    px[i] = px[i + 1] = px[i + 2] = 255;
    px[i + 3] = firm;
  }
  ctx.putImageData(data, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = "source-over";

  // Trim the empty space around the person.
  const alpha = ctx.getImageData(0, 0, w, h).data;
  let top = h, left = w, right = -1, bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[(y * w + x) * 4 + 3] > 24) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        bottom = y;
      }
    }
  }
  const found = right >= 0 && (right - left) * (bottom - top) > w * h * 0.02;
  if (!found) throw new Error("No person was found in this photo. Background removal works best on a clear photo of someone from the waist up.");
  const tw = right - left + 1;
  const th = bottom - top + 1;
  const trimmed = document.createElement("canvas");
  trimmed.width = tw;
  trimmed.height = th;
  trimmed.getContext("2d")!.drawImage(out, left, top, tw, th, 0, 0, tw, th);
  const blob = await new Promise<Blob>((resolve, reject) => trimmed.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the image."))), "image/png"));
  return { blob, width: tw, height: th };
}
