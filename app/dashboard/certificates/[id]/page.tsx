import Link from "next/link";
import { Pencil } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { APP_TIMEZONE } from "@/lib/format";
import { CERTIFICATE_COLOURS, CERTIFICATE_DESIGNS, CERTIFICATE_INFO, certificateHeading, type CertificateColourKey, type CertificateDesign, type CertificateKind } from "@/lib/certificates";
import { CertificateArt } from "@/components/certificates/CertificateArt";
import { CertificateActions } from "@/components/certificates/CertificateActions";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteCertificate } from "../actions";

export const metadata = { title: "Certificate" };

export default async function CertificatePage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("certificates");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const [{ data: c }, { data: church }] = await Promise.all([
    supabase.from("certificates").select("*").eq("id", params.id).eq("church_id", me.church_id).maybeSingle(),
    supabase.from("churches").select("name, logo_url").eq("id", me.church_id).maybeSingle(),
  ]);
  if (!c) notFound();
  const kind = c.kind as CertificateKind;
  const design = (CERTIFICATE_DESIGNS as readonly string[]).includes(c.design) ? (c.design as CertificateDesign) : "modern";
  const colour = (c.colour in CERTIFICATE_COLOURS ? c.colour : "royal") as CertificateColourKey;
  const heading = certificateHeading({ kind, customTitle: c.custom_title });
  const label = kind === "custom" ? c.custom_title ?? "Certificate" : CERTIFICATE_INFO[kind].label;
  const date = new Date(`${c.issued_on}T12:00:00Z`).toLocaleDateString("en-ZA", { timeZone: APP_TIMEZONE, day: "numeric", month: "long", year: "numeric" });
  const fileName = `${[heading.top, heading.main].filter(Boolean).join(" ")} - ${c.recipient_name}`.replace(/[^\w .,'()-]+/g, "").slice(0, 80);

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader
        back={{ href: "/dashboard/certificates", label: "Certificates" }}
        title={`${label}: ${c.recipient_name}`}
        actions={
          can(me.role, "pastoralCare") ? (
            <Link href={`/dashboard/certificates/${c.id}/edit`} className="btn-secondary">
              <Pencil aria-hidden className="h-4 w-4" /> Edit
            </Link>
          ) : undefined
        }
      />
      <CertificateActions svgId="certificate-art" fileName={fileName} title={`${heading.top} ${heading.main}`.trim()} />
      <div className="overflow-hidden rounded-lg shadow-xl ring-1 ring-line">
        <CertificateArt
          id="certificate-art"
          kind={kind}
          design={design}
          colour={colour}
          recipient={c.recipient_name}
          churchName={church?.name ?? "Our church"}
          logoUrl={church?.logo_url ?? null}
          date={date}
          place={c.place}
          courseName={c.course_name}
          parents={c.parents}
          customTitle={c.custom_title}
          customLine={c.custom_line}
          officiant={c.officiant}
          scripture={c.scripture}
          number={c.certificate_no}
        />
      </div>
      <p className="text-xs text-ink/60">The PDF is A4 landscape at print quality — open it and print, or send it on WhatsApp.</p>

      {can(me.role, "pastoralCare") && (
        <form action={deleteCertificate} className="flex justify-end">
          <input type="hidden" name="id" value={c.id} />
          <ConfirmSubmitButton title="Delete this certificate?" message="Printed copies are still valid; this removes it from the app." confirmLabel="Delete" pendingLabel="Deleting…">
            Delete certificate
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
