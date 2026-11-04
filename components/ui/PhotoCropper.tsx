"use client";

import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { cropSquare, type SquareCrop } from "@/lib/image-resize";

/**
 * Move and zoom a photo inside a circle before it's saved (profile photos).
 * Drag to move, slider or pinch-free +/− to zoom. Calls onDone with the crop.
 */
export function PhotoCropper({ file, onDone, onCancel, busy }: { file: File; onDone: (crop: SquareCrop) => void; onCancel: () => void; busy?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [crop, setCrop] = useState<SquareCrop>({ zoom: 1, x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const SIZE = 280;

  useEffect(() => {
    let alive = true;
    createImageBitmap(file, { imageOrientation: "from-image" })
      .then((b) => (alive ? setBitmap(b) : b.close()))
      .catch(() => setFailed(true));
    return () => {
      alive = false;
    };
  }, [file]);
  useEffect(() => () => bitmap?.close(), [bitmap]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !bitmap) return;
    const ratio = window.devicePixelRatio || 1;
    canvasRef.current!.width = SIZE * ratio;
    canvasRef.current!.height = SIZE * ratio;
    const { sx, sy, side } = cropSquare(bitmap.width, bitmap.height, crop);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE * ratio, SIZE * ratio);
  }, [bitmap, crop]);

  /** How many screen pixels moves the crop from one edge to the other. */
  function range() {
    if (!bitmap) return { rx: 1, ry: 1 };
    const { side } = cropSquare(bitmap.width, bitmap.height, crop);
    const scale = SIZE / side;
    return { rx: Math.max(((bitmap.width - side) / 2) * scale, 0.0001), ry: Math.max(((bitmap.height - side) / 2) * scale, 0.0001) };
  }
  const clamp = (v: number) => Math.min(Math.max(v, -1), 1);

  if (failed) return <p className="text-sm text-danger">We couldn&apos;t read that photo. Try a JPG or PNG.</p>;

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold">Move and zoom your photo</p>
      <div className="flex justify-center">
        <div className="relative overflow-hidden rounded-full bg-ink/10 ring-4 ring-gold/40" style={{ width: SIZE, height: SIZE, maxWidth: "100%" }}>
          <canvas
            ref={canvasRef}
            style={{ width: SIZE, height: SIZE, touchAction: "none", cursor: "grab" }}
            aria-label="Drag to move the photo"
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              drag.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const { rx, ry } = range();
              // Dragging right shows more of the left of the photo.
              setCrop((c) => ({ ...c, x: clamp(d.x - (e.clientX - d.px) / rx), y: clamp(d.y - (e.clientY - d.py) / ry) }));
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          />
          {!bitmap && <span className="absolute inset-0 grid place-items-center text-sm text-ink/60">Loading…</span>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-ghost btn-sm" aria-label="Zoom out" onClick={() => setCrop((c) => ({ ...c, zoom: Math.max(1, c.zoom - 0.25) }))}>
          <ZoomOut aria-hidden className="h-5 w-5" />
        </button>
        <input type="range" min={1} max={4} step={0.01} value={crop.zoom} onChange={(e) => setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))} className="flex-1 accent-[rgb(var(--ember))]" aria-label="Zoom" />
        <button type="button" className="btn-ghost btn-sm" aria-label="Zoom in" onClick={() => setCrop((c) => ({ ...c, zoom: Math.min(4, c.zoom + 0.25) }))}>
          <ZoomIn aria-hidden className="h-5 w-5" />
        </button>
      </div>
      <p className="text-xs text-ink/60">Drag the photo to move it; use the slider to zoom.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => onDone(crop)} disabled={!bitmap || busy} aria-busy={busy}>
          {busy ? "Saving…" : "Use this photo"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
