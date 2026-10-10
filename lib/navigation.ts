// The dashboard menu, grouped by what people are trying to do. Each item
// declares the module (plan feature) and capability (role) it needs, so a
// person only sees what they can actually open. Hiding a link is a courtesy —
// every page and action re-checks access on the server.

import { can, type Capability } from "@/lib/permissions";
import type { ModuleKey } from "@/lib/subscription";
import type { NavIconName } from "@/components/ui/NavIcon";

export interface NavLink {
  href: string;
  label: string;
  icon: NavIconName;
}

export interface NavGroup {
  label: string;
  items: NavLink[];
}

interface NavSpec extends NavLink {
  module?: ModuleKey;
  capability?: Capability;
}

const CHURCH_NAV: { label: string; items: NavSpec[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Home", icon: "home" }],
  },
  {
    label: "Church",
    items: [
      { href: "/dashboard/members", label: "Members", icon: "members", module: "members", capability: "viewMembers" },
      { href: "/dashboard/departments", label: "Departments", icon: "departments", capability: "manageDepartments" },
      { href: "/dashboard/announcements", label: "Announcements", icon: "announcements", module: "announcements" },
      { href: "/dashboard/calendar", label: "Calendar", icon: "calendar", module: "calendar" },
    ],
  },
  {
    label: "Ministry",
    items: [
      { href: "/dashboard/service-planner", label: "Service Planner", icon: "servicePlanner", module: "service_planner" },
      { href: "/dashboard/sermons", label: "Sermons", icon: "sermons", module: "sermon_ai" },
      { href: "/dashboard/booking", label: "Pastor Booking", icon: "booking", module: "pastor_booking" },
      { href: "/dashboard/pastoral-care", label: "Pastoral Care", icon: "pastoralCare", module: "pastoral_care", capability: "pastoralCare" },
      { href: "/dashboard/counseling", label: "Counseling", icon: "counseling", module: "ai_counseling" },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/dashboard/prayer-board", label: "Prayer Board", icon: "prayer", module: "prayer_board" },
      { href: "/dashboard/chat", label: "Chats", icon: "chat", module: "dept_chats" },
    ],
  },
  {
    label: "Growth & resources",
    items: [
      { href: "/dashboard/bible", label: "Bible", icon: "bible", module: "bible" },
      { href: "/dashboard/journal", label: "Journal", icon: "journal", module: "journal" },
      { href: "/dashboard/games", label: "Games", icon: "games", module: "bible_games" },
      { href: "/dashboard/posters", label: "Posters", icon: "posters", module: "ai_poster", capability: "makePosters" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/dashboard/giving", label: "Giving", icon: "giving", module: "giving" },
      { href: "/dashboard/giving/report", label: "Giving report", icon: "report", module: "giving", capability: "viewGivingReport" },
      { href: "/dashboard/billing", label: "Billing", icon: "billing", capability: "manageBilling" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/dashboard/setup", label: "Church settings", icon: "settings", capability: "manageChurchProfile" },
      { href: "/dashboard/support", label: "Support", icon: "support", module: "support" },
    ],
  },
];

const PLATFORM_NAV: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { href: "/dashboard/super-admin", label: "Overview", icon: "overview" },
      { href: "/dashboard/super-admin/churches", label: "Churches", icon: "churches" },
      { href: "/dashboard/super-admin/users", label: "Platform users", icon: "user" },
      { href: "/dashboard/support", label: "Support tickets", icon: "support" },
    ],
  },
];

export function buildNavigation(role: string, modules: ReadonlySet<string>): NavGroup[] {
  if (role === "super_admin") return PLATFORM_NAV;

  return CHURCH_NAV.map((group) => ({
    label: group.label,
    items: group.items
      .filter((item) => (!item.module || modules.has(item.module)) && (!item.capability || can(role, item.capability)))
      .map(({ href, label, icon }) => ({ href, label, icon })),
  })).filter((group) => group.items.length > 0);
}

/**
 * Which menu item is "current": the longest href that prefixes the path, so
 * /dashboard/giving/report highlights "Giving report", not "Giving".
 */
export function activeHref(pathname: string, groups: NavGroup[]): string | null {
  let best: string | null = null;
  for (const item of groups.flatMap((g) => g.items)) {
    const matches = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
    if (matches && (!best || item.href.length > best.length)) best = item.href;
  }
  return best;
}
