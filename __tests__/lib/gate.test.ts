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

  it("ignores a decoy cookie whose name merely ends with the real name", () => {
    const real = serializeAnonCookie(1).split(";")[0];
    const header = `xneu_anon=999.${"a".repeat(43)}; ${real}`;
    expect(readAnonCount(header)).toBe(1);
  });

  it("parses the cookie out of a multi-cookie header", () => {
    const real = serializeAnonCookie(2).split(";")[0];
    expect(readAnonCount(`other=x; ${real}; another=y`)).toBe(2);
  });

  it("throws when BETTER_AUTH_SECRET is missing", () => {
    const prev = process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_SECRET;
    expect(() => serializeAnonCookie(1)).toThrow(/BETTER_AUTH_SECRET/);
    process.env.BETTER_AUTH_SECRET = prev;
  });
});
