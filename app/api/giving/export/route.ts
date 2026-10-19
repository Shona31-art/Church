import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { GIVING_FUNDS, csvCell, fundLabel } from "@/lib/giving";
import { logAudit } from "@/lib/audit";

/**
 * GET /api/giving/export?year=2026&fund=tithe — completed gifts as CSV.
 *
 * Who: church admins, for their own church only (RLS also limits givings).
 * Returns text/csv: date (paid date for bank transfers), donor, fund, amount
 * (rand), method, reference, confirmed by, confirmed at.
 * Errors: 401 not signed in · 403 not an admin / feature off · 500 failure.
 */
export async function GET(request: NextRequest) {
  const me = await getCurrentAppUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!can(me.role, "viewGivingReport") || !(await checkModuleAccess("giving")).allowed) {
    return NextResponse.json({ error: "Only church admins can export giving records." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const year = /^\d{4}$/.test(params.get("year") ?? "") ? Number(params.get("year")) : new Date().getUTCFullYear();
  const fund = (GIVING_FUNDS as readonly string[]).includes(params.get("fund") ?? "") ? params.get("fund") : null;

  let query = createClient()
    .from("givings")
    .select("created_at, amount_cents, fund, method, reference, paid_on, confirmed_at, app_users!givings_user_id_fkey(name), confirmer:app_users!givings_confirmed_by_fkey(name)")
    .eq("church_id", me.church_id)
    .eq("status", "succeeded")
    .gte("created_at", `${year}-01-01T00:00:00Z`)
    .lt("created_at", `${year + 1}-01-01T00:00:00Z`)
    .order("created_at")
    .limit(50000);
  if (fund) query = query.eq("fund", fund);
  const { data, error } = await query;
  if (error) {
    console.error("[giving] export failed:", error.message);
    return NextResponse.json({ error: "Export failed — please try again." }, { status: 500 });
  }

  const lines = [
    ["Date", "Donor", "Fund", "Amount (ZAR)", "Method", "Reference", "Confirmed by", "Confirmed at"].join(","),
    ...(data ?? []).map((g: any) =>
      [
        g.method === "eft" && g.paid_on ? g.paid_on : g.created_at.slice(0, 10),
        g.app_users?.name ?? "Former member",
        fundLabel(g.fund),
        (g.amount_cents / 100).toFixed(2),
        g.method === "eft" ? "Bank transfer" : "Card",
        g.reference ?? "",
        g.method === "eft" ? g.confirmer?.name ?? "" : "Card provider",
        g.confirmed_at ? g.confirmed_at.slice(0, 16).replace("T", " ") : "",
      ]
        .map(csvCell)
        .join(",")
    ),
  ];

  await logAudit({ churchId: me.church_id, actorId: me.id, action: "giving.exported", metadata: { year, fund } });

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="giving-${year}${fund ? `-${fund}` : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
