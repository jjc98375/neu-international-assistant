import { describe, it, expect } from "vitest";
import { PLAN_LIMITS, etDayStartUtc, resolveTier } from "@/lib/quota";

describe("quota", () => {
  it("maps tiers to daily limits", () => {
    expect(PLAN_LIMITS).toEqual({ free: 10, plus: 30, pro: 100 });
  });

  it("computes ET midnight in summer (EDT, UTC-4)", () => {
    // 2026-07-18T03:00Z == Jul 17 23:00 ET → day start Jul 17 00:00 ET == 04:00Z
    expect(etDayStartUtc(new Date("2026-07-18T03:00:00Z")).toISOString())
      .toBe("2026-07-17T04:00:00.000Z");
  });

  it("computes ET midnight in winter (EST, UTC-5)", () => {
    expect(etDayStartUtc(new Date("2026-01-15T12:00:00Z")).toISOString())
      .toBe("2026-01-15T05:00:00.000Z");
  });

  it("resolves tier from active subscriptions only", () => {
    expect(resolveTier([])).toBe("free");
    expect(resolveTier([{ plan: "plus", status: "active" }])).toBe("plus");
    expect(resolveTier([{ plan: "pro", status: "active" }])).toBe("pro");
    expect(resolveTier([{ plan: "pro", status: "past_due" }])).toBe("free");
    expect(resolveTier([{ plan: "plus", status: "active" }, { plan: "pro", status: "active" }])).toBe("pro");
  });
});
