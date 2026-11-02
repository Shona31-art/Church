"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Forward, Pencil, Reply, Star, StarOff, Trash2 } from "lucide-react";
import { REACTIONS, REACTION_LABELS, type Reaction } from "@/lib/chat";

/**
 * The small ⌄ menu on a message: a row of reactions, then Reply / Edit /
 * Delete (each only when allowed). Keyboard: Enter/Space opens, arrow keys
 * move between items, Escape closes and returns focus to the button.
 */
export function MessageMenu({
  align,
  senderLabel,
  myReaction,
  onReact,
  onReply,
  onEdit,
  onDelete,
  starred = false,
  onStar,
  onForward,
}: {
  align: "left" | "right";
  senderLabel: string;
  myReaction: Reaction | null;
  onReact?: (emoji: Reaction) => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  starred?: boolean;
  onStar?: () => void;
  onForward?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const items = () => [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem],[role=menuitemradio]") ?? [])];
    items()[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      } else if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const list = items();
        const index = list.indexOf(document.activeElement as HTMLButtonElement);
        const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
        list[(index + step + list.length) % list.length]?.focus();
      }
    }
    function onPointer(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  function run(action?: () => void) {
    setOpen(false);
    action?.();
  }

  const itemClass = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink/5 focus-visible:bg-ink/5";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`Message options (${senderLabel})`}
        className="flex h-7 w-7 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5 hover:text-ink"
      >
        <ChevronDown aria-hidden className="h-4 w-4" />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label="Message options"
          className={`absolute top-8 z-20 w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-pop motion-safe:animate-modal-in ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {onReact && (
            <div className="mb-1 flex justify-between border-b border-line px-1 pb-1.5" role="group" aria-label="React">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  role="menuitemradio"
                  aria-checked={myReaction === emoji}
                  aria-label={`React with ${REACTION_LABELS[emoji]}`}
                  onClick={() => run(() => onReact(emoji))}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-lg hover:scale-110 hover:bg-ink/5 ${
                    myReaction === emoji ? "bg-gold/20" : ""
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {onReply && (
            <button type="button" role="menuitem" className={itemClass} onClick={() => run(onReply)}>
              <Reply aria-hidden className="h-4 w-4 text-ink/60" /> Reply
            </button>
          )}
          {onForward && (
            <button type="button" role="menuitem" className={itemClass} onClick={() => run(onForward)}>
              <Forward aria-hidden className="h-4 w-4 text-ink/60" /> Forward
            </button>
          )}
          {onStar && (
            <button type="button" role="menuitem" className={itemClass} onClick={() => run(onStar)}>
              {starred ? <StarOff aria-hidden className="h-4 w-4 text-ink/60" /> : <Star aria-hidden className="h-4 w-4 text-ink/60" />} {starred ? "Unstar" : "Star"}
            </button>
          )}
          {onEdit && (
            <button type="button" role="menuitem" className={itemClass} onClick={() => run(onEdit)}>
              <Pencil aria-hidden className="h-4 w-4 text-ink/60" /> Edit
            </button>
          )}
          {onDelete && (
            <button type="button" role="menuitem" className={`${itemClass} text-danger`} onClick={() => run(onDelete)}>
              <Trash2 aria-hidden className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
