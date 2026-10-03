import { z } from "zod";
import { nameSchema, phoneSchema } from "@/lib/member-schemas";

// Account creation rules shared by registration and the super-admin screens.

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Keep the password under 72 characters.")
  .refine((p) => /[A-Za-z]/.test(p) && /[0-9]/.test(p), "Use a mix of letters and numbers.");

export const churchNameSchema = z.string().trim().min(2, "Enter the church's name.").max(200, "Keep the name under 200 characters.");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);

export const registerSchema = z
  .object({
    churchName: churchNameSchema,
    adminName: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: "The passwords don't match.", path: ["confirmPassword"] });
