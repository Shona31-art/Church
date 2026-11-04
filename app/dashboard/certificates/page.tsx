import Link from "next/link";
import { Award } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can, roleLabel } from "@/lib/permissions";
import { formatDate, todayInAppZone } from "@/lib/format";
import { churchPeople, loadChurchChildren } from "@/lib/children";
import { CERTIFICATE_COLOURS, CERTIFICATE_DESIGNS, CERTIFICATE_INFO, certificateNumber, type CertificateColourKey, type CertificateDesign, type CertificateKind } from "@/lib/certificates";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CertificateForm } from "./CertificateForm";

export const metadata = { title: "Certificates" };

export default async function CertificatesPage() {
  const gate = await moduleGate("certificates");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  const shepherd = can(me.role, "pastoralCare");
  const { data } = await createClient().from("certificates").select("*").eq("church_id", me.church_id).order("issued_on", { ascending: false }).limit(500);
  const people = shepherd ? await churchPeople(me.church_id!) : [];
  const children = shepherd ? ((await loadChurchChildren()) ?? []).map((c) => ({ id: c.id, name: c.name, parents: [c.mother?.name, c.father?.name].filter(Boolean).join(" and ") || null })) : [];
  const list = data ?? [];
  // The church's look (church_life_v2.sql); missing columns → defaults.
  const [{ data: church }, { data: style }] = await Promise.all([
    createClient().from("churches").select("name, logo_url").eq("id", me.church_id).maybeSingle(),
    createClient().from("churches").select("certificate_design, certificate_colour").eq("id", me.church_id).maybeSingle(),
  ]);
  const s = (style ?? {}) as { certificate_design?: string | null; certificate_colour?: string | null };
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title={shepherd ? "Certificates" : "My certificates"}
        description={shepherd ? "Baptism, baby dedication, membership and course certificates with your church's logo — print them or save as PDF." : "Certificates your church has given you."}
      />
      {shepherd && <CertificateForm
          people={people}
          kids={children}
          today={todayInAppZone()}
          officiant={`${me.name}, ${roleLabel(me.role)}`}
          churchName={church?.name ?? "Our church"}
          logoUrl={church?.logo_url ?? null}
          defaultDesign={(CERTIFICATE_DESIGNS as readonly string[]).includes(s.certificate_design ?? "") ? (s.certificate_design as CertificateDesign) : "modern"}
          defaultColour={s.certificate_colour && s.certificate_colour in CERTIFICATE_COLOURS ? (s.certificate_colour as CertificateColourKey) : "royal"}
        />}
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
                    {c.kind === "custom" ? c.custom_title ?? "Certificate" : CERTIFICATE_INFO[c.kind as CertificateKind].label}
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
