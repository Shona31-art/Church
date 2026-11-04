import Link from "next/link";
import { Award } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can, roleLabel } from "@/lib/permissions";
import { formatDate, todayInAppZone } from "@/lib/format";
import { churchPeople } from "@/lib/children";
import { CERTIFICATE_INFO, certificateNumber, type CertificateKind } from "@/lib/certificates";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CertificateForm } from "./CertificateForm";

export const metadata = { title: "Certificates" };

export default async function CertificatesPage() {
  const gate = await moduleGate("certificates");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  const shepherd = can(me.role, "pastoralCare");
  const { data } = await createClient().from("certificates").select("id, certificate_no, kind, recipient_name, issued_on, course_name").eq("church_id", me.church_id).order("issued_on", { ascending: false }).limit(500);
  const people = shepherd ? await churchPeople(me.church_id!) : [];
  const list = data ?? [];
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title={shepherd ? "Certificates" : "My certificates"}
        description={shepherd ? "Baptism, baby dedication, membership and course certificates with your church's logo — print them or save as PDF." : "Certificates your church has given you."}
      />
      {shepherd && <CertificateForm people={people} today={todayInAppZone()} officiant={`${me.name}, ${roleLabel(me.role)}`} />}
      {!list.length ? (
        <EmptyState icon={Award} title="No certificates yet" description={shepherd ? "Create one for a baptism, a dedication, a new member or a course." : undefined} />
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {list.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/certificates/${c.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-ink/[0.03]">
                <Award aria-hidden className="h-5 w-5 text-gold" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.recipient_name}</p>
                  <p className="text-sm text-ink/60">
                    {CERTIFICATE_INFO[c.kind as CertificateKind].label}
                    {c.course_name ? `: ${c.course_name}` : ""} · {formatDate(c.issued_on)}
                  </p>
                </div>
                <span className="text-xs text-ink/50">{certificateNumber(c.certificate_no)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
