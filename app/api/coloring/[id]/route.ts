import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { COLORING_BUCKET, readableColoringPage } from "@/lib/coloring/pages";

/** GET /api/coloring/[id] — an uploaded colouring page's picture, for someone in a church that can use it. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) return new NextResponse(null, { status: 404 });
  const me = await getCurrentAppUser();
  if (!me?.church_id) return new NextResponse(null, { status: 401 });
  const page = await readableColoringPage(params.id, me.church_id);
  if (!page) return new NextResponse(null, { status: 404 });
  const { data } = await createAdminClient().storage.from(COLORING_BUCKET).download(page.storage_path);
  if (!data) return new NextResponse(null, { status: 404 });
  return new NextResponse(data, { headers: { "content-type": data.type || "image/png", "cache-control": "private, max-age=86400" } });
}
