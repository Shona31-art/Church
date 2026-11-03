"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckSquare, ChevronDown, Forward, Pencil, Reply, Star, StarOff, Trash2 } from "lucide-react";
import { REACTIONS, REACTION_LABELS, type Reaction } from "@/lib/chat";

/**
 * The small ⌄ menu on a message: a row of reactions, then Reply / Edit /
 * Delete (each only when allowed), and Select for choosing several. It
 * floats above the page and is kept inside the screen, so nothing is cut
 * off at the chat's edges. Keyboard: Enter/Space opens, arrow keys
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
  onSelect,
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
  onSelect?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  // Below the ⌄ button, lined up with the bubble's side; flipped above it
  // near the bottom of the screen; never past either edge.
  useLayoutEffect(() => {
    if (!open) return setPlace(null);
    const button = buttonRef.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!button || !menu) return;
    const margin = 8;
    const { width, height } = menu.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const wantLeft = align === "right" ? button.right - width : button.left;
    const left = Math.min(Math.max(margin, wantLeft), Math.max(margin, vw - width - margin));
    const below = button.bottom + 4;
    const top = below + height <= vh - margin ? below : Math.max(margin, button.top - height - 4);
    setPlace({ top, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // The menu stays put on screen, so it closes when the chat scrolls or the screen turns.
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const items = () => [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem],[role=menuitemradio]") ?? [])];
    items()[0]?.focus({ preventScroll: true });

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

      {open &&
        createPortal(
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label="Message options"
          style={{ position: "fixed", top: place?.top ?? 0, left: place?.left ?? 0, visibility: place ? "visible" : "hidden" }}
          className="z-[60] w-60 max-w-[calc(100vw-1rem)] rounded-2xl border border-line bg-surface p-1.5 shadow-pop motion-safe:animate-modal-in"
        >
          {onReact && (
            <div className="mb-1 flex justify-between gap-0.5 border-b border-line px-0.5 pb-1.5" role="group" aria-label="React">
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
          {onSelect && (
            <button type="button" role="menuitem" className={itemClass} onClick={() => run(onSelect)}>
              <CheckSquare aria-hidden className="h-4 w-4 text-ink/60" /> Select messages
            </button>
          )}
        </div>,
          document.body
        )}
    </div>
  );
}
