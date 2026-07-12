// __tests__/lib/rag-categories.test.ts
import { describe, it, expect } from "vitest";
import {
  AVAILABLE_CATEGORIES,
  CATEGORY_KEYS,
  isCategory,
} from "@/lib/rag-categories";

describe("rag-categories", () => {
  it("has exactly the 8 ingestion categories", () => {
    expect(CATEGORY_KEYS).toEqual([
      "arrival", "billing", "course", "employment",
      "forms", "scholarships", "tuition", "visa",
    ]);
  });

  it("maps keys to human labels matching ingest.py", () => {
    expect(AVAILABLE_CATEGORIES.visa).toBe("Visa");
    expect(AVAILABLE_CATEGORIES.tuition).toBe("Tuition&Fees");
    expect(AVAILABLE_CATEGORIES.course).toBe("Course Registration");
  });

  it("isCategory accepts known keys and rejects others", () => {
    expect(isCategory("visa")).toBe(true);
    expect(isCategory("auto")).toBe(false);
    expect(isCategory("nonsense")).toBe(false);
  });
});
