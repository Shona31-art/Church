"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Award } from "lucide-react";
import { createCertificate } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField } from "@/components/ui/FormField";
import { PersonPicker, type PickerOption } from "@/components/ui/PersonPicker";
import { CertificateArt } from "@/components/certificates/CertificateArt";
import {
  CERTIFICATE_COLOURS,
  CERTIFICATE_DESIGNS,
  CERTIFICATE_INFO,
  CERTIFICATE_KINDS,
  COLOUR_KEYS,
  DESIGN_LABELS,
  type CertificateColourKey,
  type CertificateDesign,
  type CertificateKind,
} from "@/lib/certificates";

export type CertificateChild = { id: string; name: string; parents: string | null };

/** An existing certificate, when editing. */
export interface CertificateValues {
  id: string;
  kind: CertificateKind;
  design: CertificateDesign;
  colour: CertificateColourKey;
  member_id: string | null;
  recipient_name: string;
  course_name: string | null;
  parents: string | null;
  custom_title: string | null;
  custom_line: string | null;
  issued_on: string;
  officiant: string | null;
  place: string | null;
  scripture: string | null;
  certificate_no: number | null;
}

const chip = (on: boolean) => `rounded-full border px-3.5 py-2 text-sm font-medium transition ${on ? "border-ember bg-ember text-on-ember" : "border-line bg-surface text-ink/80 hover:border-ember/50"}`;

