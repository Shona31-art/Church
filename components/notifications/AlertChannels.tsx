"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { setWhatsAppAlerts } from "@/app/dashboard/account/notification-actions";
import { showToast } from "@/components/ui/Toaster";

/** Pastors & admins: also get alerts (bookings, shared counseling, prayer requests, new members) on WhatsApp. */
export function AlertChannels({
  initial,
  phone,
  available,
}: {
  initial: boolean;
  phone: string | null;
  /** Whether the platform has WhatsApp alerts switched on (Make.com). */
  available: boolean;
}) {
  const [on, setOn] = useState(initial);

  async function toggle() {
    const enabled = !on;
    setOn(enabled);
    const res = await setWhatsAppAlerts(enabled).catch(() => null);
    if (!res?.ok) {
      setOn(!enabled);
      showToast(res && !res.ok ? res.error : "Couldn't save that setting. Try again.", "error");
    }
  }

  const detail = !available ? "Not switched on for the app yet." : phone ? `To ${phone}` : "Add your phone number under My details first.";

  return (
    <fieldset className="mt-6">
      <legend className="label">Pastor &amp; admin alerts on WhatsApp</legend>
      <p className="hint mb-3 mt-0">Booking requests, counseling shared or flagged, new prayer requests and new members.</p>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
        <label htmlFor="alert-whatsapp" className="flex min-w-0 cursor-pointer gap-3">
          <MessageCircle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ink/60" />
          <span>
            <span className="block text-sm font-semibold">WhatsApp</span>
            <span className="block text-sm text-ink/60">{detail}</span>
          </span>
        </label>
        <button
          id="alert-whatsapp"
          type="button"
          role="switch"
          aria-checked={on}
          onClick={toggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-ember" : "bg-ink/20"}`}
        >
          <span className="sr-only">{on ? "On" : "Off"}</span>
          <span aria-hidden className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-xs transition-transform ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
        </button>
      </div>
    </fieldset>
  );
}
