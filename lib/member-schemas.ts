import { z } from "zod";
import { CHURCH_ROLES } from "@/lib/permissions";

// Validation for member forms — used by the server actions (the real check)
// and safe to import in client components for the same rules.

export const nameSchema = z.string().trim().min(2, "Enter the person's full name.").max(120, "Keep the name under 120 characters.");

export const phoneSchema = z
  .string()
  .trim()
  .max(20, "That phone number is too long.")
  .regex(/^\+?[0-9 ()-]{6,20}$/, "Use digits, spaces and an optional leading + (e.g. 082 123 4567).")
  .optional();

const departmentId = z.union([z.string().uuid(), z.literal("")]).transform((v) => v || null);

export const memberCreateSchema = z.object({
  name: nameSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  phone: phoneSchema,
  role: z.enum(CHURCH_ROLES, { message: "Choose a role." }),
  departmentId,
});

export const memberUpdateSchema = z.object({
  memberId: z.string().uuid(),
  updatedAt: z.string().min(1),
  name: nameSchema,
  phone: phoneSchema,
  role: z.enum(CHURCH_ROLES, { message: "Choose a role." }),
  departmentId,
  birthDate: z
    .union([
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
        .refine((d) => d >= "1900-01-01" && d <= new Date().toISOString().slice(0, 10), "Birthdays can't be in the future."),
      z.literal(""),
    ])
    .transform((v) => v || null),
});