export function CertificateForm({
  people,
  kids = [],
  today,
  officiant,
  churchName,
  logoUrl,
  defaultDesign = "modern",
  defaultColour = "royal",
  certificate,
}: {
  people: { id: string; name: string }[];
  kids?: CertificateChild[];
  today: string;
  officiant: string;
  churchName: string;
  logoUrl: string | null;
  defaultDesign?: CertificateDesign;
  defaultColour?: CertificateColourKey;
  certificate?: CertificateValues;
}) {
  const e = certificate;
  const [open, setOpen] = useState(Boolean(e));
  const [state, action] = useFormState(createCertificate, null);
  const v = state?.values;
  const fe = state?.fieldErrors ?? {};
  const [kind, setKind] = useState<CertificateKind>((v?.kind as CertificateKind) ?? e?.kind ?? "baptism");
  const [design, setDesign] = useState<CertificateDesign>((v?.design as CertificateDesign) ?? e?.design ?? defaultDesign);
  const [colour, setColour] = useState<CertificateColourKey>((v?.colour as CertificateColourKey) ?? e?.colour ?? defaultColour);
  const [who, setWho] = useState(v?.member_id ?? e?.member_id ?? "");
  const [name, setName] = useState(v?.recipient_name ?? e?.recipient_name ?? "");
  const [parents, setParents] = useState(v?.parents ?? e?.parents ?? "");
  const [course, setCourse] = useState(v?.course_name ?? e?.course_name ?? "");
  const [customTitle, setCustomTitle] = useState(v?.custom_title ?? e?.custom_title ?? "");
  const [customLine, setCustomLine] = useState(v?.custom_line ?? e?.custom_line ?? "");
  const [date, setDate] = useState(v?.issued_on ?? e?.issued_on ?? today);
  const [signedBy, setSignedBy] = useState(v?.officiant ?? e?.officiant ?? officiant);
  const [place, setPlace] = useState(v?.place ?? e?.place ?? "");
  const [scripture, setScripture] = useState(v?.scripture ?? e?.scripture ?? "");

  const options: PickerOption[] = [
    { value: "", label: "Someone not in the app (type their name)" },
    ...kids.map((c) => ({ value: `child:${c.id}`, label: c.name, hint: c.parents ? `Child of ${c.parents}` : "Child", group: "Children" })),
    ...people.map((p) => ({ value: p.id, label: p.name, group: "Members" })),
  ];
  if (who && !options.some((o) => o.value === who)) options.push({ value: who, label: e?.recipient_name ?? "Chosen person", group: "Members" });
  const prettyDate = date ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) : "";

  if (!open)
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Award aria-hidden className="h-4 w-4" /> New certificate
      </button>
    );

  return (
    <form action={action} className="card-elevated space-y-5 rounded-2xl p-5" noValidate>
      {e && <input type="hidden" name="id" value={e.id} />}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="design" value={design} />
      <input type="hidden" name="colour" value={colour} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Certificate</legend>
        <div className="flex flex-wrap gap-2">
          {CERTIFICATE_KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} className={chip(kind === k)} onClick={() => setKind(k)}>
              {CERTIFICATE_INFO[k].label}
            </button>
          ))}
        </div>
      </fieldset>

      {kind === "custom" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Title" htmlFor="custom_title" required error={fe.custom_title} hint="e.g. Certificate of Appreciation, Ordination, Recognition">
            <input id="custom_title" name="custom_title" maxLength={80} value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} className="input" placeholder="Certificate of Appreciation" />
          </FormField>
          <FormField label="Wording under the name" htmlFor="custom_line" optional hint="e.g. in grateful recognition of faithful service as an usher">
            <input id="custom_line" name="custom_line" maxLength={240} value={customLine} onChange={(e) => setCustomLine(e.target.value)} className="input" />
          </FormField>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Who is it for?" htmlFor="member_id" optional hint="Members see and download it themselves; a child's shows to their parents.">
          <PersonPicker
            id="member_id"
            name="member_id"
            title="Who is the certificate for?"
            options={options}
            value={who}
            onChange={(value, option) => {
              setWho(value);
              if (!value) return;
              setName(option?.label ?? "");
              const child = kids.find((c) => `child:${c.id}` === value);
              if (child) {
                if (child.parents) setParents(child.parents);
                if (kind === "baptism" || kind === "membership") setKind("dedication");
              }
            }}
          />
        </FormField>
        <FormField label="Name on the certificate" htmlFor="recipient_name" required error={fe.recipient_name}>
          <input id="recipient_name" name="recipient_name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Full name" />
        </FormField>
        {kind === "course" && (
          <FormField label="Course" htmlFor="course_name" required error={fe.course_name}>
            <input id="course_name" name="course_name" maxLength={120} value={course} onChange={(e) => setCourse(e.target.value)} className="input" placeholder="e.g. Foundations of Faith" />
          </FormField>
        )}
        {kind === "dedication" && (
          <FormField label="Parents" htmlFor="parents" optional>
            <input id="parents" name="parents" maxLength={160} value={parents} onChange={(e) => setParents(e.target.value)} className="input" placeholder="e.g. Thabo and Lerato Mokoena" />
          </FormField>
        )}
        <FormField label="Date" htmlFor="issued_on" required error={fe.issued_on}>
          <input id="issued_on" name="issued_on" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </FormField>
        <FormField label="Signed by" htmlFor="officiant" optional>
          <input id="officiant" name="officiant" maxLength={120} value={signedBy} onChange={(e) => setSignedBy(e.target.value)} className="input" />
        </FormField>
        <FormField label="Place" htmlFor="place" optional>
          <input id="place" name="place" maxLength={120} value={place} onChange={(e) => setPlace(e.target.value)} className="input" placeholder="e.g. Durban" />
        </FormField>
      </div>
      <FormField label="Scripture" htmlFor="scripture" optional hint="Leave blank for the usual verse.">
        <input id="scripture" name="scripture" maxLength={300} value={scripture} onChange={(e) => setScripture(e.target.value)} className="input" placeholder={CERTIFICATE_INFO[kind].scripture} />
      </FormField>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Design</legend>
        <div className="flex flex-wrap gap-2">
          {CERTIFICATE_DESIGNS.map((d) => (
            <button key={d} type="button" aria-pressed={design === d} className={chip(design === d)} onClick={() => setDesign(d)}>
              {DESIGN_LABELS[d]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {COLOUR_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={colour === k}
              aria-label={CERTIFICATE_COLOURS[k].label}
              title={CERTIFICATE_COLOURS[k].label}
              onClick={() => setColour(k)}
              className={`h-10 w-10 rounded-full border-2 ${colour === k ? "border-ink ring-2 ring-ember/40" : "border-surface ring-1 ring-line"}`}
              style={{ background: `linear-gradient(135deg, ${CERTIFICATE_COLOURS[k].foil[0]}, ${CERTIFICATE_COLOURS[k].foil[1]}, ${CERTIFICATE_COLOURS[k].foil[2]})` }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-ink/60">Your church keeps the design and colour you use, for next time.</p>
      </fieldset>

      <div>
        <p className="mb-2 text-sm font-semibold">Preview</p>
        <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-line">
          <CertificateArt
            id="certificate-preview"
            kind={kind}
            design={design}
            colour={colour}
            recipient={name}
            churchName={churchName}
            logoUrl={logoUrl}
            date={prettyDate}
            place={place}
            courseName={course || null}
            parents={parents || null}
            customTitle={customTitle || "Certificate of Appreciation"}
            customLine={customLine}
            officiant={signedBy}
            scripture={scripture}
            number={e?.certificate_no ?? null}
          />
        </div>
      </div>

      <FormActions>
        <PendingButton pendingLabel={e ? "Saving…" : "Creating…"}>{e ? "Save changes" : "Create certificate"}</PendingButton>
        {e ? (
          <a href={`/dashboard/certificates/${e.id}`} className="btn-ghost">
            Cancel
          </a>
        ) : (
          <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
        )}
      </FormActions>
    </form>
  );
}
