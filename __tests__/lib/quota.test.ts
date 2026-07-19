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

  it("is stable across the 2026 spring-forward day (2026-03-08)", () => {
    // pre-transition (01:00 ET, EST) and post-transition (14:00 ET, EDT) must agree
    const pre = etDayStartUtc(new Date("2026-03-08T06:00:00Z"));
    const post = etDayStartUtc(new Date("2026-03-08T18:00:00Z"));
    expect(pre.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(post.toISOString()).toBe("2026-03-08T05:00:00.000Z");
  });

  it("is stable across the 2026 fall-back day (2026-11-01)", () => {
    const pre = etDayStartUtc(new Date("2026-11-01T04:30:00Z")); // 00:30 ET EDT
    const post = etDayStartUtc(new Date("2026-11-01T19:00:00Z")); // 14:00 ET EST
    expect(pre.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(post.toISOString()).toBe("2026-11-01T04:00:00.000Z");
  });

  it("resolves tier from active subscriptions only", () => {
    expect(resolveTier([])).toBe("free");
    expect(resolveTier([{ plan: "plus", status: "active" }])).toBe("plus");
    expect(resolveTier([{ plan: "pro", status: "active" }])).toBe("pro");
    expect(resolveTier([{ plan: "pro", status: "past_due" }])).toBe("free");
    expect(resolveTier([{ plan: "plus", status: "active" }, { plan: "pro", status: "active" }])).toBe("pro");
  });
});
