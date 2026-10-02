import { describe, expect, test } from "vitest";
import { canTransition } from "@/lib/booking";
import { bookingRequestSchema, statusChangeSchema } from "@/lib/booking-schemas";

describe("canTransition", () => {
  test("pending requests can be approved or declined", () => {
    expect(canTransition("pending", "approved")).toBe(true);
    expect(canTransition("pending", "declined")).toBe(true);
  });

  test("approved bookings can only be marked completed", () => {
    expect(canTransition("approved", "completed")).toBe(true);
    expect(canTransition("approved", "pending")).toBe(false);
  });

  test("declined and completed are final", () => {
    expect(canTransition("declined", "approved")).toBe(false);
    expect(canTransition("completed", "pending")).toBe(false);
  });

  test("a pending request can't jump straight to completed", () => {
    expect(canTransition("pending", "completed")).toBe(false);
  });
});

describe("bookingRequestSchema", () => {
  const schema = bookingRequestSchema("2026-10-02");
  const valid = { bookingType: "wedding", preferredDate: "2026-10-02" };

  test("accepts today", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  test("rejects a past date with a readable message", () => {
    const result = schema.safeParse({ ...valid, preferredDate: "2026-10-01" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/past/);
  });

  test("rejects a booking type the database would refuse", () => {
    expect(schema.safeParse({ ...valid, bookingType: "party" }).success).toBe(false);
  });

  test("rejects a pastor id that isn't a uuid", () => {
    expect(schema.safeParse({ ...valid, pastorId: "1 or 1=1" }).success).toBe(false);
  });
});

describe("statusChangeSchema", () => {
  test("rejects a status the database doesn't know", () => {
    const result = statusChangeSchema.safeParse({
      bookingId: "00000000-0000-0000-0000-000000000001",
      from: "pending",
      to: "cancelled",
    });
    expect(result.success).toBe(false);
  });
});
