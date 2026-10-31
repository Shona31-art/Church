"use client";

import { enqueue, isOffline, type QueuedKind } from "@/lib/offline-queue";
import { showToast } from "@/components/ui/Toaster";
import { haptic } from "@/lib/haptics";

/**
 * onSubmit for a form that should still work without signal: when offline,
 * keep the form on this device (lib/offline-queue.ts), clear it, and stay on
 * the page (other pages may not be available offline). Online, the normal
 * server action runs as usual. `onQueued` clears controlled fields.
 */
export function useOfflineSubmit(kind: QueuedKind, onQueued?: () => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    if (!isOffline()) return;
    e.preventDefault();
    const form = e.currentTarget;
    if (enqueue(kind, form)) {
      form.reset();
      onQueued?.();
      haptic("success");
      showToast("You're offline, so it's saved on this phone. It'll be sent automatically when you're back online.", "info");
    } else {
      showToast("You're offline and this couldn't be stored on the phone. Copy your text and try again later.", "error");
    }
  };
}
