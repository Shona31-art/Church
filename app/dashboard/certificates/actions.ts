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
import { CERTIFICATE_DESIGNS, CERTIFICATE_KINDS, COLOUR_KEYS } from "@/lib/certificates";
import { createAdminClient } from "@/lib/supabase/admin";

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const schema = z.object({
  kind: z.enum(CERTIFICATE_KINDS),
  recipientName: z.string().trim().min(1, "Enter the name for the certificate.").max(120),
  /** A member's id, "child:<id>" for a child on Members → Children, or "". */
  memberId: z.union([z.string().uuid(), z.string().regex(/^child:[0-9a-f-]{36}$/), z.literal("")]).transform((v) => v || null),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date."),
  courseName: text(120),
  parents: text(160),
  officiant: text(120),
  scripture: text(300),
  place: text(120),
  customTitle: text(80),
  customLine: text(240),
  design: z.enum(CERTIFICATE_DESIGNS).catch("modern"),
  colour: z.enum(COLOUR_KEYS as [string, ...string[]]).catch("royal"),
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
    customTitle: g("custom_title"),
    customLine: g("custom_line"),
    design: g("design"),
    colour: g("colour"),
  });
  if (!parsed.success) {
    const r = invalid(parsed.error, formData);
    if (r?.fieldErrors) for (const [a, b] of [["recipientName", "recipient_name"], ["issuedOn", "issued_on"]]) if (r.fieldErrors[a]) r.fieldErrors[b] = r.fieldErrors[a];
    return r;
  }
  const c = parsed.data;
  // A child's certificate is filed under the parent who added them, so the family sees it.
  if (c.memberId?.startsWith("child:")) {
    const { data: child } = await createClient().from("member_children").select("user_id").eq("id", c.memberId.slice(6)).maybeSingle();
    c.memberId = child?.user_id ?? null;
  }
  if (c.kind === "course" && !c.courseName) return { error: "Enter the course name.", fieldErrors: { course_name: "Enter the course name." }, values: formValues(formData) };
  if (c.kind === "custom" && !c.customTitle) return { error: "Type the certificate's title.", fieldErrors: { custom_title: "Type the title, e.g. Certificate of Appreciation." }, values: formValues(formData) };
  const editId = z.string().uuid().safeParse(formData.get("id"));
  const table = createClient().from("certificates");
  const { data, error } = await (editId.success ? (row: Record<string, unknown>) => table.update(row).eq("id", editId.data).eq("church_id", me.church_id!) : (row: Record<string, unknown>) => table.insert(row))({
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
      ...(editId.success ? {} : { issued_by: me.id }),
      design: c.design,
      colour: c.colour,
      custom_title: c.kind === "custom" ? c.customTitle : null,
      custom_line: c.kind === "custom" ? c.customLine : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[certificates] create failed:", error?.message);
    return { error: /custom|design|colour/.test(error?.message ?? "") ? "Run database update #62 (church_life_v2.sql) first for designs, colours and your own titles." : "Couldn't create the certificate — please try again.", values: formValues(formData) };
  }
  // The church keeps this style for its next certificate (pastors can't update the church row themselves).
  await createAdminClient().from("churches").update({ certificate_design: c.design, certificate_colour: c.colour }).eq("id", me.church_id);
  revalidatePath("/dashboard/certificates");
  revalidatePath(`/dashboard/certificates/${data.id}`);
  flash(editId.success ? "Changes saved." : "Certificate ready — download the PDF or share it.");
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
