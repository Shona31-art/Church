"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export function DashboardChrome({
  navItems,
  churchName,
  userName,
  userRole,
  children,
}: {
  navItems: NavItem[];
  churchName: string;
  userName: string;
  userRole: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Topbar — visible on every screen size */}
      <header className="card-elevated flex items-center justify-between px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden text-ink/60 text-xl leading-none px-1"
            aria-label="Toggle menu"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
          <div>
            <p className="font-semibold text-sm leading-tight">{churchName}</p>
            <div className="rule-gold mt-1" style={{ width: 18, height: 1.5 }} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm leading-tight">{userName}</p>
            <p className="text-xs text-ink/40 capitalize leading-tight">{userRole.replace("_", " ")}</p>
          </div>
          <SignOutButton className="text-xs border border-ink/15 rounded-lg px-3 py-1.5 hover:bg-ink/5" />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar — always visible at md+ */}
        <aside className="hidden md:block md:w-56 border-r border-ink/10 p-4 shrink-0">
          <Nav navItems={navItems} pathname={pathname} />
        </aside>

        {/* Mobile drawer — slides in, dismisses on navigation or backdrop tap */}
        {mobileOpen && (
          <div className="fixed inset-0 z-30 md:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-parchment p-4 overflow-y-auto">
              <button
                onClick={() => setMobileOpen(false)}
                className="text-ink/60 mb-3 text-sm"
              >
                ✕ Close
              </button>
              <Nav navItems={navItems} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        <main className="flex-1 p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function Nav({
  navItems,
  pathname,
  onNavigate,
}: {
  navItems: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap border-l-2 ${
              active
                ? "border-gold bg-ink/[0.03] text-ink font-semibold"
                : "border-transparent hover:bg-ink/5 text-ink/70"
            }`}
          >
            {item.icon} {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
