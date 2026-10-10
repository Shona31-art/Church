"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

const WIDTHS = {
  md: "md:max-w-xl",
  lg: "md:max-w-3xl",
  xl: "md:max-w-5xl",
} as const;

/**
 * Shows a form page as a popup over the page you came from.
 *
 * How it fits together: app/dashboard/@modal holds an "intercepting route"
 * for each form (e.g. @modal/(.)calendar/new). Clicking a link to that URL
 * inside the dashboard renders the form here instead of navigating away;
 * refreshing or opening the link directly shows the normal full page. After
 * a save, the server action redirects elsewhere and @modal/[...catchAll]
 * clears the slot, which unmounts this modal.
 *
 * Built on native <dialog> (like ConfirmSubmitButton): focus stays inside,
 * Escape closes it, and focus returns to the link that opened it. Clicking
 * the backdrop deliberately does nothing — too easy to lose a half-filled form.
 */
export function RouteModal({ children, size = "lg" }: { children: React.ReactNode; size?: keyof typeof WIDTHS }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dirty = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    // The page's own <h1> names the dialog for screen readers.
    const heading = dialog.querySelector("h1");
    if (heading) {
      heading.id ||= "route-modal-title";
      dialog.setAttribute("aria-labelledby", heading.id);
    }

    // Native modal dialogs don't stop the page behind them scrolling.
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, []);

  function close() {
    if (dirty.current && !window.confirm("Discard your changes? Anything you've typed in this form will be lost.")) return;
    // The modal only ever appears after an in-app navigation, so there is
    // always a previous page in history to go back to.
    router.back();
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault(); // Escape: run the same unsaved-changes check as the close button
        close();
      }}
      onInput={() => {
        dirty.current = true;
      }}
      className={`m-0 h-full max-h-full w-full max-w-full rounded-none bg-parchment overflow-y-auto p-0 text-ink shadow-pop backdrop:bg-ink/45 backdrop:backdrop-blur-[2px] md:border md:border-line motion-safe:animate-modal-in md:m-auto md:h-auto md:max-h-[90vh] md:w-[calc(100%-2rem)] md:rounded-2xl ${WIDTHS[size]} [&_[data-page-back]]:hidden`}
    >
      <div className="sticky top-0 z-10 flex justify-end bg-parchment/95 px-3 pt-3 backdrop-blur">
        <button type="button" onClick={close} className="btn-secondary btn-sm h-9 w-9 rounded-full p-0" aria-label="Close">
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
      <div className="px-5 pb-6 md:px-8 md:pb-8">{children}</div>
    </dialog>
  );
}
