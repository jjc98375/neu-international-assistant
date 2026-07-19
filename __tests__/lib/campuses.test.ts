// __tests__/lib/campuses.test.ts
import { describe, it, expect } from "vitest";
import { CAMPUS_KEYS, isCampus, campusFilterValues } from "@/lib/campuses";

describe("campuses", () => {
  it("has the six network campuses", () => {
    expect(CAMPUS_KEYS).toEqual([
      "boston", "silicon-valley", "seattle", "toronto", "vancouver", "london",
    ]);
  });

  it("isCampus accepts known keys and rejects others", () => {
    expect(isCampus("toronto")).toBe(true);
    expect(isCampus("all")).toBe(false);
    expect(isCampus("mars")).toBe(false);
  });

  it("US campuses include the shared 'us' corpus tag", () => {
    expect(campusFilterValues("boston")).toEqual(["all", "us", "boston"]);
    expect(campusFilterValues("seattle")).toEqual(["all", "us", "seattle"]);
  });

  it("Canadian campuses include the shared 'canada' tag, not 'us'", () => {
    expect(campusFilterValues("toronto")).toEqual(["all", "canada", "toronto"]);
    expect(campusFilterValues("vancouver")).toEqual(["all", "canada", "vancouver"]);
  });

  it("London stands alone", () => {
    expect(campusFilterValues("london")).toEqual(["all", "london"]);
  });
});
