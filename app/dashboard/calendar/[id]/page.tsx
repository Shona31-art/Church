import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can, isShepherd } from "@/lib/permissions";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { EVENT_CATEGORY_LABELS, RSVP_LABELS, type EventCategory, type RsvpStatus } from "@/lib/events";
import { PageHeader, Section, DetailList } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { OrganiserActions, RsvpButtons } from "./EventControls";
import { ShareButton } from "@/components/ShareButton";

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("calendar");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  const { data: event } = await createClient()
    .from("events")
    .select("*, departments(name), organiser:app_users!events_created_by_fkey(name), event_rsvps(status, user_id, app_users(name))")
    .eq("id", params.id)
    .eq("church_id", me.church_id)
    .maybeSingle();
  if (!event) notFound();

  const rsvps: { status: RsvpStatus; user_id: string; app_users: { name: string } | null }[] = event.event_rsvps ?? [];
  const mine = rsvps.find((r) => r.user_id === me.id)?.status ?? null;
  const counts = (Object.keys(RSVP_LABELS) as RsvpStatus[]).map((s) => ({ status: s, count: rsvps.filter((r) => r.status === s).length }));
  const isOrganiser = can(me.role, "createEvents") && (event.created_by === me.id || isShepherd(me.role));
  const going = rsvps.filter((r) => r.status === "going").map((r) => r.app_users?.name ?? "Member");
  const cancelled = Boolean(event.cancelled_at);
  const isPast = new Date(event.end_time ?? event.start_time).getTime() < Date.now();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard/calendar", label: "Calendar" }}
        title={event.title}
        actions={
          !cancelled && !isPast ? (
            <ShareButton
              content={{
                title: event.title,
                text: `${event.title}\n${formatDate(event.start_time)} · ${formatTime(event.start_time)}${event.location ? `\n${event.location}` : ""}`,
                url: `/dashboard/calendar/${event.id}`,
              }}
            />
          ) : undefined
        }
        meta={
          <>
            {cancelled && <StatusBadge tone="danger">Cancelled</StatusBadge>}
            {isPast && !cancelled && <StatusBadge tone="neutral">Past event</StatusBadge>}
            <StatusBadge tone="neutral">{EVENT_CATEGORY_LABELS[event.category as EventCategory] ?? "Event"}</StatusBadge>
            <StatusBadge tone="neutral">{event.departments?.name ? `${event.departments.name} only` : "Church-wide"}</StatusBadge>
          </>
        }
      />

      {cancelled && (
        <Alert tone="error" title="This event has been cancelled">
          Cancelled {formatDateTime(event.cancelled_at)}.
        </Alert>
      )}

      <Section title="Details">
        <DetailList
          items={[
            { label: "When", value: `${formatDate(event.start_time)} · ${formatTime(event.start_time)}${event.end_time ? `–${formatTime(event.end_time)}` : ""}` },
            { label: "Where", value: event.location },
            { label: "Organiser", value: event.organiser?.name },
          ]}
        />
        {event.description && <p className="mt-4 text-sm whitespace-pre-line leading-relaxed">{event.description}</p>}
      </Section>

      {!cancelled && !isPast && (
        <Section title="RSVP" description={counts.map((c) => `${c.count} ${RSVP_LABELS[c.status].toLowerCase()}`).join(" · ")}>
          <RsvpButtons eventId={event.id} mine={mine} />
        </Section>
      )}

      {isOrganiser && (
        <Section title="Who's coming" description="Visible to organisers, pastors and admins.">
          {going.length ? (
            <ul className="flex flex-wrap gap-2">
              {going.map((name, i) => (
                <li key={i}>
                  <StatusBadge tone="success">{name}</StatusBadge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/60">Nobody has said they&apos;re going yet.</p>
          )}
        </Section>
      )}

      {isOrganiser && <OrganiserActions eventId={event.id} title={event.title} cancelled={cancelled} rsvpCount={rsvps.length} />}
    </div>
  );
}
