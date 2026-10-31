import { Cross } from "@/components/brand/Cross";
import { APP_NAME, COMPANY_NAME } from "@/lib/brand";

/**
 * A short branded screen when the installed app opens: carries on from the
 * phone's own splash (which only shows the icon) and adds the app's name.
 * Shown once per launch, only in the installed app, with no JavaScript
 * state — layout.tsx's head script sets html[data-launch] and CSS
 * (globals.css .launch-splash) fades it away.
 */
export function LaunchSplash() {
  return (
    <div aria-hidden className="launch-splash">
      <Cross className="h-28 w-28" />
      <p className="mt-5 font-script text-6xl leading-none text-[#9fe3e7]">{APP_NAME}</p>
      <p className="mt-3 text-[11px] uppercase tracking-[0.3em] text-white/50">by {COMPANY_NAME}</p>
    </div>
  );
}
