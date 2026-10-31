"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleAlert, Info, Menu, MoreHorizontal, TriangleAlert, X } from "lucide-react";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "@/components/ui/Toaster";
import { NavIcon } from "@/components/ui/NavIcon";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { Avatar } from "@/components/ui/Avatar";
import { initials } from "@/lib/initials";
import { activeHref, buildTabBar, hidesTabBar, type NavGroup } from "@/lib/navigation";
import { KeyboardViewport } from "@/components/KeyboardViewport";
import { PullToRefresh } from "@/components/PullToRefresh";
import { HapticClicks } from "@/components/Haptics";
import { OfflineQueueSender } from "@/components/OfflineQueue";
import { WelcomeTour } from "@/components/WelcomeTour";
import { NotificationBell, NotificationsProvider } from "@/components/notifications/NotificationBell";
// Imported for its side effect: starts listening for the browser's one-time install prompt as early as possible.
import "@/components/install/install-store";

export interface AccountBanner {
  tone: "info" | "warning" | "error";
  message: string;
  action?: { href: string; label: string };
}

const BANNER: Record<AccountBanner["tone"], { className: string; Icon: typeof Info }> = {
  info: { className: "bg-info-tint text-info border-info-line", Icon: Info },
  warning: { className: "bg-warning-tint text-warning border-warning-line", Icon: TriangleAlert },
  error: { className: "bg-danger-tint text-danger border-danger-line", Icon: CircleAlert },
};

