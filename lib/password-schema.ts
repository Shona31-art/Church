import { z } from "zod";

/** Sign-in password rules, shared by registration, account settings and adding members. */
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Keep the password under 72 characters.")
  .refine((p) => /[A-Za-z]/.test(p) && /[0-9]/.test(p), "Use a mix of letters and numbers.");
