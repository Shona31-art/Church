import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { AuthShell, AuthHeading } from "@/components/brand/AuthShell";
import { ANDROID_APK_URL } from "@/lib/android";

export const metadata: Metadata = { title: "Grace for Android" };

/**
 * /android — download Grace's Android app (anyone can open this page).
 * The app comes from GitHub (.github/workflows/android.yml), not the Play Store.
 */
export default function AndroidPage() {
  return (
    <AuthShell>
      <div className="w-full max-w-[440px] space-y-6">
        <AuthHeading title="Grace for Android">
          Calls ring like a phone call — full screen, even when Grace is closed or your phone is locked — and the app icon shows how many messages are waiting.
        </AuthHeading>
        <a href={ANDROID_APK_URL} className="btn-primary w-full" download>
          <Download aria-hidden className="h-4 w-4" /> Download the app
        </a>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink/80">
          <li>Tap <strong>Download the app</strong>, then open <strong>grace.apk</strong> when it finishes (or find it in Downloads).</li>
          <li>
            If your phone asks, allow installs from your browser: <strong>Settings → Install unknown apps</strong> → your browser → <strong>Allow</strong>. Then go back and tap <strong>Install</strong>.
          </li>
          <li>Open Grace and sign in. Allow notifications, and the camera and microphone when you first make a call.</li>
          <li>
            In Grace, go to <strong>My account → Notifications</strong> and switch on everything under <strong>Android app</strong> so calls can ring over the lock screen.
          </li>
        </ol>
        <div className="rounded-2xl border border-line p-4 text-sm text-ink/70">
          <p className="font-medium text-ink">Good to know</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Android may say the app is from an unknown source — that&apos;s because it isn&apos;t from the Play Store. It&apos;s Grace&apos;s own app.</li>
            <li>Everything else updates by itself. When there&apos;s a new version of the app, download it here again and install it over the old one — you stay signed in.</li>
            <li>Already added Grace to your home screen from the browser? Remove that icon, so you don&apos;t get every notification twice.</li>
            <li>iPhone: keep using Grace from Safari (Share → Add to Home Screen).</li>
          </ul>
        </div>
        <p className="text-center text-sm">
          <Link href="/dashboard" className="link">
            Open Grace in the browser instead
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
