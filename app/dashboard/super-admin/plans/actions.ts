"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { logAudit } from "@/lib/audit";
import { MODULE_KEYS } from "@/lib/subscription";
import { planCodesFromEnv, priceToCents, type BillingInterval } from "@/lib/billing";
import { paystackConfigured, updatePlanAmount, PaystackError } from "@/lib/paystack";
import { EDITABLE_PLANS } from "./plans";

export type PlanResult = { ok?: boolean; error?: string; note?: string } | null;

const money = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s,R]/gi, ""))
  .pipe(z.string().regex(/^\d{1,6}(\.\d{1,2})?$/, "Enter a price in rand, e.g. 799 or 799.00"))
  .transform(Number);

/**
 * Platform admin only. Saves one plan: name, prices, member limit, trial
 * days, description and features. A changed price is changed on the matching
 * Paystack plan first, so checkout always charges what the Billing page shows.
 */
export async function savePlan(_prev: PlanResult, formData: FormData): Promise<PlanResult> {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") return { error: "Only the platform admin can change plans." };

  const parsed = z
    .object({
      key: z.enum(EDITABLE_PLANS),
      name: z.string().trim().min(2, "Give the plan a name.").max(40),
      monthly: money,
      yearly: z.union([z.literal(""), money]),
      memberLimit: z.union([z.literal(""), z.string().regex(/^\d{1,6}$/, "Member limit must be a whole number, or empty for unlimited.").transform(Number)]),
      trialDays: z.union([z.literal(""), z.string().regex(/^\d{1,3}$/, "Trial days must be a whole number.").transform(Number)]),
      description: z.string().trim().max(200),
      modules: z.array(z.enum(MODULE_KEYS)),
    })
    .safeParse({
      key: formData.get("key"),
      name: formData.get("name") ?? "",
      monthly: String(formData.get("monthly_price") ?? "0"),
      yearly: String(formData.get("yearly_price") ?? "").trim(),
      memberLimit: String(formData.get("member_limit") ?? "").trim(),
      trialDays: String(formData.get("trial_days") ?? "").trim(),
      description: formData.get("description") ?? "",
      modules: formData.getAll("modules"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the plan details." };
  const p = parsed.data;
  const yearly = p.yearly === "" ? null : p.yearly;

  const supabase = createClient();
  const { data: before } = await supabase.from("plans").select("*").eq("key", p.key).maybeSingle();
  if (!before) return { error: "That plan couldn't be found." };

  // Prices first: keep Paystack in step, or change nothing.
  const notes: string[] = [];
  const changes: [BillingInterval, number | null, number | null][] = [
    ["monthly", Number(before.monthly_price), p.monthly],
    ["yearly", before.yearly_price === null || before.yearly_price === undefined ? null : Number(before.yearly_price), yearly],
  ];
  for (const [interval, oldPrice, newPrice] of changes) {
    if (newPrice === null || newPrice === oldPrice || newPrice <= 0) continue;
    const code = planCodesFromEnv(process.env, interval)[p.key as keyof ReturnType<typeof planCodesFromEnv>];
    if (!code || !paystackConfigured()) {
      if (p.key !== "free_trial") notes.push(`There's no ${interval} Paystack plan for ${p.name} yet, so online ${interval} payment isn't offered for it.`);
      continue;
    }
    try {
      await updatePlanAmount(code, priceToCents(newPrice));
    } catch (error) {
      console.error("[plans] Paystack price update failed:", error instanceof PaystackError ? error.message : error);
      return { error: `Couldn't change the ${interval} price on Paystack, so nothing was saved. Try again in a minute.` };
    }
  }

  const { error } = await supabase
    .from("plans")
    .update({
      name: p.name,
      monthly_price: p.monthly,
      ...("yearly_price" in before ? { yearly_price: yearly } : {}),
      member_limit: p.memberLimit === "" ? null : p.memberLimit,
      trial_days: p.trialDays === "" ? null : p.trialDays,
      description: p.description || null,
    })
    .eq("key", p.key);
  if (error) {
    console.error("[plans] save failed:", error.message);
    return { error: "Couldn't save the plan — please try again." };
  }

  // Features: make the plan's list exactly what was ticked.
  const { error: delError } = await supabase.from("plan_modules").delete().eq("plan_key", p.key);
  const { error: insError } = p.modules.length
    ? await supabase.from("plan_modules").insert(p.modules.map((m) => ({ plan_key: p.key, module_key: m })))
    : { error: null };
  if (delError || insError) {
    console.error("[plans] features save failed:", (delError ?? insError)?.message);
    return { error: "The prices saved, but the features didn't — please save again." };
  }

  await logAudit({
    churchId: null,
    actorId: me.id,
    action: "plan.updated",
    targetTable: "plans",
    metadata: { plan: p.key, monthly: p.monthly, yearly, member_limit: p.memberLimit === "" ? null : p.memberLimit, modules: p.modules.length },
  });
  revalidatePath("/dashboard/super-admin/plans");
  revalidatePath("/dashboard/billing");
  return { ok: true, note: notes.join(" ") || undefined };
}
