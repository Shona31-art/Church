"use client";

import { useEffect, useRef, useState } from "react";

// A small, hand-picked emoji set — no extra package. Faith & church comes
// first because it's what people here reach for most.
const CATEGORIES: { key: string; label: string; icon: string; emoji: string[] }[] = [
  {
    key: "faith",
    label: "Faith & church",
    icon: "🙏",
    emoji: ["🙏", "✝️", "⛪", "🕊️", "📖", "🛐", "🕯️", "👼", "😇", "🙌", "👐", "💒", "🍞", "🍷", "🐑", "🌿", "🌅", "⭐", "🌈", "🔥", "💧", "🎶", "🎵", "🎹", "🎸", "🥁", "🔔", "👑", "🫶", "❤️‍🔥"],
  },
  {
    key: "smileys",
    label: "Smileys",
    icon: "😊",
    emoji: ["😊", "😀", "😃", "😄", "😁", "😆", "😂", "🤣", "🙂", "😉", "😍", "🥰", "😘", "🤗", "🤭", "🤔", "😌", "😎", "🥳", "😅", "😮", "😲", "🥺", "😢", "😭", "😔", "😟", "😴", "🤒", "🤧", "😷", "🙃", "😬", "🫡", "🤩", "😇"],
  },
  {
    key: "people",
    label: "People & hands",
    icon: "👋",
    emoji: ["👋", "👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "👌", "🤲", "💪", "👊", "✋", "☝️", "👉", "👀", "🧠", "👶", "🧒", "👧", "👦", "👩", "👨", "👵", "👴", "👪", "💃", "🕺", "🚶", "🏃"],
  },
  {
    key: "hearts",
    label: "Hearts & symbols",
    icon: "❤️",
    emoji: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🤍", "🖤", "💕", "💞", "💗", "💖", "💝", "💯", "✨", "🌟", "💫", "🎉", "🎊", "🎈", "🎁", "✅", "❗", "❓", "➕", "📌", "📅", "⏰", "📣", "💬"],
  },
  {
    key: "nature",
    label: "Nature & food",
    icon: "🌻",
    emoji: ["🌻", "🌸", "🌹", "🌷", "🌳", "🍃", "☀️", "🌙", "⛅", "🌧️", "❄️", "🌊", "🏔️", "🦁", "🐟", "🐦", "🦋", "🐝", "🍎", "🍇", "🍊", "🍰", "🎂", "☕", "🍵", "🥘", "🍕", "🍔", "🥗", "🍫"],
  },
];

const RECENT_KEY = "chat-recent-emoji";
const RECENT_MAX = 16;

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function rememberRecent(emoji: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([emoji, ...readRecent().filter((e) => e !== emoji)].slice(0, RECENT_MAX)));
  } catch {
    // Storage blocked (private mode): recents just aren't kept.
  }
}

/**
 * Emoji panel above the message box. Arrow keys move between emoji, Enter
 * picks, Escape closes (and returns focus to the message box).
 */
export function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(CATEGORIES[0].key);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const r = readRecent();
    setRecent(r);
    if (r.length) setActive("recent");
  }, []);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLButtonElement>("[data-emoji]")?.focus();
  }, [active]);

  useEffect(() => {
    function onPointer(e: PointerEvent) {
      if (!panelRef.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest("[data-emoji-toggle]")) onClose();
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [onClose]);

  const tabs = [...(recent.length ? [{ key: "recent", label: "Recently used", icon: "🕘", emoji: recent }] : []), ...CATEGORIES];
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  function pick(emoji: string) {
    rememberRecent(emoji);
    onPick(emoji);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    const buttons = [...(panelRef.current?.querySelectorAll<HTMLButtonElement>("[data-emoji]") ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    const perRow = 8;
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: perRow, ArrowUp: -perRow }[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      buttons[Math.max(0, Math.min(buttons.length - 1, index + delta))]?.focus();
    }
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Emoji"
      onKeyDown={onKeyDown}
      className="absolute bottom-full left-2 right-2 z-20 mb-2 rounded-2xl border border-line bg-surface p-2 shadow-pop motion-safe:animate-modal-in sm:right-auto sm:w-[22rem]"
    >
      <div role="tablist" aria-label="Emoji categories" className="mb-2 flex gap-1 border-b border-line pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === current.key}
            aria-label={t.label}
            title={t.label}
            onClick={() => setActive(t.key)}
            className={`flex h-8 w-9 items-center justify-center rounded-lg text-lg ${t.key === current.key ? "bg-gold/20" : "hover:bg-ink/5"}`}
          >
            {t.icon}
          </button>
        ))}
      </div>
      <p className="eyebrow mb-1 px-1">{current.label}</p>
      <div role="tabpanel" aria-label={current.label} className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto">
        {current.emoji.map((emoji) => (
          <button
            key={emoji}
            type="button"
            data-emoji
            onClick={() => pick(emoji)}
            className="flex aspect-square items-center justify-center rounded-lg text-2xl transition-transform hover:scale-110 hover:bg-ink/5 focus-visible:bg-ink/5"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
