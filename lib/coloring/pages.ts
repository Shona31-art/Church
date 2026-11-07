import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Uploaded colouring pages (record_members.sql: coloring_pages): this
// church's own, plus the built-in set — pages from the church marked as the
// source (churches.jigsaw_source), shared with every church.

export const COLORING_BUCKET = "coloring-pages";

export interface ColoringPage {
  id: string;
  title: string;
  /** Served by /api/coloring/[id] (same site, so the page can be coloured pixel by pixel). */
  url: string;
  mine: boolean;
}

export async function listColoringPages(churchId: string): Promise<ColoringPage[]> {
  const admin = createAdminClient();
  const { data: sources } = await admin.from("churches").select("id").eq("jigsaw_source", true);
  const churches = [...new Set([churchId, ...((sources ?? []) as { id: string }[]).map((c) => c.id)])];
  const { data, error } = await admin.from("coloring_pages").select("id, church_id, title, created_at").in("church_id", churches).order("created_at");
  if (error) return []; // before record_members.sql
  return ((data ?? []) as { id: string; church_id: string; title: string }[]).map((p) => ({ id: p.id, title: p.title, url: `/api/coloring/${p.id}`, mine: p.church_id === churchId }));
}

/** May someone from this church open this page? Their own church's, or a built-in one. */
export async function readableColoringPage(id: string, churchId: string): Promise<{ storage_path: string } | null> {
  const admin = createAdminClient();
  const { data: page } = await admin.from("coloring_pages").select("church_id, storage_path").eq("id", id).maybeSingle();
  if (!page) return null;
  if (page.church_id === churchId) return page;
  const { data: source } = await admin.from("churches").select("jigsaw_source").eq("id", page.church_id).maybeSingle();
  return (source as { jigsaw_source?: boolean } | null)?.jigsaw_source ? page : null;
}
