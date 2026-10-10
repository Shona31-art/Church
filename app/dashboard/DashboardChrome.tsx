"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleAlert, Info, Menu, TriangleAlert, X } from "lucide-react";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "@/components/ui/Toaster";
import { NavIcon } from "@/components/ui/NavIcon";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { Avatar } from "@/components/ui/Avatar";
import { initials } from "@/lib/initials";
import { activeHref, type NavGroup } from "@/lib/navigation";

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
  userName,
  userRole,
  userPhotoUrl,
  banner,
  children,
}: {
  navGroups: NavGroup[];
  churchName: string;
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
    <div className="min-h-screen md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-pop"
      >
        Skip to content
      </a>

      {/* Desktop: a fixed sidebar holds navigation, identity and account. */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:sticky md:top-0 md:h-screen border-r border-line bg-surface">
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
          <span className="truncate font-display text-base font-semibold">{churchName}</span>
        </Link>
        <Link href="/dashboard/account" aria-label="My account" className="rounded-full">
          <Avatar name={userName} src={userPhotoUrl} />
        </Link>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] motion-safe:animate-fade-in" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside id="mobile-nav" className="absolute bottom-0 left-0 top-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-pop motion-safe:animate-modal-in">
            <button type="button" onClick={() => setMobileOpen(false)} className="btn-ghost btn-icon absolute right-2 top-3 z-10" aria-label="Close menu">
              <X aria-hidden className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {banner && <Banner banner={banner} />}
        <main id="main" className="flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 motion-safe:animate-fade-in">
          {children}
        </main>
      </div>

      <Toaster />
    </div>
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
      <Link href="/dashboard" className="flex items-center gap-3 px-5 pb-4 pt-5">
        <Monogram text={initials(churchName)} />
        <div className="min-w-0">
          <p className="truncate font-display text-[17px] font-semibold leading-tight">{churchName}</p>
          <p className="eyebrow mt-0.5">Grace-bound</p>
        </div>
      </Link>

      <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-3">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="eyebrow mb-1.5 px-3">{group.label}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = item.href === current;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                        active ? "bg-surface-raised font-semibold text-ink" : "text-ink/65 hover:bg-ink/[0.04] hover:text-ink"
                      }`}
                    >
                      {active && <span aria-hidden className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gold" />}
                      <NavIcon name={item.icon} className={`h-[18px] w-[18px] shrink-0 ${active ? "text-gold" : "text-ink/45 group-hover:text-ink/70"}`} />
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
        <Link href="/dashboard/account" className="flex items-center gap-3 rounded-xl p-2 hover:bg-ink/[0.04]" title="My account">
          <Avatar name={userName} src={userPhotoUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{userName}</p>
            <p className="truncate text-xs leading-tight text-ink/55">{userRole}</p>
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
      className={`relative flex shrink-0 items-center justify-center rounded-xl bg-ember font-display font-semibold text-on-ember shadow-[inset_0_1px_0_rgb(255_255_255/0.15)] ${
        small ? "h-7 w-7 text-xs" : "h-10 w-10 text-[15px]"
      }`}
    >
      {text}
      {!small && <span className="absolute bottom-1.5 left-1/2 h-px w-3 -translate-x-1/2 bg-gold" />}
    </span>
  );
}
