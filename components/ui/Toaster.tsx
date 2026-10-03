"use client";

import { useEffect, useState } from "react";

// Toast notifications ("Member added.", "Couldn't save — try again.").
//
// Two ways in:
//   * Server actions call flash() (lib/flash.ts), which sets a short-lived
//     cookie. It survives a redirect, and this component picks it up on the
//     next render and deletes it.
//   * Client components call showToast() directly.

type Tone = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const EVENT = "app:toast";
const FLASH_COOKIE = "flash";

export function showToast(message: string, tone: Tone = "success") {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, tone } }));
}

function readFlashCookie(): { message: string; tone: Tone } | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${FLASH_COOKIE}=([^;]*)`));
  if (!match) return null;
  document.cookie = `${FLASH_COOKIE}=; path=/; max-age=0; samesite=lax`;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]));
    if (typeof parsed?.m !== "string") return null;
    return { message: parsed.m.slice(0, 300), tone: ["success", "error", "info"].includes(parsed.t) ? parsed.t : "info" };
  } catch {
    return null;
  }
}

const TONE_CLASS: Record<Tone, string> = {
  success: "border-success-line bg-success-tint text-success",
  error: "border-danger-line bg-danger-tint text-danger",
  info: "border-info-line bg-info-tint text-info",
};
const TONE_ICON: Record<Tone, string> = { success: "✓", error: "⚠", info: "i" };

let nextId = 1;

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function push(message: string, tone: Tone) {
    const id = nextId++;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    // Errors stay until dismissed; confirmations fade after a few seconds.
    if (tone !== "error") setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }

  // Runs after every render: a server action that set a flash cookie causes
  // the dashboard to re-render, which is when we look for it.
  useEffect(() => {
    const flash = readFlashCookie();
    if (flash) push(flash.message, flash.tone);
  });

  useEffect(() => {
    const onToast = (e: Event) => {
      const { message, tone } = (e as CustomEvent<{ message: string; tone: Tone }>).detail;
      push(message, tone);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${TONE_CLASS[t.tone]}`}
        >
          <span aria-hidden className="font-bold">
            {TONE_ICON[t.tone]}
          </span>
          <p className="flex-1">{t.message}</p>
          <button
            type="button"
            onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
            className="-m-1 p-1 opacity-70 hover:opacity-100"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
