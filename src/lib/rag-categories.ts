// src/lib/rag-categories.ts
/**
 * Category keys + labels — keys MUST match CATEGORIES in ingestion/ingest.py.
 *
 * Consolidated from the original 8 categories (2026-07): `arrival` and `forms`
 * merged into `visa` (all immigration paperwork), `tuition` merged into
 * `billing` (all money topics). Labels reflect the merged scope.
 */
export const AVAILABLE_CATEGORIES = {
  billing: "Billing & Tuition",
  course: "Course Registration",
  employment: "Co-op & Employment",
  scholarships: "Scholarships",
  visa: "Visa & Immigration",
} as const;

export type Category = keyof typeof AVAILABLE_CATEGORIES;

export const CATEGORY_KEYS = Object.keys(AVAILABLE_CATEGORIES) as Category[];

export function isCategory(value: string): value is Category {
  return Object.prototype.hasOwnProperty.call(AVAILABLE_CATEGORIES, value);
}
