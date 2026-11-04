import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { isAiConfigured } from "@/lib/ai";
import { todayInAppZone } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { checkModuleAccess } from "@/lib/paywall";
import { SermonForm } from "../../SermonForm";

export default async function EditSermonPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("sermon_ai");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageSermons")) {
    return <PermissionDenied message="Only pastors and church admins can edit sermons." backHref={`/dashboard/sermons/${params.id}`} />;
  }
  const { data: sermon } = await createClient().from("sermons").select("*").eq("id", params.id).eq("church_id", me.church_id).maybeSingle();
  if (!sermon) notFound();

  return (
    <div>
      <PageHeader back={{ href: `/dashboard/sermons/${sermon.id}`, label: sermon.title }} title="Edit sermon" />
      <SermonForm sermon={sermon} aiAvailable={isAiConfigured() && (await checkModuleAccess("ai_assist")).allowed} canUpload={(await checkModuleAccess("sermon_uploads")).allowed} today={todayInAppZone()} />
    </div>
  );
}
