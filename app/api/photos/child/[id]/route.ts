import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AVATAR_BUCKET } from "@/lib/avatar-path";

// A child's photo (record_members.sql: member_children.photo_path), for the
// people who can see that child — RLS: whoever added them, either parent and
// the church's pastors. Redirects to a short-lived link.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) return new NextResponse(null, { status: 404 });
  const { data } = await createClient().from("member_children").select("photo_path").eq("id", params.id).maybeSingle();
  const path = (data as { photo_path?: string | null } | null)?.photo_path;
  if (!path) return new NextResponse(null, { status: 404 });
  const { data: signed } = await createAdminClient().storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60);
  if (!signed?.signedUrl) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { headers: { "cache-control": "private, max-age=600" } });
}
