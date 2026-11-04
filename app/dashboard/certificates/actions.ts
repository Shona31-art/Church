"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { flash } from "@/lib/flash";
import { FormState, SESSION_EXPIRED, formValues, invalid } from "@/lib/forms";
import { CERTIFICATE_KINDS } from "@/lib/certificates";

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const schema = z.object({
  kind: z.enum(CERTIFICATE_KINDS),
  recipientName: z.string().trim().min(1, "Enter the name for the certificate.").max(120),
  memberId: z.union([z.string().uuid(), z.literal("")]).transform((v) => v || null),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date."),
  courseName: text(120),
  parents: text(160),
  officiant: text(120),
  scripture: text(300),
  place: text(120),
});

/** Pastors. Form fields: kind, recipient_name, member_id?, issued_on, course_name?, parents?, officiant?, scripture?, place? */
export async function createCertificate(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me?.church_id || !can(me.role, "pastoralCare")) return { error: SESSION_EXPIRED };
  if (!(await checkModuleAccess("certificates")).allowed) return { error: "Certificates aren't on your church's plan." };
  const g = (k: string) => formData.get(k) ?? "";
  const parsed = schema.safeParse({
    kind: g("kind"),
    recipientName: g("recipient_name"),
    memberId: g("member_id"),
    issuedOn: g("issued_on"),
    courseName: g("course_name"),
    parents: g("parents"),
    officiant: g("officiant"),
    scripture: g("scripture"),
    place: g("place"),
  });
  if (!parsed.success) {
    const r = invalid(parsed.error, formData);
    if (r?.fieldErrors) for (const [a, b] of [["recipientName", "recipient_name"], ["issuedOn", "issued_on"]]) if (r.fieldErrors[a]) r.fieldErrors[b] = r.fieldErrors[a];
    return r;
  }
  const c = parsed.data;
  if (c.kind === "course" && !c.courseName) return { error: "Enter the course name.", fieldErrors: { course_name: "Enter the course name." }, values: formValues(formData) };
  const { data, error } = await createClient()
    .from("certificates")
    .insert({
      church_id: me.church_id,
      kind: c.kind,
      recipient_name: c.recipientName,
      member_id: c.memberId,
      issued_on: c.issuedOn,
      course_name: c.kind === "course" ? c.courseName : null,
      parents: c.kind === "dedication" ? c.parents : null,
      officiant: c.officiant,
      scripture: c.scripture,
      place: c.place,
      issued_by: me.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[certificates] create failed:", error?.message);
    return { error: "Couldn't create the certificate — please try again.", values: formValues(formData) };
  }
  revalidatePath("/dashboard/certificates");
  flash("Certificate ready — print it or save it as a PDF.");
  redirect(`/dashboard/certificates/${data.id}`);
}

/** Pastors. Form fields: id */
export async function deleteCertificate(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!me?.church_id || !id.success || !can(me.role, "pastoralCare")) return;
  await createClient().from("certificates").delete().eq("id", id.data).eq("church_id", me.church_id);
  revalidatePath("/dashboard/certificates");
  flash("Certificate deleted.");
  redirect("/dashboard/certificates");
}
