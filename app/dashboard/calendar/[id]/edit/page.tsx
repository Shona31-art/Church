import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can, isShepherd } from "@/lib/permissions";
import { APP_TIMEZONE, utcIsoToLocalInput } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { EventForm } from "../../EventForm";

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("calendar");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const [{ data: event }, { data: departments }] = await Promise.all([
    supabase.from("events").select("*").eq("id", params.id).eq("church_id", me.church_id).maybeSingle(),
    supabase.from("departments").select("id, name").eq("church_id", me.church_id).order("name"),
  ]);
  if (!event) notFound();
  if (!can(me.role, "createEvents") || (event.created_by !== me.id && !isShepherd(me.role))) {
    return <PermissionDenied message="Only the organiser, pastors and church admins can edit this event." backHref={`/dashboard/calendar/${event.id}`} />;
  }

  return (
    <div>
      <PageHeader back={{ href: `/dashboard/calendar/${event.id}`, label: event.title }} title="Edit event" />
      <EventForm
        departments={departments ?? []}
        canPostChurchWide={can(me.role, "postChurchWide")}
        timezoneLabel={`Times are in ${APP_TIMEZONE.replace("_", " ")} time.`}
        event={{
          id: event.id,
          updated_at: event.updated_at,
          title: event.title,
          description: event.description,
          location: event.location,
          category: event.category ?? "other",
          start_local: utcIsoToLocalInput(event.start_time),
          end_local: utcIsoToLocalInput(event.end_time),
          department_id: event.department_id,
        }}
      />
    </div>
  );
}
