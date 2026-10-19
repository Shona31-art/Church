import type { Metadata, Viewport } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";

// Self-hosted by next/font: no request to Google at runtime and no layout
// shift while the font loads.
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display", display: "swap" });

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
    { media: "(prefers-color-scheme: light)", color: "#F8F7F4" },
    { media: "(prefers-color-scheme: dark)", color: "#0D0F15" },
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
      </body>
    </html>
  );
}
