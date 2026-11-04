import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { APP_TIMEZONE } from "@/lib/format";
import { CERTIFICATE_INFO, type CertificateKind } from "@/lib/certificates";
import { CertificateView } from "@/components/certificates/CertificateView";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
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
  const info = CERTIFICATE_INFO[kind];
  const churchName = church?.name ?? "Our church";
  const date = new Date(`${c.issued_on}T12:00:00Z`).toLocaleDateString("en-ZA", { timeZone: APP_TIMEZONE, day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {/* Print: landscape A4, nothing but the certificate. */}
      <style>{`@media print { @page { size: A4 landscape; margin: 0; } body * { visibility: hidden; } #certificate, #certificate * { visibility: visible; } #certificate { position: fixed; inset: 0; margin: 0; width: 297mm; height: 210mm; border-radius: 0; box-shadow: none; } }`}</style>
      <div className="print:hidden">
        <PageHeader back={{ href: "/dashboard/certificates", label: "Certificates" }} title={`${info.label}: ${c.recipient_name}`} actions={<PrintButton />} />
        <p className="text-sm text-ink/60">Tip: in the print window choose “Save as PDF”, landscape, to email or keep it.</p>
      </div>

      <CertificateView
        kind={kind}
        recipient={c.recipient_name}
        churchName={churchName}
        logoUrl={church?.logo_url ?? null}
        date={date}
        place={c.place}
        courseName={c.course_name}
        parents={c.parents}
        officiant={c.officiant}
        scripture={c.scripture}
        number={c.certificate_no}
      />

      {can(me.role, "pastoralCare") && (
        <form action={deleteCertificate} className="flex justify-end print:hidden">
          <input type="hidden" name="id" value={c.id} />
          <ConfirmSubmitButton title="Delete this certificate?" message="Printed copies are still valid; this removes it from the app." confirmLabel="Delete" pendingLabel="Deleting…">
            Delete certificate
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
