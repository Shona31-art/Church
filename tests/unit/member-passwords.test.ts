import { describe, expect, test } from "vitest";
import { generatePassword } from "@/lib/passwords";
import { passwordSchema } from "@/lib/account-schemas";
import { memberCreateSchema } from "@/lib/member-schemas";

const base = { name: "Thandi Mokoena", email: "Thandi@Example.com", phone: undefined, role: "member", departmentId: "" };

describe("adding a member with a password (no invite email)", () => {
  test("a password is required", () => {
    const r = memberCreateSchema.safeParse({ ...base, password: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === "password")).toBe(true);
  });

  test("weak passwords are refused with a clear message", () => {
    expect(memberCreateSchema.safeParse({ ...base, password: "short1" }).success).toBe(false);
    expect(memberCreateSchema.safeParse({ ...base, password: "lettersonly" }).success).toBe(false);
  });

  test("a good password passes, and the email is normalised", () => {
    const r = memberCreateSchema.safeParse({ ...base, password: "Grace2026!" });
    expect(r.success).toBe(true);
    expect(r.data?.email).toBe("thandi@example.com");
  });
});

describe("suggested passwords", () => {
  test("always meet the password rules and avoid look-alike characters", () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePassword();
      expect(passwordSchema.safeParse(p).success).toBe(true);
      expect(p).toMatch(/^[A-Za-z]{4}-\d{4}-[A-Za-z]{4}$/);
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });

  test("are different every time", () => {
    expect(new Set(Array.from({ length: 50 }, generatePassword)).size).toBe(50);
  });
});