export function DashboardChrome({
  navGroups,
  churchName,
  userId,
  initialUnread,
  userName,
  userRole,
  userPhotoUrl,
  banner,
  children,
}: {
  navGroups: NavGroup[];
  churchName: string;
  userId: string;
  /** Unread notifications when the page was rendered; the bell keeps it live after that. */
  initialUnread: number;
  userName: string;
  userRole: string;
  userPhotoUrl: string | null;
  banner: AccountBanner | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const current = activeHref(pathname, navGroups);
  const tabs = buildTabBar(navGroups);
  const showTabs = tabs.length > 1 && !hidesTabBar(pathname);

  // Close the drawer on navigation, and on Escape (returning focus to the
  // menu button so keyboard users aren't dropped at the top of the page).
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const sidebar = (
    <Sidebar groups={navGroups} current={current} churchName={churchName} userName={userName} userRole={userRole} userPhotoUrl={userPhotoUrl} />
  );

  return (
    <NotificationsProvider userId={userId} initialUnread={initialUnread}>
      <div className="min-h-screen min-h-dvh md:flex">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-pop"
        >
          Skip to content
        </a>

        {/* Desktop: a fixed obsidian sidebar holds navigation, identity and
            account. scope-dark switches every token inside it to the dark
            palette, in light mode too. */}
        <aside className="scope-dark panel-luxe hidden md:flex md:w-[17rem] md:shrink-0 md:flex-col md:sticky md:top-0 md:h-screen border-r border-line">
          {sidebar}
        </aside>

        {/* Phones: a slim top bar with the menu button. */}
        <header className="md:hidden sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-surface/85 px-3 py-2.5 backdrop-blur-md">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="btn-ghost btn-icon"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            <Menu aria-hidden className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            <Monogram text={initials(churchName)} small />
            <span className="truncate font-display text-lg font-semibold">{churchName}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell />
            <Link href="/dashboard/account" aria-label="My account" className="rounded-full">
              <Avatar name={userName} src={userPhotoUrl} />
            </Link>
          </div>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-30 md:hidden">
            <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] motion-safe:animate-fade-in" onClick={() => setMobileOpen(false)} aria-hidden />
            <aside id="mobile-nav" className="scope-dark panel-luxe absolute bottom-0 left-0 top-0 flex w-72 max-w-[85vw] flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] shadow-pop motion-safe:animate-modal-in">
              <button type="button" onClick={() => setMobileOpen(false)} className="btn-ghost btn-icon absolute right-2 top-3 z-10" aria-label="Close menu">
                <X aria-hidden className="h-5 w-5" />
              </button>
              {sidebar}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {banner && <Banner banner={banner} />}
          <main
            id="main"
            className={`flex-1 px-4 py-6 sm:px-8 sm:py-8 md:pb-[max(2rem,env(safe-area-inset-bottom))] lg:px-12 lg:py-10 motion-safe:animate-fade-in ${
              showTabs ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]" : "pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            }`}
          >
            {children}
          </main>
        </div>

        {showTabs && (
          <nav
            aria-label="Quick"
            data-tab-bar
            className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-md md:hidden"
          >
            <ul className="mx-auto flex max-w-lg">
              {tabs.map((tab) => {
                const active = tab.href === current;
                return (
                  <li key={tab.href} className="flex-1">
                    <Link
                      href={tab.href}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 text-micro font-semibold tracking-wide ${active ? "text-ink" : "text-ink/60"}`}
                    >
                      {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-b-full bg-gold" />}
                      <NavIcon name={tab.icon} className={`h-[22px] w-[22px] ${active ? "text-gold-deep" : ""}`} />
                      {tab.label}
                    </Link>
                  </li>
                );
              })}
              <li className="flex-1">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  aria-expanded={mobileOpen}
                  aria-controls="mobile-nav"
                  className="flex min-h-[56px] w-full flex-col items-center justify-center gap-1 text-micro font-semibold tracking-wide text-ink/60"
                >
                  <MoreHorizontal aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.75} />
                  More
                </button>
              </li>
            </ul>
          </nav>
        )}

        <KeyboardViewport />
        <HapticClicks />
        <OfflineQueueSender />
        {pathname === "/dashboard" && userRole !== "Platform admin" && (
          <WelcomeTour availableHrefs={navGroups.flatMap((g) => g.items.map((i) => i.href))} firstName={userName.split(" ")[0]} />
        )}
        <PullToRefresh enabled={!hidesTabBar(pathname) && !pathname.startsWith("/dashboard/bible/read")} />
        <Toaster />
      </div>
    </NotificationsProvider>
  );
}

function Banner({ banner }: { banner: AccountBanner }) {
  const { className, Icon } = BANNER[banner.tone];
  return (
    <div role="status" className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2.5 text-sm ${className}`}>
      <Icon aria-hidden className="h-4 w-4 shrink-0" />
      <span>{banner.message}</span>
      {banner.action && (
        <Link href={banner.action.href} className="font-semibold underline underline-offset-4">
          {banner.action.label}
        </Link>
      )}
    </div>
  );
}

function Sidebar({
  groups,
  current,
  churchName,
  userName,
  userRole,
  userPhotoUrl,
}: {
  groups: NavGroup[];
  current: string | null;
  churchName: string;
  userName: string;
  userRole: string;
  userPhotoUrl: string | null;
}) {
  return (
    <>
      {/* Church identity. The monogram stands in until the church uploads a
          logo — flagged in the README's placeholder list. */}
      <div className="flex items-center gap-1 border-b border-line pb-5 pl-5 pr-12 pt-6 md:pr-2">
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-3">
          <Monogram text={initials(churchName)} />
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-semibold leading-tight">{churchName}</p>
            <p className="mt-0.5 font-script text-lg leading-none text-gold">Grace</p>
          </div>
        </Link>
        {/* Desktop only: on phones the bell lives in the top bar, not the menu drawer. */}
        <NotificationBell className="hidden shrink-0 md:inline-flex" />
      </div>

      <nav aria-label="Main" className="flex-1 space-y-7 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="eyebrow mb-2 px-3 text-micro text-gold/80">{group.label}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = item.href === current;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                        active
                          ? "bg-gradient-to-r from-gold/[0.16] to-transparent font-semibold text-ink"
                          : "text-ink/70 hover:bg-ink/[0.05] hover:text-ink"
                      }`}
                    >
                      {active && <span aria-hidden className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gold" />}
                      <NavIcon name={item.icon} className={`h-[18px] w-[18px] shrink-0 ${active ? "text-gold" : "text-ink/55 group-hover:text-gold"}`} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-line p-3">
        <Link href="/dashboard/account" className="flex items-center gap-3 rounded-lg p-2 hover:bg-ink/[0.05]" title="My account">
          <Avatar name={userName} src={userPhotoUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{userName}</p>
            <p className="truncate text-xs leading-tight text-ink/60">{userRole}</p>
          </div>
        </Link>
        <div className="flex items-center justify-between gap-2 px-2">
          <ThemeSwitcher />
          <SignOutButton className="btn-ghost btn-sm" />
        </div>
      </div>
    </>
  );
}

function Monogram({ text, small = false }: { text: string; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-ember font-display font-semibold tracking-wide text-on-ember shadow-[inset_0_0_0_1px_rgb(var(--gold)/0.5),0_0_0_3px_rgb(var(--gold)/0.12)] ${
        small ? "h-8 w-8 text-sm" : "h-11 w-11 text-lg"
      }`}
    >
      {text}
    </span>
  );
}
