import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";
import { ErrorReporter } from "@/components/ErrorReporter";

// Self-hosted by next/font: no request to Google at runtime and no layout
// shift while the font loads.
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Cormorant Garamond: a high-contrast engraved serif for headings — the
// letterhead of a private bank rather than a web app.
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "Grace-bound",
  description: "A church operating system for people, not just Sundays.",
  applicationName: "Grace-bound",
  // iPhone/iPad "Add to Home Screen": open full screen with this name. The
  // status bar uses the page's theme colour ("default" keeps it out of the
  // way of content, so pages don't need top padding for it).
  // BRAND PLACEHOLDER: no apple-touch-icon until the real logo arrives — iOS
  // uses a screenshot of the page meanwhile (README "Known gaps").
  appleWebApp: { capable: true, title: "Grace-bound", statusBarStyle: "default" },
  // Stop iOS turning numbers (amounts, dates) into phone links.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw edge to edge; globals.css and the shell pad for the home indicator
  // and landscape notch with env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F3EC" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0B0C" },
  ],
};

// Runs before the page paints, so someone who chose "Dark" (or "Light")
// never sees a flash of the other theme. "system" leaves the attribute off
// and the CSS media query decides. Wrapped in try: storage can be blocked.
const applySavedTheme = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script above may set data-theme before React hydrates.
    <html lang="en" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applySavedTheme }} />
      </head>
      <body>
        {children}
        {/* On every page (not just the dashboard), so an installed app opened
            offline on the sign-in screen still gets the offline page. */}
        <ServiceWorker />
        <ErrorReporter />
      </body>
    </html>
  );
}
