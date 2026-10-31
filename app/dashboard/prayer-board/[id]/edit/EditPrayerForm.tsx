"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { updatePrayer } from "../../actions";
import { Alert } from "@/components/ui/Alert";
import { FormActions } from "@/components/ui/FormField";
import { PendingButton } from "@/components/ConfirmSubmitButton";

const CATEGORIES = [
  ["", "None"],
  ["family", "Family"],
  ["career", "Career"],
  ["health", "Health"],
  ["ministry", "Ministry"],
  ["personal", "Personal growth"],
] as const;

export function EditPrayerForm({ id, text, category }: { id: string; text: string; category: string }) {
  const [state, action] = useFormState(updatePrayer, null);
  return (
    <form action={action} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-4 max-w-2xl">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor="prayer_text" className="label">
          Your prayer
        </label>
        <textarea id="prayer_text" name="prayer_text" required rows={6} maxLength={4000} defaultValue={state?.values?.prayer_text ?? text} className="input" />
      </div>
      <div>
        <label htmlFor="category" className="label">
          Category <span className="font-normal text-ink/60">(optional)</span>
        </label>
        <select id="category" name="category" defaultValue={state?.values?.category ?? category} className="input">
          {CATEGORIES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <FormActions>
        <PendingButton>Save changes</PendingButton>
        <Link href="/dashboard/prayer-board" className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}
