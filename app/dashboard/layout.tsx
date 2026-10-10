import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionState } from "@/lib/current-user";
import { getChurchAccess } from "@/lib/paywall";
import { buildNavigation } from "@/lib/navigation";
import { can, roleLabel } from "@/lib/permissions";
import { DashboardChrome, type AccountBanner } from "./DashboardChrome";
import { getAvatarUrls } from "@/lib/avatars";

// `modal` is the @modal parallel route: form pages opened as popups over the
// current page (components/ui/RouteModal.tsx).
export default async function DashboardLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const session = await getSessionState();

  if (session.kind === "signed_out") redirect("/login");
  // A deactivated account (or a login with no church profile) is signed out
  // with an explanation rather than shown an empty dashboard. RLS already
  // blocks their data; this is the human-facing half.
  if (session.kind === "disabled") redirect("/auth/signout?reason=disabled");
  if (session.kind === "no_profile") redirect("/auth/signout?reason=no_profile");

  const me = session.user;
  const supabase = createClient();

  // An invited member who reached the dashboard has set their password and
  // signed in, so the invite is accepted. Service role: members can't change
  // their own status (security_fix_app_users.sql trigger), by design.
  if (me.status === "invited") {
    const { error } = await createAdminClient().from("app_users").update({ status: "active" }).eq("id", me.id).eq("status", "invited");
    if (error) console.error("[dashboard] couldn't mark invite accepted:", error.message);
  }

  const [access, churchRes] = await Promise.all([
    getChurchAccess(),
    me.church_id ? supabase.from("churches").select("name").eq("id", me.church_id).maybeSingle() : Promise.resolve(null),
  ]);

  const churchName = me.role === "super_admin" ? "Platform administration" : churchRes?.data?.name ?? "Your church";
  const navGroups = buildNavigation(me.role, access?.modules ?? new Set());

  let banner: AccountBanner | null = null;
  if (access && me.role !== "super_admin") {
    const admin = can(me.role, "manageBilling");
    if (access.status === "error") {
      banner = {
        tone: "error",
        message: "We couldn't verify your church's feature access. Refresh the page; contact support if the problem continues.",
      };
    } else if (access.status === "none") {
      banner = {
        tone: "warning",
        message: admin
          ? "Your church doesn't have a subscription set up yet. Contact support to restore feature access."
          : "Your church's subscription isn't set up yet. Contact your church admin.",
      };
    } else if (access.status === "trial" && access.trialDaysLeft !== null && access.trialDaysLeft <= 7) {
      banner = {
        tone: "info",
        message: `Your free trial ends in ${access.trialDaysLeft} day${access.trialDaysLeft === 1 ? "" : "s"}.`,
        action: admin ? { href: "/dashboard/billing", label: "Choose a plan" } : undefined,
      };
    } else if (access.status === "grace") {
      banner = {
        tone: "warning",
        message: `A payment didn't go through. Access continues for ${access.graceDaysLeft ?? 0} more day(s).`,
        action: admin ? { href: "/dashboard/billing", label: "Update payment" } : undefined,
      };
    } else if (access.status === "suspended") {
      banner = {
        tone: "error",
        message: "Your church's subscription has ended, so most features are paused. Your data is safe.",
        action: admin ? { href: "/dashboard/billing", label: "Renew" } : undefined,
      };
    }
  }

  return (
    <DashboardChrome
      navGroups={navGroups}
      churchName={churchName}
      userName={me.name}
      userRole={roleLabel(me.role)}
      userPhotoUrl={(await getAvatarUrls([me.id])).get(me.id) ?? null}
      banner={banner}
    >
      {children}
      {modal}
    </DashboardChrome>
  );
}
