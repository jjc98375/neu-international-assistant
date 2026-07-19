import { describe, it, expect, beforeAll } from "vitest";
import { readAnonCount, serializeAnonCookie, ANON_LIMIT } from "@/lib/gate";

beforeAll(() => { process.env.BETTER_AUTH_SECRET = "test-secret"; });

describe("anonymous gate cookie", () => {
  it("round-trips a signed count", () => {
    const setCookie = serializeAnonCookie(1);
    const value = setCookie.split(";")[0]; // "neu_anon=1.<sig>"
    expect(readAnonCount(value)).toBe(1);
  });
  it("returns 0 for missing or malformed cookie", () => {
    expect(readAnonCount(null)).toBe(0);
    expect(readAnonCount("neu_anon=banana")).toBe(0);
  });
  it("rejects a tampered signature", () => {
    const forged = "neu_anon=9." + "x".repeat(43);
    expect(readAnonCount(forged)).toBe(0);
  });
  it("exports the anonymous allowance", () => { expect(ANON_LIMIT).toBe(2); });
});
