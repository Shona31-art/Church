import { describe, expect, it, vi } from "vitest";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";

describe("callAction", () => {
  it("returns the action's own result, including an { error } it chose to return", async () => {
    expect(await callAction(async () => ({ ok: true }), { ok: false })).toEqual({ ok: true });
    expect(await callAction(async () => ({ error: "Not allowed." }), { error: CONNECTION_FAILED })).toEqual({ error: "Not allowed." });
  });

  it("turns a thrown request (offline, redeploy) into the fallback instead of rejecting", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await callAction<{ error?: string }>(() => Promise.reject(new TypeError("Failed to fetch")), { error: CONNECTION_FAILED });
    expect(result).toEqual({ error: CONNECTION_FAILED });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
