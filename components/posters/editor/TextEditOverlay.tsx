"use client";

import { useEffect, useRef } from "react";
import type { TextElement } from "@/lib/posters/design";
import { cssFontFamily } from "@/lib/posters/fonts";

/**
 * Type straight onto the poster: a transparent textarea laid exactly over the
 * text being edited (the canvas text is hidden meanwhile). Escape or clicking
 * away finishes; Enter makes a new line.
 */
export function TextEditOverlay({ element, scale, onChange, onDone }: { element: TextElement; scale: number; onChange: (text: string) => void; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  // Grow with the text so nothing is hidden while typing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [element.text, scale]);

  return (
    <textarea
      ref={ref}
      aria-label="Edit text"
      value={element.text}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onDone();
        }
        e.stopPropagation(); // keep editor shortcuts (Delete, arrows) from firing while typing
      }}
      spellCheck
      className="absolute m-0 resize-none overflow-hidden border-0 bg-white/10 p-0 outline outline-2 outline-gold"
      style={{
        left: element.x * scale,
        top: element.y * scale,
        width: element.width * scale,
        transform: `rotate(${element.rotation}deg)`,
        transformOrigin: "top left",
        fontFamily: cssFontFamily(element.fontFamily),
        fontSize: element.fontSize * scale,
        fontWeight: element.fontWeight,
        fontStyle: element.italic ? "italic" : "normal",
        lineHeight: element.lineHeight,
        letterSpacing: element.letterSpacing * scale,
        textTransform: element.uppercase ? "uppercase" : "none",
        textAlign: element.align,
        color: element.fill,
        caretColor: element.fill,
      }}
    />
  );
}
