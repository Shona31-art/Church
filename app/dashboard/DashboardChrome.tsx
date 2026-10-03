"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "@/components/ui/Toaster";
import { activeHref, type NavGroup } from "@/lib/navigation";

export interface AccountBanner {
  tone: "info" | "warning" | "error";
  message: string;
  action?: { href: string; label: string };
}

const BANNER_CLASS: Record<AccountBanner["tone"], string> = {
  info: "bg-info-tint text-info border-info-line",
  warning: "bg-warning-tint text-warning border-warning-line",
  error: "bg-danger-tint text-danger border-danger-line",
};

export function DashboardChrome({
  navGroups,
  churchName,
  userName,
  userRole,
  banner,
  children,
}: {
  navGroups: NavGroup[];
  churchName: string;
  userName: string;
  userRole: string;
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

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      <header className="card-elevated flex items-center justify-between gap-3 px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden btn-ghost px-2"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            <span aria-hidden className="text-xl leading-none">{mobileOpen ? "✕" : "☰"}</span>
          </button>
          <Link href="/dashboard" className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{churchName}</p>
            <div className="rule-gold mt-1" style={{ width: 18, height: 1.5 }} />
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/account" className="text-right hidden sm:block rounded-lg px-2 py-1 hover:bg-ink/5" title="My account">
            <p className="text-sm leading-tight">{userName}</p>
            <p className="text-xs text-ink/50 leading-tight">{userRole}</p>
          </Link>
          <Link href="/dashboard/account" className="sm:hidden btn-ghost btn-sm" aria-label="My account">
            <span aria-hidden>👤</span>
          </Link>
          <SignOutButton className="btn-secondary btn-sm" />
        </div>
      </header>

      {banner && (
        <div role="status" className={`border-b px-4 py-2 text-sm flex flex-wrap items-center justify-center gap-x-3 gap-y-1 ${BANNER_CLASS[banner.tone]}`}>
          <span>{banner.message}</span>
          {banner.action && (
            <Link href={banner.action.href} className="font-semibold underline underline-offset-2">
              {banner.action.label}
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:block md:w-60 border-r border-line p-4 shrink-0">
          <Nav groups={navGroups} current={current} />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-30 md:hidden">
            <div className="absolute inset-0 bg-ink/30" onClick={() => setMobileOpen(false)} aria-hidden />
            <aside id="mobile-nav" className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-parchment p-4 overflow-y-auto shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold truncate">{churchName}</p>
                <button type="button" onClick={() => setMobileOpen(false)} className="btn-ghost btn-sm" aria-label="Close menu">
                  ✕
                </button>
              </div>
              <Nav groups={navGroups} current={current} />
            </aside>
          </div>
        )}

        <main id="main" className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <Toaster />
    </div>
  );
}

function Nav({ groups, current }: { groups: NavGroup[]; current: string | null }) {
  return (
    <nav aria-label="Main" className="space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink/40">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = item.href === current;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm border-l-2 ${
                      active ? "border-gold bg-ink/[0.04] text-ink font-semibold" : "border-transparent text-ink/70 hover:bg-ink/5 hover:text-ink"
                    }`}
                  >
                    <span aria-hidden className="w-5 text-center">{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
