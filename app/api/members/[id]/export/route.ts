import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

/**
 * GET /api/members/:id/export — POPIA "access to personal information".
 *
 * Who: a church_admin (for anyone in their church) or the member themselves.
 * Returns: a JSON file download of every record we hold that is linked to
 *          the person, grouped by table.
 * Errors:  401 not signed in · 403 not allowed · 400 bad id · 404 not in
 *          your church · 500 export failed.
 *
 * Uses the service-role client because some rows (e.g. a member's private
 * prayers) are intentionally invisible to admins under RLS but must still be
 * included in the person's own export. Scope is enforced here instead: every
 * query is filtered to this person AND this church. Journal entries are
 * listed by date only — their text is encrypted and, by design, never
 * decryptable by church staff.
 */

// [table, column that identifies the person]
const SOURCES: [string, string][] = [
  ["member_birthdays", "user_id"],
  ["prayer_board_items", "user_id"],
  ["prayer_comments", "user_id"],
  ["prayer_intercessions", "user_id"],
  ["givings", "user_id"],
  ["event_rsvps", "user_id"],
  ["sermon_notes", "user_id"],
  ["bible_bookmarks", "user_id"],
  ["bible_notes", "user_id"],
  ["bible_quiz_attempts", "user_id"],
  ["pastor_bookings", "requested_by"],
  ["support_tickets", "created_by"],
  ["counseling_conversations", "member_id"],
  ["pastoral_care_logs", "member_id"],
  ["chat_messages", "sender_id"],
];

// These tables have no church_id column; they're scoped through the person
// (whose church membership was verified above) instead.
const NO_CHURCH_COLUMN = new Set(["event_rsvps", "sermon_notes", "bible_bookmarks", "bible_notes", "chat_messages"]);

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentAppUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const id = z.string().uuid().safeParse(params.id);
  if (!id.success) return NextResponse.json({ error: "Invalid member id." }, { status: 400 });

  const isSelf = id.data === me.id;
  if (!isSelf && me.role !== "church_admin") {
    return NextResponse.json({ error: "Only a church admin can export another member's data." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("app_users")
    .select("id, name, email, phone, role, status, created_at, departments(name)")
    .eq("id", id.data)
    .eq("church_id", me.church_id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Member not found in your church." }, { status: 404 });

  try {
    const records: Record<string, unknown> = {};
    for (const [table, column] of SOURCES) {
      let query = admin.from(table).select("*").eq(column, id.data).limit(5000);
      if (!NO_CHURCH_COLUMN.has(table)) query = query.eq("church_id", me.church_id);
      const { data, error } = await query;
      // A missing optional module table shouldn't break the whole export.
      records[table] = error ? { unavailable: true } : data;
    }

    const { data: journal } = await admin
      .from("journal_entries")
      .select("entry_date, created_at")
      .eq("user_id", id.data)
      .eq("church_id", me.church_id);
    records.journal_entries = {
      note: "Journal text is encrypted and cannot be read by church staff. Only entry dates are listed.",
      entries: journal ?? [],
    };

    await logAudit({
      churchId: me.church_id,
      actorId: me.id,
      action: isSelf ? "member.self_export" : "member.exported",
      targetTable: "app_users",
      targetId: id.data,
    });

    const body = JSON.stringify(
      { exported_at: new Date().toISOString(), exported_by: me.id, profile, records },
      null,
      2
    );
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="member-export-${id.data}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[export] failed:", error);
    return NextResponse.json({ error: "Export failed — please try again." }, { status: 500 });
  }
}
