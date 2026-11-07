"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Download, Share2 } from "lucide-react";
import { saveBlob } from "@/lib/save-file";
import { showToast } from "@/components/ui/Toaster";

/**
 * A photo opened full screen inside the app, like WhatsApp: black
 * background, back arrow, save and share, caption at the bottom. Pinch or
 * double-tap to zoom, drag to look around. The phone's Back button (or
 * Escape) closes it instead of leaving the chat.
 */
export function ImageViewer({ src, caption, title = "Photo", fileName = "photo", onClose }: { src: string; caption?: string; title?: string; fileName?: string; onClose: () => void }) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [chrome, setChrome] = useState(true);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; x: number; y: number; px: number; py: number } | null>(null);
  const lastTap = useRef(0);

  // Back closes the photo (one history entry while it's open).
  useEffect(() => {
    history.pushState({ imageViewer: true }, "");
    const onPop = () => onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && history.back();
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => history.back();
  const clamp = (s: number) => Math.min(5, Math.max(1, s));

  function down(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      gesture.current = { dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), scale: view.scale, x: view.x, y: view.y, px: 0, py: 0 };
    } else if (pts.length === 1) {
      gesture.current = { dist: 0, scale: view.scale, x: view.x, y: view.y, px: e.clientX, py: e.clientY };
      const now = Date.now();
      if (now - lastTap.current < 300) {
        setView((v) => (v.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 }));
        lastTap.current = 0;
      } else lastTap.current = now;
    }
  }
  function move(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    if (pts.length === 2 && g.dist) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      setView((v) => ({ ...v, scale: clamp((g.scale * dist) / g.dist) }));
    } else if (pts.length === 1 && view.scale > 1) {
      setView((v) => ({ ...v, x: g.x + (e.clientX - g.px), y: g.y + (e.clientY - g.py) }));
    }
  }
  function up(e: React.PointerEvent) {
    const wasTap = gesture.current && pointers.current.size === 1 && Math.hypot(e.clientX - gesture.current.px, e.clientY - gesture.current.py) < 6;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      if (view.scale <= 1.02) setView({ scale: 1, x: 0, y: 0 });
      // A single tap shows or hides the bars, like WhatsApp.
      if (wasTap) setTimeout(() => lastTap.current && Date.now() - lastTap.current >= 280 && setChrome((c) => !c), 300);
    }
  }

  async function file(): Promise<Blob | null> {
    try {
      const res = await fetch(src);
      return res.ok ? await res.blob() : null;
    } catch {
      return null;
    }
  }
  const ext = (b: Blob) => (b.type.includes("png") ? "png" : b.type.includes("webp") ? "webp" : "jpg");

  async function save() {
    const blob = await file();
    const ok = blob ? await saveBlob(blob, `${fileName}.${ext(blob)}`) : false;
    showToast(ok ? "Saved." : "Couldn't save the photo — try again.", ok ? "success" : "error");
  }
  async function share() {
    const blob = await file();
    if (!blob) return showToast("Couldn't share the photo — try again.", "error");
    const f = new File([blob], `${fileName}.${ext(blob)}`, { type: blob.type });
    try {
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], text: caption || undefined });
      else await save();
    } catch {
      /* cancelled */
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent px-2 pb-6 pt-[max(0.5rem,env(safe-area-inset-top))] transition-opacity ${chrome ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <button type="button" onClick={close} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Close">
          <ArrowLeft aria-hidden className="h-6 w-6" />
        </button>
        <p className="min-w-0 flex-1 truncate font-medium">{title}</p>
        <button type="button" onClick={share} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Share">
          <Share2 aria-hidden className="h-5 w-5" />
        </button>
        <button type="button" onClick={save} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Save">
          <Download aria-hidden className="h-5 w-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={caption || title}
          draggable={false}
          className="max-h-full max-w-full object-contain"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transition: gesture.current ? "none" : "transform 150ms" }}
        />
      </div>

      {caption && (
        <p className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 text-center text-sm transition-opacity ${chrome ? "opacity-100" : "opacity-0"}`}>
          {caption}
        </p>
      )}
    </div>,
    document.body
  );
}
