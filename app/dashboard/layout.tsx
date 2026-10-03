import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { DashboardChrome, NavItem } from "./DashboardChrome";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const me = await getCurrentAppUser();
  if (!me) redirect("/login");

  let churchName = "Grace-bound";
  if (me.church_id) {
    const { data: church } = await supabase.from("churches").select("name").eq("id", me.church_id).single();
    if (church?.name) churchName = church.name;
  } else if (me.role === "super_admin") {
    churchName = "Platform Admin";
  }

  // Who sees which link. This only tidies the menu — every page and action
  // re-checks the role server-side, and RLS is the real boundary.
  const isShepherd = ["church_admin", "pastor"].includes(me.role);
  const allItems: (NavItem & { show?: boolean })[] = [
    { href: "/dashboard", label: "Home", icon: "🏠" },
    { href: "/dashboard/prayer-board", label: "Prayer Board", icon: "🙏" },
    { href: "/dashboard/journal", label: "Journal", icon: "📝" },
    { href: "/dashboard/announcements", label: "Announcements", icon: "📢" },
    { href: "/dashboard/calendar", label: "Calendar", icon: "📅" },
    { href: "/dashboard/sermons", label: "Sermons", icon: "🎤" },
    { href: "/dashboard/bible", label: "Bible", icon: "📖" },
    { href: "/dashboard/chat", label: "Chats", icon: "💬" },
    { href: "/dashboard/counseling", label: "Counseling", icon: "🤝" },
    { href: "/dashboard/booking", label: "Pastor Booking", icon: "📋" },
    { href: "/dashboard/games", label: "Games", icon: "🎮" },
    { href: "/dashboard/giving", label: "Giving", icon: "💝" },
    { href: "/dashboard/pastoral-care", label: "Pastoral Care", icon: "🕊️", show: isShepherd },
    { href: "/dashboard/members", label: "Members", icon: "👥", show: isShepherd },
    { href: "/dashboard/departments", label: "Departments", icon: "🗂️", show: isShepherd },
    { href: "/dashboard/service-planner", label: "Service Planner", icon: "🗓️" }, // volunteers see published plans
    { href: "/dashboard/posters", label: "Posters", icon: "🖼️", show: isShepherd || me.role === "department_leader" },
    { href: "/dashboard/support", label: "Support", icon: "🛟" },
  ];
  const navItems: NavItem[] =
    me.role === "super_admin"
      ? [
          { href: "/dashboard/support", label: "Support", icon: "🛟" },
          { href: "/dashboard/super-admin", label: "Super Admin", icon: "⚙️" },
          { href: "/dashboard/super-admin/churches", label: "Churches", icon: "⛪" },
          { href: "/dashboard/super-admin/users", label: "Users", icon: "👥" },
        ]
      : allItems.filter((item) => item.show !== false).map(({ show: _show, ...item }) => item);

  if (me.role === "church_admin") {
    navItems.push({ href: "/dashboard/billing", label: "Billing", icon: "💳" });
  }
  return (
    <DashboardChrome
      navItems={navItems}
      churchName={churchName}
      userName={me.name}
      userRole={me.role}
    >
      {children}
    </DashboardChrome>
  );
}
