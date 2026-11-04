import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can, roleLabel } from "@/lib/permissions";
import { todayInAppZone } from "@/lib/format";
import { churchPeople, loadChurchChildren } from "@/lib/children";
import { CERTIFICATE_COLOURS, CERTIFICATE_DESIGNS, type CertificateColourKey, type CertificateDesign, type CertificateKind } from "@/lib/certificates";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { CertificateForm } from "../../CertificateForm";

export const metadata = { title: "Edit certificate" };

export default async function EditCertificatePage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("certificates");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  if (!can(me.role, "pastoralCare")) return <PermissionDenied message="Only pastors and church admins edit certificates." backHref="/dashboard/certificates" />;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const supabase = createClient();
  const [{ data: c }, { data: church }, people, kids] = await Promise.all([
    supabase.from("certificates").select("*").eq("id", params.id).eq("church_id", me.church_id).maybeSingle(),
    supabase.from("churches").select("name, logo_url").eq("id", me.church_id).maybeSingle(),
    churchPeople(me.church_id!),
    loadChurchChildren(),
  ]);
  if (!c) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader back={{ href: `/dashboard/certificates/${c.id}`, label: "Certificate" }} title="Edit certificate" description="Fix the wording, names, date, design or colour. The certificate number stays the same." />
      <CertificateForm
        people={people}
        kids={(kids ?? []).map((k) => ({ id: k.id, name: k.name, parents: [k.mother?.name, k.father?.name].filter(Boolean).join(" and ") || null }))}
        today={todayInAppZone()}
        officiant={`${me.name}, ${roleLabel(me.role)}`}
        churchName={church?.name ?? "Our church"}
        logoUrl={church?.logo_url ?? null}
        certificate={{
          id: c.id,
          kind: c.kind as CertificateKind,
          design: (CERTIFICATE_DESIGNS as readonly string[]).includes(c.design) ? (c.design as CertificateDesign) : "modern",
          colour: (c.colour in CERTIFICATE_COLOURS ? c.colour : "royal") as CertificateColourKey,
          member_id: c.member_id,
          recipient_name: c.recipient_name,
          course_name: c.course_name,
          parents: c.parents,
          custom_title: c.custom_title ?? null,
          custom_line: c.custom_line ?? null,
          issued_on: c.issued_on,
          officiant: c.officiant,
          place: c.place,
          scripture: c.scripture,
          certificate_no: c.certificate_no,
        }}
      />
    </div>
  );
}
