// __tests__/lib/rag-categories.test.ts
import { describe, it, expect } from "vitest";
import {
  AVAILABLE_CATEGORIES,
  CATEGORY_KEYS,
  isCategory,
} from "@/lib/rag-categories";

describe("rag-categories", () => {
  it("has exactly the 5 consolidated ingestion categories", () => {
    expect(CATEGORY_KEYS).toEqual([
      "billing", "course", "employment", "scholarships", "visa",
    ]);
  });

  it("maps keys to human labels matching ingest.py", () => {
    expect(AVAILABLE_CATEGORIES.visa).toBe("Visa & Immigration");
    expect(AVAILABLE_CATEGORIES.billing).toBe("Billing & Tuition");
    expect(AVAILABLE_CATEGORIES.course).toBe("Course Registration");
  });

  it("isCategory accepts known keys and rejects others", () => {
    expect(isCategory("visa")).toBe(true);
    expect(isCategory("auto")).toBe(false);
    expect(isCategory("nonsense")).toBe(false);
  });

  it("rejects the pre-consolidation keys folded into visa/billing", () => {
    expect(isCategory("arrival")).toBe(false);
    expect(isCategory("forms")).toBe(false);
    expect(isCategory("tuition")).toBe(false);
  });
});
