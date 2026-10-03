import type { ZodError } from "zod";

/**
 * What every form server action returns (via useFormState):
 *   error       — one message for the top of the form
 *   fieldErrors — per-field messages shown under each input
 *   ok          — the save worked (for forms that stay on the page)
 *   values      — what was submitted, so a failed save never loses typing
 */
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
  values?: Record<string, string>;
} | null;

/** First message per field from a Zod error, keyed by the field's name. */
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Standard result for a failed validation. */
export function invalid(error: ZodError, formData?: FormData): FormState {
  return {
    error: "Please fix the highlighted fields.",
    fieldErrors: fieldErrorsFrom(error),
    values: formData ? formValues(formData) : undefined,
  };
}

/** The submitted text fields (not files), to refill a form after an error. */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  });
  return out;
}

/** Reads a string field, treating missing and blank as undefined. */
export function optionalField(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export const SESSION_EXPIRED = "Your session has expired — sign in again, then retry. Nothing was saved.";
export const SAVE_FAILED = "Couldn't save your changes — please try again. Your entries are still in the form.";
