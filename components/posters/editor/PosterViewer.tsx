"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type Konva from "konva";
import { Download } from "lucide-react";
import { showToast } from "@/components/ui/Toaster";
import type { PosterDesign } from "@/lib/posters/design";
import { fontsInDesign, loadFonts } from "@/lib/posters/fonts";
import { ShareButton } from "@/components/ShareButton";

const EditorCanvas = dynamic(() => import("./EditorCanvas").then((m) => m.EditorCanvas), {
  ssr: false,
  loading: () => <p className="text-sm text-ink/60">Loading poster…</p>,
});

/** A saved design, read-only, with PNG/JPG download. For people who can see a poster but not edit it. */
export function PosterViewer({ design, title, imageUrls }: { design: PosterDesign; title: string; imageUrls?: Record<string, string> }) {
  const box = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [scale, setScale] = useState(0.3);
  const [fontVersion, setFontVersion] = useState(0);

  useEffect(() => {
    loadFonts(fontsInDesign(design.elements)).then(() => setFontVersion((n) => n + 1));
  }, [design]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScale(Math.min(el.clientWidth / design.width, (window.innerHeight * 0.7) / design.height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [design.width, design.height]);

  /** The poster as an image file, for the phone's share sheet (straight into WhatsApp). */
  async function shareFile() {
    const stage = stageRef.current;
    if (!stage) return null;
    try {
      const blob = await (await fetch(stage.toDataURL({ pixelRatio: 1 / scale, mimeType: "image/jpeg", quality: 0.92 }))).blob();
      const name = `${(title || "poster").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.jpg`;
      return { title, file: new File([blob], name, { type: "image/jpeg" }) };
    } catch {
      showToast("Couldn't create the image on this device. Try on a computer.", "error");
      return null;
    }
  }

  function download(type: "png" | "jpeg") {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      const a = document.createElement("a");
      a.href = stage.toDataURL({ pixelRatio: 1 / scale, mimeType: `image/${type}`, quality: 0.92 });
      a.download = `${(title || "poster").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${type === "png" ? "png" : "jpg"}`;
      a.click();
    } catch {
      showToast("Couldn't create the image on this device. Try on a computer.", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div ref={box} className="flex justify-center">
        <div className="shadow-card" role="img" aria-label={`Poster: ${title}`}>
          <EditorCanvas
            design={design}
            scale={scale}
            selectedId={null}
            editingId={null}
            readOnly
            fontVersion={fontVersion}
            imageUrls={imageUrls}
            stageRef={stageRef}
            onSelect={() => undefined}
            onChange={() => undefined}
            onStartEditText={() => undefined}
          />
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-primary" onClick={() => download("png")}>
          <Download aria-hidden className="h-4 w-4" /> Download PNG
        </button>
        <button type="button" className="btn-secondary" onClick={() => download("jpeg")}>
          Download JPG
        </button>
        <ShareButton content={shareFile} label="Share image" />
      </div>
    </div>
  );
}
