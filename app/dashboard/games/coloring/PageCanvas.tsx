"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { floodFill, glitterAt, hexToRgb, lineMask, rainbowAt } from "@/lib/coloring/flood";
import { haptic } from "@/lib/haptics";

export interface PageCanvasHandle {
  undo(): void;
  toBlob(): Promise<Blob | null>;
}

const MAX_SIDE = 900;
const UNDO_STEPS = 12;
const storeKey = (id: string) => `grace-coloring-page:${id}`;

/**
 * An uploaded colouring page on a canvas: tap inside an outline and the
 * colour fills up to the lines. Colouring is kept on this device.
 */
export const PageCanvas = forwardRef<PageCanvasHandle, { id: string; url: string; title: string; fill: { kind: "colour" | "glitter" | "rainbow" | "rubber"; colour: string }; onHistory: (canUndo: boolean) => void }>(
  function PageCanvas({ id, url, title, fill, onHistory }, ref) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const mask = useRef<Uint8Array | null>(null);
    const undo = useRef<ImageData[]>([]);
    const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

    useEffect(() => {
      let alive = true;
      undo.current = [];
      onHistory(false);
      setState("loading");
      const img = new Image();
      img.onload = () => {
        if (!alive || !canvas.current) return;
        const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const c = canvas.current;
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        mask.current = lineMask(ctx.getImageData(0, 0, w, h).data, w, h);
        // Carry on where they left off.
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(storeKey(id));
        } catch {
          /* private mode */
        }
        if (saved) {
          const prev = new Image();
          prev.onload = () => {
            if (alive) ctx.drawImage(prev, 0, 0, w, h);
            setState("ready");
          };
          prev.onerror = () => setState("ready");
          prev.src = saved;
        } else setState("ready");
      };
      img.onerror = () => alive && setState("failed");
      img.src = url;
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, url]);

    function keep() {
      try {
        localStorage.setItem(storeKey(id), canvas.current!.toDataURL("image/png"));
      } catch {
        /* too big for this phone's storage: it still works, it just isn't kept */
      }
    }

    useImperativeHandle(ref, () => ({
      undo() {
        const prev = undo.current.pop();
        const c = canvas.current;
        if (!prev || !c) return;
        c.getContext("2d")!.putImageData(prev, 0, 0);
        onHistory(undo.current.length > 0);
        keep();
      },
      toBlob: () => new Promise((resolve) => (canvas.current ? canvas.current.toBlob(resolve, "image/png") : resolve(null))),
    }));

    function tap(e: React.PointerEvent<HTMLCanvasElement>) {
      const c = canvas.current;
      if (!c || !mask.current || state !== "ready") return;
      const box = c.getBoundingClientRect();
      const x = ((e.clientX - box.left) / box.width) * c.width;
      const y = ((e.clientY - box.top) / box.height) * c.height;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      const image = ctx.getImageData(0, 0, c.width, c.height);
      const before = ctx.getImageData(0, 0, c.width, c.height);
      const rgb = hexToRgb(fill.kind === "rubber" ? "#ffffff" : fill.colour);
      const colourAt = fill.kind === "rainbow" ? rainbowAt(c.width, c.height) : fill.kind === "glitter" ? glitterAt(rgb) : () => rgb;
      if (!floodFill(image.data, mask.current, c.width, c.height, x, y, colourAt)) return;
      haptic("tap");
      ctx.putImageData(image, 0, 0);
      undo.current = [...undo.current.slice(-(UNDO_STEPS - 1)), before];
      onHistory(true);
      keep();
    }

    return (
      <div className="relative">
        <canvas ref={canvas} onPointerDown={tap} className="block h-auto w-full cursor-pointer touch-manipulation" aria-label={title} role="img" />
        {state !== "ready" && (
          <p className="absolute inset-0 grid min-h-[16rem] place-items-center bg-white text-sm text-ink/60">
            {state === "loading" ? "Getting the page ready…" : "This page couldn't be opened."}
          </p>
        )}
      </div>
    );
  }
);
